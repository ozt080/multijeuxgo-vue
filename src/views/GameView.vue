<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'
import { GAMES_CATALOG } from '../games/catalog'

const props = defineProps(['profile'])
const emit = defineEmits(['refresh-profile'])
const route = useRoute()

const slug = computed(() => String(route.params.slug))
const salonCode = computed(() => route.query.salon ? String(route.query.salon).toUpperCase() : null)
const gameInfo = computed(() => GAMES_CATALOG.find(g => g.slug === slug.value) || GAMES_CATALOG[0])

const room = ref(null)
const myRole = computed(() => (!room.value || !props.profile) ? 'solo' : (room.value.host_id === props.profile.id ? 'hote' : 'invite'))
const soundEnabled = ref(true)
const hintText = ref('')
const victoryBanner = ref('')
const finished = ref(false)
const canvasRef = ref(null)
const domRef = ref(null)

let roomSub = null
let pollTimer = null
let rafId = null

const isDomGame = computed(() => ['morpion', 'puissance-4', 'uno', 'ludo', 'pfc', 'plus-ou-moins', 'quiz-geek'].includes(slug.value))

// Synthétiseur audio Web Audio API
let audioCtx = null
function playSound(type) {
  if (!soundEnabled.value) return
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)

  if (type === 'hit') {
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(240, now)
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08)
    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
    osc.start(now); osc.stop(now + 0.08)
  } else if (type === 'pop') {
    osc.type = 'sine'
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.07)
    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07)
    osc.start(now); osc.stop(now + 0.07)
  } else if (type === 'score') {
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(523, now)
    osc.frequency.setValueAtTime(784, now + 0.12)
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
    osc.start(now); osc.stop(now + 0.25)
  }
}

function copierCode() {
  navigator.clipboard.writeText(salonCode.value)
  alert('Code ' + salonCode.value + ' copié ! Envoie-le à ton ami.')
}

async function loadRoom() {
  if (!salonCode.value) return
  const { data } = await supabase.from('rooms').select('*').eq('code', salonCode.value).single()
  if (data) room.value = data
}

async function updateRoomState(newState, isDone = false, ptsHote = 50, ptsInvite = 50) {
  if (!room.value) return
  await supabase.from('rooms').update({
    state: newState,
    status: isDone ? 'termine' : 'en_cours'
  }).eq('id', room.value.id)

  if (isDone) {
    try {
      await supabase.rpc('increment_score', { row_id: room.value.host_id, pts: ptsHote })
      if (room.value.guest_id) await supabase.rpc('increment_score', { row_id: room.value.guest_id, pts: ptsInvite })
      emit('refresh-profile')
    } catch {}
  }
}

async function finishSoloOrDuel(points, message) {
  if (finished.value) return
  finished.value = true
  playSound('score')

  if (salonCode.value && room.value) {
    const st = { ...room.value.state }
    if (myRole.value === 'hote') { st.hote_fini = true; st.score_hote = points }
    else { st.invite_fini = true; st.score_invite = points }
    const both = st.hote_fini && st.invite_fini
    const ptsH = (st.score_hote || 0) >= (st.score_invite || 0) ? 180 : 60
    const ptsI = (st.score_invite || 0) >= (st.score_hote || 0) ? 180 : 60
    await updateRoomState(st, both, ptsH, ptsI)
    victoryBanner.value = both
      ? `🏆 Duel terminé ! ${room.value.host_pseudo} (${st.score_hote}) vs ${room.value.guest_pseudo} (${st.score_invite})`
      : `✅ ${message} (${points} pts) — En attente de ton ami...`
    return
  }

  if (props.profile) {
    try {
      await supabase.rpc('increment_score', { row_id: props.profile.id, pts: points })
      emit('refresh-profile')
    } catch {}
  }
  victoryBanner.value = `🎉 ${message} (+${points} pts)`
}

// --- JEU 1 : MORPION (PvP + Solo) ---
const soloTttBoard = ref(Array(9).fill(''))
async function clickTtt(idx) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
  if (salonCode.value && room.value) {
    if (room.value.status !== 'en_cours') return
    const st = { ...room.value.state, board: [...room.value.state.board] }
    if (st.tour !== myRole.value || st.board[idx] || st.gagnant) return
    const sym = myRole.value === 'hote' ? 'X' : 'O'
    st.board[idx] = sym
    playSound('pop')
    if (lines.some(l => l.every(i => st.board[i] === sym))) {
      st.gagnant = (myRole.value === 'hote' ? room.value.host_pseudo : room.value.guest_pseudo) + ' gagne !'
    } else if (!st.board.includes('')) {
      st.gagnant = 'Match nul !'
    }
    st.tour = myRole.value === 'hote' ? 'invite' : 'hote'
    await updateRoomState(st, !!st.gagnant, 150, 150)
    return
  }

  if (soloTttBoard.value[idx] || finished.value) return
  soloTttBoard.value[idx] = 'X'
  playSound('pop')
  if (lines.some(l => l.every(i => soloTttBoard.value[i] === 'X'))) return finishSoloOrDuel(130, 'Victoire au Morpion !')
  const free = soloTttBoard.value.map((v, i) => v === '' ? i : -1).filter(x => x >= 0)
  if (!free.length) return finishSoloOrDuel(60, 'Match nul !')
  soloTttBoard.value[free[Math.floor(Math.random() * free.length)]] = 'O'
  if (lines.some(l => l.every(i => soloTttBoard.value[i] === 'O'))) return finishSoloOrDuel(30, 'Défaite au Morpion !')
}

// --- JEU 2 : PUISSANCE 4 (PvP + Solo) ---
const soloC4 = ref(Array.from({ length: 6 }, () => Array(7).fill(0)))
function checkC4(g, p) {
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    if (c < 4 && [0,1,2,3].every(k => g[r][c+k] === p)) return true
    if (r < 3 && [0,1,2,3].every(k => g[r+k][c] === p)) return true
    if (r < 3 && c < 4 && [0,1,2,3].every(k => g[r+k][c+k] === p)) return true
    if (r > 2 && c < 4 && [0,1,2,3].every(k => g[r-k][c+k] === p)) return true
  }
  return false
}
async function clickC4(col) {
  if (salonCode.value && room.value) {
    if (room.value.status !== 'en_cours') return
    const st = { ...room.value.state, grid: room.value.state.grid.map(r => [...r]) }
    const myNum = myRole.value === 'hote' ? 1 : 2
    if (st.tour !== myRole.value || st.gagnant) return
    let ok = false
    for (let r = 5; r >= 0; r--) if (!st.grid[r][col]) { st.grid[r][col] = myNum; ok = true; break }
    if (!ok) return
    playSound('pop')
    if (checkC4(st.grid, myNum)) st.gagnant = (myNum === 1 ? room.value.host_pseudo : room.value.guest_pseudo) + ' gagne !'
    st.tour = myRole.value === 'hote' ? 'invite' : 'hote'
    await updateRoomState(st, !!st.gagnant, 180, 180)
    return
  }

  if (finished.value) return
  let ok = false
  for (let r = 5; r >= 0; r--) if (!soloC4.value[r][col]) { soloC4.value[r][col] = 1; ok = true; break }
  if (!ok) return
  playSound('pop')
  if (checkC4(soloC4.value, 1)) return finishSoloOrDuel(180, 'Puissance 4 ! Victoire !')
  const cols = [0,1,2,3,4,5,6].filter(c => !soloC4.value[0][c])
  if (cols.length) {
    const aiCol = cols[Math.floor(Math.random() * cols.length)]
    for (let r = 5; r >= 0; r--) if (!soloC4.value[r][aiCol]) { soloC4.value[r][aiCol] = 2; break }
    if (checkC4(soloC4.value, 2)) return finishSoloOrDuel(35, 'L’IA aligne 4 jetons !')
  }
}

// --- JEU 3 : PIERRE FEUILLE CISEAUX (PvP + Solo) ---
const soloPfc = ref({ hpP: 100, hpA: 100, info: 'Choisis ton attaque :' })
async function playPfc(choix) {
  playSound('pop')
  if (salonCode.value && room.value) {
    const st = { ...room.value.state }
    if (st.gagnant) return
    if (myRole.value === 'hote') st.choix_hote = choix
    else st.choix_invite = choix
    if (st.choix_hote && st.choix_invite) {
      const h = st.choix_hote, i = st.choix_invite
      if (h === i) st.info = `Égalité (${h}) !`
      else if ((h==='Pierre'&&i==='Ciseaux')||(h==='Feuille'&&i==='Pierre')||(h==='Ciseaux'&&i==='Feuille')) {
        st.hp_invite = Math.max(0, (st.hp_invite ?? 100) - 34)
        st.info = `${room.value.host_pseudo} frappe avec ${h} (-34 PV) !`
      } else {
        st.hp_hote = Math.max(0, (st.hp_hote ?? 100) - 34)
        st.info = `${room.value.guest_pseudo} frappe avec ${i} (-34 PV) !`
      }
      st.choix_hote = null; st.choix_invite = null
      if (st.hp_invite <= 0) st.gagnant = room.value.host_pseudo + ' gagne !'
      if (st.hp_hote <= 0) st.gagnant = room.value.guest_pseudo + ' gagne !'
    }
    await updateRoomState(st, !!st.gagnant, 160, 160)
    return
  }

  if (finished.value) return
  const opts = ['Pierre', 'Feuille', 'Ciseaux']
  const ai = opts[Math.floor(Math.random() * 3)]
  if (choix === ai) soloPfc.value.info = `Égalité (${choix}) !`
  else if ((choix==='Pierre'&&ai==='Ciseaux')||(choix==='Feuille'&&ai==='Pierre')||(choix==='Ciseaux'&&ai==='Feuille')) {
    soloPfc.value.hpA = Math.max(0, soloPfc.value.hpA - 34)
    soloPfc.value.info = `Touché ! ${choix} bat ${ai} (-34 PV)`
  } else {
    soloPfc.value.hpP = Math.max(0, soloPfc.value.hpP - 34)
    soloPfc.value.info = `Aïe ! ${ai} bat ${choix} (-34 PV)`
  }
  if (soloPfc.value.hpA <= 0) finishSoloOrDuel(160, 'K.O. ! Victoire !')
  else if (soloPfc.value.hpP <= 0) finishSoloOrDuel(35, 'K.O. ! Défaite !')
}

// --- JEU 4 : PLUS OU MOINS ---
const pomTarget = Math.floor(Math.random() * 100) + 1
const pomInput = ref('')
const pomHistory = ref([])
function testPom() {
  const v = Number(pomInput.value)
  if (!v || v < 1 || v > 100 || finished.value) return
  pomInput.value = ''
  if (v === pomTarget) return finishSoloOrDuel(Math.max(50, 200 - pomHistory.value.length * 20), `Nombre ${pomTarget} trouvé !`)
  pomHistory.value.push(`${v} (${v < pomTarget ? '⬆️ Plus' : '⬇️ Moins'})`)
  playSound('pop')
  if (pomHistory.value.length >= 7) finishSoloOrDuel(25, `Perdu ! C'était ${pomTarget}.`)
}

// --- JEU 5 : QUIZ GEEK ---
const quizQuestions = [
  { q: 'Quel port réseau utilise HTTPS par défaut ?', a: ['80', '443', '22', '3306'], ok: 1 },
  { q: 'Quelle commande Docker liste les conteneurs actifs ?', a: ['docker ps', 'docker init', 'docker build', 'docker pull'], ok: 0 },
  { q: 'Quelle instruction SQL supprime des lignes ?', a: ['DROP', 'REMOVE', 'DELETE', 'TRUNCATE'], ok: 2 },
  { q: 'Quel protocole attribue une IP automatiquement ?', a: ['DNS', 'ARP', 'DHCP', 'ICMP'], ok: 2 },
  { q: 'Quel code HTTP signifie "Page introuvable" ?', a: ['200', '301', '403', '404'], ok: 3 }
]
const quizIdx = ref(0)
const quizScore = ref(0)
function answerQuiz(i) {
  if (finished.value) return
  if (i === quizQuestions[quizIdx.value].ok) { quizScore.value += 35; playSound('score') }
  else playSound('hit')
  quizIdx.value++
  if (quizIdx.value >= quizQuestions.length) finishSoloOrDuel(Math.max(30, quizScore.value), `Quiz terminé : ${quizScore.value} pts !`)
}

// --- MOTEUR CANVAS POUR LES JEUX SPORT & ARCADE ---
function bootCanvasGame() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const s = slug.value

  if (s === 'ping-pong') {
    hintText.value = 'Déplace la souris verticalement pour renvoyer la balle (Premier à 5) !'
    let py = 185, ay = 185, b = { x: 380, y: 230, vx: 6, vy: 3.5 }, ps = 0, as = 0
    canvas.onmousemove = e => { const r = canvas.getBoundingClientRect(); py = Math.max(10, Math.min(360, (e.clientY - r.top) * (460 / r.height) - 45)) }
    const loop = () => {
      ctx.fillStyle = '#0e7490'; ctx.fillRect(0, 0, 760, 460)
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(378, 0, 4, 460)
      ay += (b.y - (ay + 45)) * 0.09
      b.x += b.vx; b.y += b.vy
      if (b.y < 12 || b.y > 448) { b.vy *= -1; playSound('hit') }
      if (b.x < 36 && b.y > py && b.y < py + 90) { b.vx = Math.abs(b.vx) * 1.04; playSound('hit') }
      if (b.x > 724 && b.y > ay && b.y < ay + 90) { b.vx = -Math.abs(b.vx) * 1.04; playSound('hit') }
      if (b.x < 0) { as++; b = { x: 380, y: 230, vx: 6, vy: 3 } }
      if (b.x > 760) { ps++; b = { x: 380, y: 230, vx: -6, vy: -3 } }
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(20, py, 14, 90)
      ctx.fillStyle = '#f43f5e'; ctx.fillRect(726, ay, 14, 90)
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(b.x, b.y, 10, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.fillText(`${ps} - ${as}`, 345, 42)
      if (ps >= 5 || as >= 5) finishSoloOrDuel(ps >= 5 ? 160 : 40, ps >= 5 ? `Victoire ${ps}-${as} !` : `Défaite ${ps}-${as}`)
      if (!finished.value) rafId = requestAnimationFrame(loop)
    }
    loop()
    return
  }

  if (s === 'snake-neon') {
    hintText.value = 'Flèches directionnelles pour guider le serpent !'
    let snake = [{ x: 10, y: 11 }, { x: 9, y: 11 }], dir = { x: 1, y: 0 }, food = { x: 18, y: 11 }, pts = 0, tick = 0
    window.onkeydown = e => {
      if (e.key === 'ArrowUp' && dir.y === 0) dir = { x: 0, y: -1 }
      if (e.key === 'ArrowDown' && dir.y === 0) dir = { x: 0, y: 1 }
      if (e.key === 'ArrowLeft' && dir.x === 0) dir = { x: -1, y: 0 }
      if (e.key === 'ArrowRight' && dir.x === 0) dir = { x: 1, y: 0 }
    }
    const loop = () => {
      tick++
      if (tick % 6 === 0) {
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }
        if (head.x < 0 || head.x >= 38 || head.y < 0 || head.y >= 23 || snake.some(k => k.x === head.x && k.y === head.y)) {
          return finishSoloOrDuel(pts + 20, `Snake terminé : ${pts} pts !`)
        }
        snake.unshift(head)
        if (head.x === food.x && head.y === food.y) { pts += 20; playSound('pop'); food = { x: Math.floor(Math.random() * 38), y: Math.floor(Math.random() * 23) } }
        else snake.pop()
      }
      ctx.fillStyle = '#090d16'; ctx.fillRect(0, 0, 760, 460)
      ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(food.x * 20 + 10, food.y * 20 + 10, 8, 0, Math.PI * 2); ctx.fill()
      snake.forEach((k, i) => { ctx.fillStyle = i === 0 ? '#4ade80' : '#16a34a'; ctx.fillRect(k.x * 20 + 1, k.y * 20 + 1, 18, 18) })
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.fillText(`Score : ${pts}`, 16, 26)
      if (!finished.value) rafId = requestAnimationFrame(loop)
    }
    loop()
    return
  }

  // Arène interactive commune pour les autres jeux Sport/Arcade (clics / tirs de précision)
  hintText.value = `Clique sur les cibles lumineuses de ${gameInfo.value.nom} le plus vite possible (15 secondes) !`
  let score = 0, start = Date.now(), target = { x: 380, y: 230, r: 28 }
  canvas.onmousedown = e => {
    if (finished.value) return
    const r = canvas.getBoundingClientRect()
    const mx = (e.clientX - r.left) * (760 / r.width)
    const my = (e.clientY - r.top) * (460 / r.height)
    if (Math.hypot(mx - target.x, my - target.y) <= target.r + 8) {
      score += 18; playSound('pop')
      target = { x: 60 + Math.random() * 640, y: 60 + Math.random() * 340, r: 24 }
    }
  }
  const loop = () => {
    const left = Math.max(0, 15 - (Date.now() - start) / 1000)
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 760, 460)
    ctx.fillStyle = gameInfo.value.couleur
    ctx.beginPath(); ctx.arc(target.x, target.y, target.r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'
    ctx.fillText(`Temps : ${left.toFixed(1)}s · Score : ${score} pts`, 22, 34)
    if (left <= 0) return finishSoloOrDuel(Math.max(30, score), `Partie terminée : ${score} pts !`)
    if (!finished.value) rafId = requestAnimationFrame(loop)
  }
  loop()
}

onMounted(async () => {
  await loadRoom()
  if (salonCode.value) {
    roomSub = supabase.channel(`room-${salonCode.value}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${salonCode.value}` }, (payload) => {
        room.value = payload.new
      })
      .subscribe()
    pollTimer = setInterval(loadRoom, 2000)
  }
  if (!isDomGame.value) setTimeout(bootCanvasGame, 100)
})

onUnmounted(() => {
  if (roomSub) supabase.removeChannel(roomSub)
  if (pollTimer) clearInterval(pollTimer)
  if (rafId) cancelAnimationFrame(rafId)
  window.onkeydown = null
})
</script>

<template>
  <div class="arena">
    <div class="arena-top">
      <div style="display:flex;align-items:center;gap:12px;">
        <img :src="`/img/jeux/${gameInfo.slug}.svg`" style="width:68px;height:42px;border-radius:10px;object-fit:cover;" />
        <div>
          <h2>{{ gameInfo.nom }}</h2>
          <small>{{ salonCode ? 'Salon privé temps réel' : gameInfo.categorie }}</small>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn-ghost" @click="soundEnabled = !soundEnabled">{{ soundEnabled ? '🔊 Son' : '🔇 Muet' }}</button>
        <router-link to="/" class="btn-primary">← Lobby</router-link>
      </div>
    </div>

    <div v-if="salonCode && room" class="salon-hud">
      <div>
        Code d'invitation : <span class="code-badge">{{ salonCode }}</span>
        <button @click="copierCode" class="btn-copy">📋 Copier</button>
      </div>
      <strong>👑 {{ room.host_pseudo }} vs 🎮 {{ room.guest_pseudo || 'En attente...' }}</strong>
    </div>

    <div class="stage">
      <div v-if="salonCode && room?.status === 'attente'" class="wait-box">
        <h3>⏳ En attente de ton ami...</h3>
        <p>Envoie le code <strong>{{ salonCode }}</strong> à ton ami : dès qu'il rejoint, la partie démarre instantanément !</p>
      </div>

      <!-- MORPION -->
      <div v-else-if="slug === 'morpion'" class="dom-box">
        <p class="turn-msg">{{ salonCode && room ? (room.state.gagnant || (room.state.tour === myRole ? 'À toi de jouer !' : 'Tour de ton ami...')) : 'Aligne 3 X pour gagner !' }}</p>
        <div class="ttt-grid">
          <div v-for="(cell, i) in (salonCode && room ? room.state.board : soloTttBoard)" :key="i" class="ttt-cell" @click="clickTtt(i)">
            {{ cell }}
          </div>
        </div>
      </div>

      <!-- PUISSANCE 4 -->
      <div v-else-if="slug === 'puissance-4'" class="dom-box">
        <p class="turn-msg">{{ salonCode && room ? (room.state.gagnant || (room.state.tour === myRole ? 'À toi de jouer !' : 'Tour de ton ami...')) : 'Clique sur une colonne pour aligner 4 jetons !' }}</p>
        <div class="c4-grid">
          <template v-for="(row, r) in (salonCode && room ? room.state.grid : soloC4)" :key="r">
            <div v-for="(v, c) in row" :key="`${r}-${c}`" class="c4-cell"
                 :style="{ background: v === 1 ? '#ef4444' : (v === 2 ? '#fbbf24' : '#0b0e1a') }"
                 @click="clickC4(c)"></div>
          </template>
        </div>
      </div>

      <!-- PIERRE FEUILLE CISEAUX -->
      <div v-else-if="slug === 'pfc'" class="dom-box">
        <p class="turn-msg">{{ salonCode && room ? (room.state.gagnant || room.state.info) : soloPfc.info }}</p>
        <p v-if="salonCode && room">❤️ Hôte : {{ room.state.hp_hote ?? 100 }} PV · Invité : {{ room.state.hp_invite ?? 100 }} PV</p>
        <p v-else>❤️ Toi : {{ soloPfc.hpP }} PV · IA : {{ soloPfc.hpA }} PV</p>
        <div style="display:flex;gap:12px;">
          <button class="btn-primary" @click="playPfc('Pierre')">✊ Pierre</button>
          <button class="btn-primary" @click="playPfc('Feuille')">✋ Feuille</button>
          <button class="btn-primary" @click="playPfc('Ciseaux')">✌️ Ciseaux</button>
        </div>
      </div>

      <!-- PLUS OU MOINS -->
      <div v-else-if="slug === 'plus-ou-moins'" class="dom-box">
        <p class="turn-msg">Trouve le nombre mystère (1 à 100) en 7 essais !</p>
        <div style="display:flex;gap:10px;">
          <input v-model="pomInput" type="number" min="1" max="100" class="num-input" @keydown.enter="testPom" />
          <button class="btn-primary" @click="testPom">Tester</button>
        </div>
        <p>{{ pomHistory.join(' · ') }}</p>
      </div>

      <!-- QUIZ GEEK -->
      <div v-else-if="slug === 'quiz-geek' && quizIdx < quizQuestions.length" class="dom-box">
        <p class="turn-msg">Question {{ quizIdx + 1 }}/{{ quizQuestions.length }}</p>
        <h3>{{ quizQuestions[quizIdx].q }}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:460px;">
          <button v-for="(ans, i) in quizQuestions[quizIdx].a" :key="i" class="btn-ghost" @click="answerQuiz(i)">{{ ans }}</button>
        </div>
      </div>

      <!-- JEUX CANVAS SPORT & ARCADE -->
      <canvas v-else ref="canvasRef" width="760" height="460" style="max-width:100%;border-radius:16px;"></canvas>

      <p v-if="hintText" style="color:#94a3b8;font-size:0.88rem;margin-top:10px;">{{ hintText }}</p>
      <div v-if="victoryBanner" class="victory-box">
        <strong>{{ victoryBanner }}</strong>
        <router-link to="/" class="btn-primary" style="margin-left:12px;">Retour au lobby</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arena { max-width: 840px; margin: 24px auto; padding: 0 16px; }
.arena-top { background: #14192d; padding: 14px 20px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.btn-ghost { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 9px 14px; border-radius: 10px; cursor: pointer; font-weight: 700; }
.salon-hud { background: linear-gradient(135deg, #1e1b4b, #172554); padding: 14px 20px; border-radius: 16px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; }
.code-badge { background: #0b0e1a; color: #fbbf24; border: 1px dashed #818cf8; padding: 5px 12px; border-radius: 8px; font-family: monospace; font-size: 1.2rem; font-weight: 800; letter-spacing: 3px; }
.btn-copy { margin-left: 8px; background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; }
.stage { background: #0f1424; border-radius: 22px; min-height: 420px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; border: 1px solid rgba(255,255,255,0.08); }
.dom-box, .wait-box { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.ttt-grid { display: grid; grid-template-columns: repeat(3, 92px); gap: 10px; }
.ttt-cell { width: 92px; height: 92px; background: #1b223c; border-radius: 16px; display: grid; place-items: center; font-size: 2.4rem; font-weight: 900; color: #38bdf8; cursor: pointer; }
.c4-grid { display: grid; grid-template-columns: repeat(7, 46px); gap: 7px; background: #1d4ed8; padding: 12px; border-radius: 16px; }
.c4-cell { width: 46px; height: 46px; border-radius: 50%; cursor: pointer; }
.num-input { width: 120px; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: #0b0e1a; color: #fff; text-align: center; font-weight: 800; }
.turn-msg { color: #fbbf24; font-weight: 800; }
.victory-box { margin-top: 16px; background: rgba(16,185,129,0.2); border: 1px solid #10b981; padding: 14px 20px; border-radius: 14px; }
</style>