<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'solo' }, // 'solo' ou 'multi'
  playerPseudo: { type: String, default: 'boztas' },
  opponentPseudo: { type: String, default: 'Jess_522' },
  roomState: { type: Object, default: null },
  isHost: { type: Boolean, default: true }
})

const emit = defineEmits(['sync-state', 'win'])

const COLORS = [
  { id: 'red', label: 'Rouge', hex: '#d9383a' },
  { id: 'blue', label: 'Bleu', hex: '#1d8cf8' },
  { id: 'green', label: 'Vert', hex: '#58b836' },
  { id: 'yellow', label: 'Jaune', hex: '#d6a322' }
]

const deck = ref([])
const discardPile = ref([])
const myHand = ref([])
const oppHand = ref([])
const currentColor = ref('green')
const turn = ref('me') // 'me' | 'opp'
const direction = ref(1) // 1 = horaire, -1 = anti-horaire
const showColorPicker = ref(false)
const pendingWildCard = ref(null)
const statusBanner = ref('')
const winner = ref(null) // 'me' | 'opp' | null
const winPoints = ref(0)

// Timer de tour (barre jaune sous "À votre tour")
const turnTimeLeft = ref(100)
let timerInterval = null
let botTimeout = null

// Réactions rapides
const showEmojiMenu = ref(false)
const activeReaction = ref(null)
const EMOJIS = ['😄', '😡', '😱', '👏', '🔥', '😂']

function createDeck() {
  const cards = []
  let uid = 1
  for (const c of COLORS) {
    cards.push({ id: uid++, color: c.id, value: '0', type: 'number', points: 0 })
    for (let i = 0; i < 2; i++) {
      for (let n = 1; n <= 9; n++) {
        cards.push({ id: uid++, color: c.id, value: String(n), type: 'number', points: n })
      }
      cards.push({ id: uid++, color: c.id, value: '⊘', type: 'skip', points: 20 })
      cards.push({ id: uid++, color: c.id, value: '⇄', type: 'reverse', points: 20 })
      cards.push({ id: uid++, color: c.id, value: '+2', type: 'draw2', points: 20 })
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: uid++, color: 'wild', value: 'JOKER', type: 'wild', points: 50 })
    cards.push({ id: uid++, color: 'wild', value: '+4', type: 'wild4', points: 50 })
  }
  return shuffle(cards)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const topCard = computed(() => discardPile.value[discardPile.value.length - 1] || null)

function isCardPlayable(card) {
  if (!topCard.value || winner.value) return false
  if (card.color === 'wild') return true
  if (card.color === currentColor.value) return true
  if (card.value === topCard.value.value) return true
  return false
}

const hasPlayableCard = computed(() => myHand.value.some(isCardPlayable))

function drawFromDeck(count = 1) {
  const drawn = []
  for (let i = 0; i < count; i++) {
    if (deck.value.length === 0) {
      if (discardPile.value.length <= 1) break
      const top = discardPile.value.pop()
      deck.value = shuffle(discardPile.value)
      discardPile.value = [top]
    }
    const c = deck.value.pop()
    if (c) drawn.push(c)
  }
  return drawn
}

function startGame() {
  clearTimers()
  winner.value = null
  showColorPicker.value = false
  pendingWildCard.value = null
  direction.value = 1

  const fresh = createDeck()
  myHand.value = fresh.splice(0, 7)
  oppHand.value = fresh.splice(0, 7)

  let first = fresh.pop()
  while (first.color === 'wild') {
    fresh.unshift(first)
    first = fresh.pop()
  }
  deck.value = fresh
  discardPile.value = [first]
  currentColor.value = first.color
  turn.value = 'me'
  statusBanner.value = ''
  startTurnTimer()
  pushMultiplayerState()
}

function startTurnTimer() {
  clearInterval(timerInterval)
  turnTimeLeft.value = 100
  if (winner.value) return
  timerInterval = setInterval(() => {
    turnTimeLeft.value -= 2
    if (turnTimeLeft.value <= 0) {
      clearInterval(timerInterval)
      if (turn.value === 'me' && !showColorPicker.value) {
        handleDrawClick(true)
      }
    }
  }, 400)
}

function clearTimers() {
  clearInterval(timerInterval)
  clearTimeout(botTimeout)
}

function calculateHandPoints(hand) {
  const sum = hand.reduce((acc, c) => acc + (c.points || 0), 0)
  return Math.max(sum, 25)
}

function checkWin() {
  if (myHand.value.length === 0) {
    winner.value = 'me'
    winPoints.value = calculateHandPoints(oppHand.value)
    clearTimers()
    emit('win', { winner: 'me', points: winPoints.value })
    return true
  }
  if (oppHand.value.length === 0) {
    winner.value = 'opp'
    winPoints.value = calculateHandPoints(myHand.value)
    clearTimers()
    emit('win', { winner: 'opp', points: winPoints.value })
    return true
  }
  return false
}

function handleCardClick(card, index) {
  if (turn.value !== 'me' || showColorPicker.value || winner.value) return
  if (!isCardPlayable(card)) return

  myHand.value.splice(index, 1)
  discardPile.value.push(card)

  if (card.color === 'wild') {
    pendingWildCard.value = card
    showColorPicker.value = true
    return
  }

  currentColor.value = card.color
  applyCardEffect(card, 'me')
}

function chooseWildColor(colorId) {
  currentColor.value = colorId
  showColorPicker.value = false
  const card = pendingWildCard.value
  pendingWildCard.value = null
  const label = COLORS.find(c => c.id === colorId)?.label || colorId
  flashStatus(label)
  applyCardEffect(card, 'me')
}

function applyCardEffect(card, actor) {
  if (checkWin()) {
    pushMultiplayerState()
    return
  }

  const target = actor === 'me' ? 'opp' : 'me'

  if (card.type === 'reverse') {
    direction.value *= -1
    // En duel 1v1, Sens interdit / Inversion rejoue immédiatement
    flashStatus('Changement de sens !')
    nextTurn(actor)
  } else if (card.type === 'skip') {
    flashStatus('Tour passé !')
    nextTurn(actor)
  } else if (card.type === 'draw2') {
    const drawn = drawFromDeck(2)
    if (target === 'me') myHand.value.push(...drawn)
    else oppHand.value.push(...drawn)
    flashStatus('+2 cartes !')
    nextTurn(actor)
  } else if (card.type === 'wild4') {
    const drawn = drawFromDeck(4)
    if (target === 'me') myHand.value.push(...drawn)
    else oppHand.value.push(...drawn)
    flashStatus('+4 cartes !')
    nextTurn(actor)
  } else {
    nextTurn(target)
  }
}

function nextTurn(who) {
  turn.value = who
  startTurnTimer()
  pushMultiplayerState()

  if (who === 'opp' && props.mode === 'solo' && !winner.value) {
    botTimeout = setTimeout(playBotTurn, 1100)
  }
}

function handleDrawClick(forced = false) {
  if (turn.value !== 'me' || showColorPicker.value || winner.value) return
  if (!forced && hasPlayableCard.value) {
    // Autorise quand même à piocher comme sur Plato si le joueur veut garder sa carte
  }
  const [drawn] = drawFromDeck(1)
  if (drawn) {
    myHand.value.push(drawn)
  }
  nextTurn('opp')
}

function playBotTurn() {
  if (winner.value || turn.value !== 'opp') return
  const playableIdx = oppHand.value.findIndex(isCardPlayable)
  if (playableIdx !== -1) {
    const [card] = oppHand.value.splice(playableIdx, 1)
    discardPile.value.push(card)
    if (card.color === 'wild') {
      const counts = { red: 0, blue: 0, green: 0, yellow: 0 }
      oppHand.value.forEach(c => { if (counts[c.color] !== undefined) counts[c.color]++ })
      const bestColor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      currentColor.value = bestColor
      const label = COLORS.find(c => c.id === bestColor)?.label || ''
      flashStatus(label)
    } else {
      currentColor.value = card.color
    }
    applyCardEffect(card, 'opp')
  } else {
    const [drawn] = drawFromDeck(1)
    if (drawn) oppHand.value.push(drawn)
    nextTurn('me')
  }
}

function flashStatus(text) {
  statusBanner.value = text
  setTimeout(() => {
    if (statusBanner.value === text) statusBanner.value = ''
  }, 1600)
}

function sendReaction(emoji) {
  showEmojiMenu.value = false
  activeReaction.value = emoji
  setTimeout(() => {
    if (activeReaction.value === emoji) activeReaction.value = null
  }, 2000)
}

function getCardColorHex(color) {
  const found = COLORS.find(c => c.id === color)
  return found ? found.hex : '#222630'
}

function pushMultiplayerState() {
  if (props.mode !== 'multi') return
  emit('sync-state', {
    deck: deck.value,
    discardPile: discardPile.value,
    hostHand: props.isHost ? myHand.value : oppHand.value,
    guestHand: props.isHost ? oppHand.value : myHand.value,
    currentColor: currentColor.value,
    turnHost: props.isHost ? turn.value === 'me' : turn.value === 'opp',
    direction: direction.value,
    winnerHost: winner.value === null ? null : (props.isHost ? winner.value === 'me' : winner.value === 'opp'),
    winPoints: winPoints.value
  })
}

watch(() => props.roomState, (st) => {
  if (props.mode !== 'multi' || !st || !st.discardPile) return
  deck.value = st.deck || []
  discardPile.value = st.discardPile || []
  myHand.value = props.isHost ? (st.hostHand || []) : (st.guestHand || [])
  oppHand.value = props.isHost ? (st.guestHand || []) : (st.hostHand || [])
  currentColor.value = st.currentColor || 'green'
  direction.value = st.direction || 1
  turn.value = (props.isHost ? st.turnHost : !st.turnHost) ? 'me' : 'opp'
  if (st.winnerHost !== null && st.winnerHost !== undefined) {
    winner.value = (props.isHost ? st.winnerHost : !st.winnerHost) ? 'me' : 'opp'
    winPoints.value = st.winPoints || 49
  }
}, { deep: true })

onMounted(() => {
  if (props.mode === 'solo' || !props.roomState?.discardPile) {
    startGame()
  }
})

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <div class="plato-uno-board">
    <!-- ZONE ADVERSAIRE (Haut) -->
    <div class="opponent-zone">
      <div class="opp-cards-row">
        <div
          v-for="(c, idx) in oppHand"
          :key="c.id || idx"
          class="card-back-mini"
          :style="{ marginLeft: idx === 0 ? '0px' : '-22px', zIndex: idx }"
        >
          <div class="card-back-leaf"></div>
        </div>
      </div>

      <div class="opp-badge">
        <span class="online-dot" :class="{ active: turn === 'opp' }"></span>
        <span class="opp-name">{{ opponentPseudo }}</span>
      </div>

      <div class="opp-profile-row">
        <div class="avatar-circle opp-avatar">🐶</div>
        <span class="opp-count">{{ oppHand.length }}</span>
      </div>
    </div>

    <!-- ZONE CENTRALE (Flèches + Pioche + Défausse) -->
    <div class="center-arena">
      <!-- Flèche courbe haut-gauche -->
      <svg class="turn-arrow arrow-top" :class="{ reversed: direction === -1 }" viewBox="0 0 60 60">
        <path d="M 14 46 C 10 24, 24 12, 46 14" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="7" stroke-linecap="round" />
        <polygon points="44,5 56,15 43,23" fill="rgba(255,255,255,0.28)" />
      </svg>

      <div class="piles-row">
        <!-- Pioche -->
        <button
          class="draw-pile"
          :class="{ 'can-draw': turn === 'me' && !winner }"
          @click="handleDrawClick(false)"
          title="Piocher une carte"
        >
          <div class="draw-card-inner">
            <div class="draw-leaf">
              <span>UNO</span>
            </div>
          </div>
        </button>

        <!-- Défausse -->
        <div
          v-if="topCard"
          class="uno-card discard-card"
          :style="{ '--card-bg': getCardColorHex(topCard.color === 'wild' ? currentColor : topCard.color) }"
        >
          <span class="corner-val">{{ topCard.value === 'JOKER' ? '★' : topCard.value }}</span>
          <div class="plato-leaf" :class="{ 'multi-leaf': topCard.color === 'wild' }">
            <span class="center-val" :class="{ small: topCard.value.length > 2 }">
              {{ topCard.value === 'JOKER' ? '★' : topCard.value }}
            </span>
          </div>
        </div>
      </div>

      <!-- Flèche courbe bas-droite -->
      <svg class="turn-arrow arrow-bottom" :class="{ reversed: direction === -1 }" viewBox="0 0 60 60">
        <path d="M 46 14 C 50 36, 36 48, 14 46" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="7" stroke-linecap="round" />
        <polygon points="16,55 4,45 17,37" fill="rgba(255,255,255,0.28)" />
      </svg>

      <div v-if="statusBanner" class="status-toast">{{ statusBanner }}</div>
    </div>

    <!-- SÉLECTEUR DE COULEUR (+4 / JOKER) -->
    <div v-if="showColorPicker" class="color-picker-overlay">
      <div class="color-picker-card">
        <p>Choisis une couleur</p>
        <div class="color-grid">
          <button
            v-for="c in COLORS"
            :key="c.id"
            class="color-btn"
            :style="{ background: c.hex }"
            @click="chooseWildColor(c.id)"
          >
            {{ c.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- ZONE JOUEUR (Bas) -->
    <div class="player-zone">
      <!-- Réaction rapide flottante -->
      <div class="reaction-wrapper">
        <div v-if="activeReaction" class="floating-emoji">{{ activeReaction }}</div>
        <div v-if="showEmojiMenu" class="emoji-popover">
          <button v-for="e in EMOJIS" :key="e" @click="sendReaction(e)">{{ e }}</button>
        </div>
        <button class="emoji-trigger" @click="showEmojiMenu = !showEmojiMenu">😄</button>
      </div>

      <!-- Main du joueur en éventail horizontal -->
      <div class="my-hand-scroll">
        <div class="my-hand-row">
          <button
            v-for="(card, idx) in myHand"
            :key="card.id"
            class="uno-card hand-card"
            :class="{
              playable: turn === 'me' && isCardPlayable(card),
              dimmed: turn !== 'me' || !isCardPlayable(card)
            }"
            :style="{
              '--card-bg': getCardColorHex(card.color),
              marginLeft: idx === 0 ? '0px' : (myHand.length > 8 ? '-26px' : '-18px'),
              zIndex: idx + 1
            }"
            @click="handleCardClick(card, idx)"
          >
            <span class="corner-val">{{ card.value === 'JOKER' ? '★' : card.value }}</span>
            <div class="plato-leaf" :class="{ 'multi-leaf': card.color === 'wild' }">
              <span class="center-val" :class="{ small: card.value.length > 2 }">
                {{ card.value === 'JOKER' ? '★' : card.value }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Avatar joueur + Pilule "À votre tour" + Jauge -->
      <div class="player-footer">
        <div class="avatar-circle my-avatar">🇹🇷</div>
        <div class="turn-pill" :class="{ 'my-turn': turn === 'me' }">
          {{ turn === 'me' ? 'À votre tour' : `Tour de ${opponentPseudo}` }}
        </div>
        <div v-if="turn === 'me'" class="timer-track">
          <div class="timer-fill" :style="{ width: turnTimeLeft + '%' }"></div>
        </div>
        <span class="my-pseudo-label">• {{ playerPseudo }}</span>
      </div>
    </div>

    <!-- ÉCRAN DE FIN DE PARTIE STYLE PLATO (Capture 2) -->
    <div v-if="winner" class="victory-overlay">
      <h2 class="victory-title">
        {{ winner === 'me' ? 'VOUS AVEZ GAGNÉ !' : 'VOUS AVEZ PERDU !' }}
      </h2>

      <div class="podium-cards">
        <!-- Carte Gagnant -->
        <div class="result-card winner-card">
          <span class="res-pseudo">{{ winner === 'me' ? playerPseudo : opponentPseudo }}</span>
          <div class="res-leaf multi">
            <span class="res-avatar">{{ winner === 'me' ? '🇹🇷' : '🐶' }}</span>
          </div>
          <span class="res-score gold">{{ winPoints }}</span>
          <div class="medal-badge">🏅</div>
        </div>

        <!-- Carte Perdant -->
        <div class="result-card loser-card">
          <span class="res-pseudo">{{ winner === 'me' ? opponentPseudo : playerPseudo }}</span>
          <div class="res-leaf white">
            <span class="res-avatar">{{ winner === 'me' ? '🐶' : '🇹🇷' }}</span>
          </div>
          <div class="res-bottom-row">
            <span class="skull-icon">💀</span>
            <span class="res-score">-{{ winPoints }}</span>
          </div>
        </div>
      </div>

      <button class="replay-btn" @click="startGame">Rejouer une partie</button>
    </div>
  </div>
</template>

<style scoped>
.plato-uno-board {
  position: relative;
  width: 100%;
  max-width: 460px;
  min-height: 640px;
  margin: 0 auto;
  background: #20292f;
  border-radius: 22px;
  padding: 12px 12px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  user-select: none;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
  font-family: system-ui, -apple-system, sans-serif;
}

/* ADVERSAIRE */
.opponent-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.opp-cards-row {
  display: flex;
  justify-content: center;
  margin-top: -18px;
}
.card-back-mini {
  width: 44px;
  height: 62px;
  background: #252029;
  border: 2.5px solid #cfd6dc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -2px 2px 6px rgba(0, 0, 0, 0.4);
}
.card-back-leaf {
  width: 24px;
  height: 34px;
  background: #d94e53;
  border-radius: 50% 0 50% 0;
}
.opp-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #e2e8f0;
}
.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
}
.online-dot.active {
  background: #4ade80;
  box-shadow: 0 0 8px #4ade80;
}
.opp-profile-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #334155;
  border: 2.5px solid #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.45rem;
}
.my-avatar {
  border-color: #1d8cf8;
  box-shadow: 0 0 0 3px rgba(29, 140, 248, 0.35);
}
.opp-count {
  font-size: 1.25rem;
  font-weight: 900;
  color: #facc15;
}

/* CENTRE */
.center-arena {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}
.piles-row {
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 2;
}
.turn-arrow {
  position: absolute;
  width: 54px;
  height: 54px;
  transition: transform 0.4s ease;
}
.arrow-top {
  top: 2px;
  left: 24%;
}
.arrow-bottom {
  bottom: 2px;
  right: 24%;
}
.turn-arrow.reversed {
  transform: scaleX(-1);
}

/* PIOCHE */
.draw-pile {
  width: 68px;
  height: 98px;
  background: #ffffff;
  border: none;
  border-radius: 11px;
  padding: 4px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
}
.draw-pile.can-draw {
  box-shadow: 0 0 0 4px #38bdf8, 0 8px 20px rgba(56, 189, 248, 0.4);
}
.draw-pile:active {
  transform: scale(0.95);
}
.draw-card-inner {
  width: 100%;
  height: 100%;
  background: #252029;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.draw-leaf {
  width: 44px;
  height: 58px;
  background: #e04f54;
  border-radius: 50% 0 50% 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.5px;
}

/* CARTES UNO STYLE PLATO */
.uno-card {
  position: relative;
  width: 74px;
  height: 108px;
  background: var(--card-bg);
  border: 4px solid #ffffff;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: -3px 4px 12px rgba(0, 0, 0, 0.45);
  transition: transform 0.18s ease, filter 0.18s ease;
  flex-shrink: 0;
}
.discard-card {
  width: 82px;
  height: 118px;
}
.corner-val {
  position: absolute;
  top: 4px;
  left: 6px;
  color: #ffffff;
  font-weight: 900;
  font-size: 0.95rem;
  line-height: 1;
}
.plato-leaf {
  width: 48px;
  height: 68px;
  background: #ffffff;
  border-radius: 50% 0 50% 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.plato-leaf.multi-leaf {
  background: conic-gradient(#d9383a 0deg 90deg, #1d8cf8 90deg 180deg, #58b836 180deg 270deg, #d6a322 270deg 360deg);
}
.center-val {
  font-size: 1.85rem;
  font-weight: 900;
  color: var(--card-bg);
}
.multi-leaf .center-val {
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}
.center-val.small {
  font-size: 1.15rem;
}

/* MAIN DU JOUEUR */
.player-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.my-hand-scroll {
  width: 100%;
  overflow-x: auto;
  padding: 16px 8px 4px;
  display: flex;
  justify-content: center;
}
.my-hand-row {
  display: flex;
  align-items: flex-end;
}
.hand-card {
  cursor: pointer;
  padding: 0;
}
.hand-card.dimmed {
  filter: brightness(0.52);
  cursor: not-allowed;
}
.hand-card.playable {
  filter: brightness(1);
}
.hand-card.playable:hover,
.hand-card.playable:active {
  transform: translateY(-14px);
}

/* PIED DE PAGE JOUEUR */
.player-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.turn-pill {
  background: #334155;
  color: #cbd5e1;
  font-size: 0.8rem;
  font-weight: 800;
  padding: 4px 14px;
  border-radius: 999px;
}
.turn-pill.my-turn {
  background: #1d8cf8;
  color: #ffffff;
}
.timer-track {
  width: 68px;
  height: 5px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  overflow: hidden;
}
.timer-fill {
  height: 100%;
  background: #facc15;
  transition: width 0.4s linear;
}
.my-pseudo-label {
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 700;
}

/* RÉACTIONS EMOJI */
.reaction-wrapper {
  position: absolute;
  right: 4px;
  top: -28px;
  z-index: 20;
}
.emoji-trigger {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #111827;
  border: 2px solid rgba(255, 255, 255, 0.15);
  font-size: 1.3rem;
  cursor: pointer;
}
.emoji-popover {
  position: absolute;
  bottom: 46px;
  right: 0;
  background: #111827;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 6px 10px;
  display: flex;
  gap: 6px;
}
.emoji-popover button {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
}
.floating-emoji {
  position: absolute;
  bottom: 52px;
  right: 8px;
  font-size: 2.2rem;
  animation: popUp 1.8s ease forwards;
}
@keyframes popUp {
  0% { transform: scale(0.5) translateY(10px); opacity: 0; }
  25% { transform: scale(1.2) translateY(-10px); opacity: 1; }
  100% { transform: scale(1) translateY(-45px); opacity: 0; }
}

/* TOAST & SÉLECTEUR DE COULEUR */
.status-toast {
  position: absolute;
  bottom: -6px;
  background: rgba(15, 23, 42, 0.9);
  color: #facc15;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 800;
  z-index: 10;
}
.color-picker-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 30;
}
.color-picker-card {
  background: #182026;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-align: center;
  color: #fff;
}
.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 12px;
}
.color-btn {
  border: 2px solid #fff;
  color: #fff;
  font-weight: 800;
  padding: 12px 18px;
  border-radius: 12px;
  cursor: pointer;
}

/* ÉCRAN DE VICTOIRE STYLE PLATO */
.victory-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 18, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  z-index: 40;
  padding: 20px;
}
.victory-title {
  color: #facc15;
  font-size: 1.55rem;
  font-weight: 900;
  letter-spacing: 0.5px;
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.8);
  margin: 0;
}
.podium-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.result-card {
  position: relative;
  width: 118px;
  height: 168px;
  border: 4px solid #ffffff;
  border-radius: 14px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.65);
}
.winner-card {
  background: #231f28;
  transform: rotate(-5deg);
}
.loser-card {
  background: #1d8cf8;
  transform: rotate(5deg);
}
.res-pseudo {
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 800;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.res-leaf {
  width: 66px;
  height: 86px;
  border-radius: 50% 0 50% 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.res-leaf.multi {
  background: conic-gradient(#d9383a 0deg 90deg, #1d8cf8 90deg 180deg, #58b836 180deg 270deg, #d6a322 270deg 360deg);
}
.res-leaf.white {
  background: #ffffff;
}
.res-avatar {
  font-size: 2rem;
}
.res-score {
  font-size: 1.25rem;
  font-weight: 900;
  color: #ffffff;
  align-self: flex-end;
}
.res-score.gold {
  color: #facc15;
}
.res-bottom-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.medal-badge {
  position: absolute;
  bottom: -14px;
  left: -10px;
  font-size: 2rem;
}
.replay-btn {
  background: #1d8cf8;
  color: #ffffff;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
}
</style>