<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'solo' }, // 'solo' | 'multi'
  playerPseudo: { type: String, default: 'boztas' },
  opponentPseudo: { type: String, default: 'readper' },
  roomState: { type: Object, default: null },
  isHost: { type: Boolean, default: true }
})

const emit = defineEmits(['sync-state', 'win'])

// ÉTAPES AVANT MATCH (comme sur tes captures : Formation -> Stade -> Équipe -> Jeu)
const phase = ref('formation') // 'formation' | 'stadium' | 'team' | 'playing' | 'gameover'
const prepTimer = ref(31)
let prepInterval = null

// 1. FORMATIONS (Attaque & Défensif)
const FORMATIONS = [
  // ATTAQUE
  {
    id: 'att-1-3-2',
    category: 'ATTAQUE',
    name: '1-3-2',
    points: [
      { x: 0.5, y: 0.93 },
      { x: 0.22, y: 0.72 }, { x: 0.5, y: 0.74 }, { x: 0.78, y: 0.72 },
      { x: 0.37, y: 0.55 }, { x: 0.63, y: 0.55 }
    ]
  },
  {
    id: 'att-1-2-3',
    category: 'ATTAQUE',
    name: '1-2-3',
    points: [
      { x: 0.5, y: 0.93 },
      { x: 0.36, y: 0.75 }, { x: 0.64, y: 0.75 },
      { x: 0.22, y: 0.57 }, { x: 0.5, y: 0.60 }, { x: 0.78, y: 0.57 }
    ]
  },
  {
    id: 'att-1-4-1',
    category: 'ATTAQUE',
    name: '1-4-1',
    points: [
      { x: 0.5, y: 0.93 },
      { x: 0.18, y: 0.68 }, { x: 0.39, y: 0.72 }, { x: 0.61, y: 0.72 }, { x: 0.82, y: 0.68 },
      { x: 0.5, y: 0.55 }
    ]
  },
  {
    id: 'att-1-2-1-2',
    category: 'ATTAQUE',
    name: '1-2-1-2',
    points: [
      { x: 0.5, y: 0.93 },
      { x: 0.32, y: 0.78 }, { x: 0.68, y: 0.78 },
      { x: 0.5, y: 0.66 },
      { x: 0.34, y: 0.55 }, { x: 0.66, y: 0.55 }
    ]
  },
  // DÉFENSIF
  {
    id: 'def-1-3-2',
    category: 'DÉFENSIF',
    name: '1-3-2',
    points: [
      { x: 0.5, y: 0.94 },
      { x: 0.24, y: 0.84 }, { x: 0.5, y: 0.85 }, { x: 0.76, y: 0.84 },
      { x: 0.35, y: 0.70 }, { x: 0.65, y: 0.70 }
    ]
  },
  {
    id: 'def-1-2-3',
    category: 'DÉFENSIF',
    name: '1-2-3',
    points: [
      { x: 0.5, y: 0.94 },
      { x: 0.36, y: 0.86 }, { x: 0.64, y: 0.86 },
      { x: 0.22, y: 0.72 }, { x: 0.5, y: 0.73 }, { x: 0.78, y: 0.72 }
    ]
  },
  {
    id: 'def-1-4-1',
    category: 'DÉFENSIF',
    name: '1-4-1',
    points: [
      { x: 0.5, y: 0.94 },
      { x: 0.19, y: 0.83 }, { x: 0.39, y: 0.85 }, { x: 0.61, y: 0.85 }, { x: 0.81, y: 0.83 },
      { x: 0.5, y: 0.64 }
    ]
  },
  {
    id: 'def-1-2-1-2',
    category: 'DÉFENSIF',
    name: '1-2-1-2',
    points: [
      { x: 0.5, y: 0.94 },
      { x: 0.33, y: 0.87 }, { x: 0.67, y: 0.87 },
      { x: 0.5, y: 0.76 },
      { x: 0.34, y: 0.65 }, { x: 0.66, y: 0.65 }
    ]
  }
]

const selectedFormation = ref(FORMATIONS[0])
const oppFormation = ref(FORMATIONS[6]) // 1-4-1 défensif comme sur la capture 4

// 2. STADES
const STADIUMS = [
  {
    id: 'standard',
    name: 'Standard',
    turfA: '#558b2f',
    turfB: '#689f38',
    outerBg: '#467326',
    lineColor: 'rgba(255,255,255,0.85)',
    wallColor: '#cbd5e1',
    ballType: 'classic',
    previewBg: 'linear-gradient(135deg, #3f6d21, #6da33b)'
  },
  {
    id: 'retronica',
    name: 'Retronica',
    turfA: '#163832',
    turfB: '#1e463e',
    outerBg: '#2b303a',
    lineColor: '#5eead4',
    wallColor: '#94a3b8',
    ballType: 'retro',
    previewBg: 'linear-gradient(135deg, #1b2826, #2d4c45)'
  },
  {
    id: 'creepy',
    name: 'Creepy Entrance',
    turfA: '#3b0d11',
    turfB: '#4a1217',
    outerBg: '#1f0709',
    lineColor: 'rgba(248,113,113,0.65)',
    wallColor: '#7f1d1d',
    ballType: 'eye',
    previewBg: 'linear-gradient(135deg, #2b090c, #59141a)'
  },
  {
    id: 'woodland',
    name: 'Woodland Stories',
    turfA: '#3f2e21',
    turfB: '#4e3929',
    outerBg: '#261b12',
    lineColor: 'rgba(253,224,71,0.65)',
    wallColor: '#78350f',
    ballType: 'mushroom',
    previewBg: 'linear-gradient(135deg, #2d2016, #5c4028)'
  }
]
const selectedStadium = ref(STADIUMS[0])

// 3. ÉQUIPES (Régulier & Premium)
const teamTab = ref('regular')
const TEAMS = [
  { id: 'turkey', name: 'Turkey', tab: 'regular', bg: '#e30a17', type: 'tr' },
  { id: 'france', name: 'France', tab: 'regular', colors: ['#002395', '#ffffff', '#ed2939'], type: 'v3' },
  { id: 'indonesia', name: 'Indonesia', tab: 'regular', colors: ['#ce1126', '#ffffff'], type: 'h2' },
  { id: 'iran', name: 'Iran', tab: 'regular', colors: ['#239f40', '#ffffff', '#da0000'], type: 'h3', emblem: '☫' },
  { id: 'italy', name: 'Italy', tab: 'regular', colors: ['#009246', '#ffffff', '#ce2b37'], type: 'v3' },
  { id: 'japan', name: 'Japan', tab: 'regular', bg: '#ffffff', dot: '#bc002d', type: 'dot' },
  { id: 'malaysia', name: 'Malaysia', tab: 'regular', bg: '#cc0001', canton: '#010066', type: 'stripes' },
  { id: 'mexico', name: 'Mexico', tab: 'regular', colors: ['#006847', '#ffffff', '#ce1126'], type: 'v3', emblem: '🦅' },
  { id: 'morocco', name: 'Morocco', tab: 'regular', bg: '#c1272d', star: '#006233', type: 'star' },
  { id: 'nigeria', name: 'Nigeria', tab: 'regular', colors: ['#008751', '#ffffff', '#008751'], type: 'v3' },
  { id: 'peru', name: 'Peru', tab: 'regular', colors: ['#d91023', '#ffffff', '#d91023'], type: 'v3' },
  { id: 'portugal', name: 'Portugal', tab: 'regular', colors: ['#006600', '#ff0000'], type: 'pt' },
  { id: 'saudi', name: 'Saudi Arabia', tab: 'regular', bg: '#006c35', emblem: '⚔️', type: 'solid' },
  { id: 'korea', name: 'South Korea', tab: 'regular', bg: '#ffffff', dot: '#cd2e3a', type: 'dot' },
  { id: 'spain', name: 'Spain', tab: 'regular', colors: ['#aa151b', '#f1bf00', '#aa151b'], type: 'spain' },
  { id: 'sweden', name: 'Sweden', tab: 'regular', bg: '#006aa7', cross: '#fecc02', type: 'cross' },
  { id: 'tunisia', name: 'Tunisia', tab: 'regular', bg: '#e70013', type: 'tn' },
  { id: 'ukraine', name: 'Ukraine', tab: 'regular', colors: ['#0057b7', '#ffd700'], type: 'h2' },
  { id: 'vietnam', name: 'Vietnam', tab: 'regular', bg: '#da251d', star: '#ffff00', type: 'star' },
  { id: 'poland', name: 'Poland', tab: 'regular', colors: ['#ffffff', '#dc143c'], type: 'h2' },
  { id: 'usa', name: 'USA', tab: 'regular', bg: '#b22234', canton: '#3c3b6e', type: 'stripes' },
  // Premium
  { id: 'brazil', name: 'Brazil', tab: 'premium', bg: '#009c3b', diamond: '#ffdf00', dot: '#002776', type: 'br' },
  { id: 'germany', name: 'Germany', tab: 'premium', colors: ['#000000', '#dd0000', '#ffce00'], type: 'h3' },
  { id: 'argentina', name: 'Argentina', tab: 'premium', colors: ['#74acdf', '#ffffff', '#74acdf'], type: 'h3', emblem: '☀️' }
]

const selectedTeam = ref(TEAMS[0]) // Turkey par défaut
const opponentTeam = ref(TEAMS.find(t => t.id === 'spain')) // Spain comme sur ta capture

const filteredTeams = computed(() => TEAMS.filter(t => t.tab === teamTab.value))

function startPrepCountdown(seconds, onExpire) {
  clearInterval(prepInterval)
  prepTimer.value = seconds
  prepInterval = setInterval(() => {
    prepTimer.value--
    if (prepTimer.value <= 0) {
      clearInterval(prepInterval)
      onExpire()
    }
  }, 1000)
}

function confirmFormation() {
  phase.value = 'stadium'
  startPrepCountdown(28, confirmStadium)
}

function confirmStadium() {
  phase.value = 'team'
  startPrepCountdown(23, confirmTeam)
}

function confirmTeam() {
  clearInterval(prepInterval)
  phase.value = 'playing'
  initMatch()
}

// ==========================================
// MOTEUR DE JEU & PHYSIQUE 2D (CANVAS)
// ==========================================
const canvasRef = ref(null)
const GOALS_TO_WIN = 3
const myScore = ref(0)
const oppScore = ref(0)
const turn = ref('me') // 'me' | 'opp'
const turnTimeLeft = ref(100)
const goalBanner = ref('')
const winner = ref(null)

// Réactions rapides
const showEmojiMenu = ref(false)
const activeReaction = ref(null)
const EMOJIS = ['🙂', '🔥', '😱', '👏', '😂', '😡']

// Dimensions logiques du canvas
const W = 380
const H = 560
const PITCH = { x: 42, y: 26, w: 296, h: 508 }
const GOAL_W = 104
const GOAL_DEPTH = 18
const PUCK_R = 17
const BALL_R = 10

let pucks = []
let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: BALL_R, mass: 1 }
let isMoving = false
let dragPuck = null
let dragCurrent = { x: 0, y: 0 }
let animFrameId = null
let turnTimerId = null
let botTimeoutId = null
let glowPulse = 0

function initMatch() {
  myScore.value = 0
  oppScore.value = 0
  winner.value = null
  turn.value = 'me'
  resetPositions()
  startTurnTimer()
  startLoop()
  pushMultiplayerState()
}

function resetPositions() {
  pucks = []
  // Équipe du joueur (en bas)
  selectedFormation.value.points.forEach((pt, idx) => {
    pucks.push({
      id: `me-${idx}`,
      owner: 'me',
      team: selectedTeam.value,
      x: PITCH.x + pt.x * PITCH.w,
      y: PITCH.y + pt.y * PITCH.h,
      vx: 0,
      vy: 0,
      r: PUCK_R,
      mass: 2.3
    })
  })
  // Équipe adverse (en haut, miroir)
  oppFormation.value.points.forEach((pt, idx) => {
    pucks.push({
      id: `opp-${idx}`,
      owner: 'opp',
      team: opponentTeam.value,
      x: PITCH.x + (1 - pt.x) * PITCH.w,
      y: PITCH.y + (1 - pt.y) * PITCH.h,
      vx: 0,
      vy: 0,
      r: PUCK_R,
      mass: 2.3
    })
  })
  ball = {
    x: PITCH.x + PITCH.w / 2,
    y: PITCH.y + PITCH.h / 2,
    vx: 0,
    vy: 0,
    r: BALL_R,
    mass: 1.0
  }
  isMoving = false
  dragPuck = null
}

function startTurnTimer() {
  clearInterval(turnTimerId)
  turnTimeLeft.value = 100
  if (phase.value !== 'playing') return
  turnTimerId = setInterval(() => {
    if (isMoving || goalBanner.value) return
    turnTimeLeft.value -= 2.5
    if (turnTimeLeft.value <= 0) {
      clearInterval(turnTimerId)
      switchTurn(turn.value === 'me' ? 'opp' : 'me')
    }
  }, 400)
}

function switchTurn(nextWho) {
  turn.value = nextWho
  startTurnTimer()
  pushMultiplayerState()
  if (nextWho === 'opp' && props.mode === 'solo' && phase.value === 'playing') {
    botTimeoutId = setTimeout(executeBotShot, 950)
  }
}

function executeBotShot() {
  if (turn.value !== 'opp' || isMoving || phase.value !== 'playing') return
  const oppPucks = pucks.filter(p => p.owner === 'opp')
  // Choisir le pion le plus proche du ballon
  let best = oppPucks[0]
  let bestDist = Infinity
  for (const p of oppPucks) {
    const d = Math.hypot(ball.x - p.x, ball.y - p.y)
    if (d < bestDist) {
      bestDist = d
      best = p
    }
  }
  // Viser un point légèrement derrière le ballon en direction du but du joueur (en bas)
  const goalX = PITCH.x + PITCH.w / 2 + (Math.random() - 0.5) * 40
  const goalY = PITCH.y + PITCH.h
  const toGoalAngle = Math.atan2(goalY - ball.y, goalX - ball.x)
  const targetX = ball.x - Math.cos(toGoalAngle) * (BALL_R + PUCK_R * 0.6)
  const targetY = ball.y - Math.sin(toGoalAngle) * (BALL_R + PUCK_R * 0.6)

  const shotAngle = Math.atan2(targetY - best.y, targetX - best.x)
  const power = 13.5 + Math.random() * 3.5
  best.vx = Math.cos(shotAngle) * power
  best.vy = Math.sin(shotAngle) * power
  isMoving = true
  pushMultiplayerState()
}

// CONTRÔLES TACTILES & SOURIS
function getCanvasCoords(e) {
  const rect = canvasRef.value.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H
  }
}

function onPointerDown(e) {
  if (phase.value !== 'playing' || turn.value !== 'me' || isMoving || goalBanner.value) return
  const pos = getCanvasCoords(e)
  for (const p of pucks) {
    if (p.owner === 'me' && Math.hypot(pos.x - p.x, pos.y - p.y) <= p.r + 12) {
      dragPuck = p
      dragCurrent = { ...pos }
      break
    }
  }
}

function onPointerMove(e) {
  if (!dragPuck) return
  dragCurrent = getCanvasCoords(e)
}

function onPointerUp() {
  if (!dragPuck) return
  const dx = dragPuck.x - dragCurrent.x
  const dy = dragPuck.y - dragCurrent.y
  const dist = Math.hypot(dx, dy)
  if (dist > 10) {
    const clamped = Math.min(dist, 95)
    const power = (clamped / 95) * 17.5
    const angle = Math.atan2(dy, dx)
    dragPuck.vx = Math.cos(angle) * power
    dragPuck.vy = Math.sin(angle) * power
    isMoving = true
    pushMultiplayerState()
  }
  dragPuck = null
}

// BOUCLE PHYSIQUE
function updatePhysics() {
  glowPulse += 0.08
  if (!isMoving) return

  const entities = [...pucks, ball]
  const FRICTION = 0.984
  const SUBSTEPS = 4

  for (let step = 0; step < SUBSTEPS; step++) {
    for (const ent of entities) {
      ent.x += ent.vx / SUBSTEPS
      ent.y += ent.vy / SUBSTEPS
    }

    // Collisions entre entités
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        resolveCircleCollision(entities[i], entities[j])
      }
    }

    // Rebonds sur les bandes du terrain
    const goalLeft = PITCH.x + (PITCH.w - GOAL_W) / 2
    const goalRight = goalLeft + GOAL_W

    for (const ent of entities) {
      // Murs gauche / droite
      if (ent.x - ent.r < PITCH.x) {
        ent.x = PITCH.x + ent.r
        ent.vx = Math.abs(ent.vx) * 0.85
      } else if (ent.x + ent.r > PITCH.x + PITCH.w) {
        ent.x = PITCH.x + PITCH.w - ent.r
        ent.vx = -Math.abs(ent.vx) * 0.85
      }

      const inGoalX = ent.x > goalLeft + ent.r * 0.4 && ent.x < goalRight - ent.r * 0.4

      // Mur haut
      if (ent.y - ent.r < PITCH.y) {
        if (ent === ball && inGoalX) {
          if (ent.y < PITCH.y - 4) {
            handleGoalScored('me')
            return
          }
        } else {
          ent.y = PITCH.y + ent.r
          ent.vy = Math.abs(ent.vy) * 0.85
        }
      }

      // Mur bas
      if (ent.y + ent.r > PITCH.y + PITCH.h) {
        if (ent === ball && inGoalX) {
          if (ent.y > PITCH.y + PITCH.h + 4) {
            handleGoalScored('opp')
            return
          }
        } else {
          ent.y = PITCH.y + PITCH.h - ent.r
          ent.vy = -Math.abs(ent.vy) * 0.85
        }
      }
    }
  }

  let anyMoving = false
  for (const ent of entities) {
    ent.vx *= FRICTION
    ent.vy *= FRICTION
    if (Math.hypot(ent.vx, ent.vy) < 0.09) {
      ent.vx = 0
      ent.vy = 0
    } else {
      anyMoving = true
    }
  }

  if (!anyMoving) {
    isMoving = false
    switchTurn(turn.value === 'me' ? 'opp' : 'me')
  }
}

function resolveCircleCollision(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)
  const minDist = a.r + b.r
  if (dist === 0 || dist >= minDist) return

  const nx = dx / dist
  const ny = dy / dist
  const overlap = minDist - dist
  const totalMass = a.mass + b.mass

  a.x -= nx * overlap * (b.mass / totalMass)
  a.y -= ny * overlap * (b.mass / totalMass)
  b.x += nx * overlap * (a.mass / totalMass)
  b.y += ny * overlap * (a.mass / totalMass)

  const rvx = b.vx - a.vx
  const rvy = b.vy - a.vy
  const velAlongNormal = rvx * nx + rvy * ny
  if (velAlongNormal > 0) return

  const restitution = 0.88
  const j = (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass)
  const impulseX = j * nx
  const impulseY = j * ny

  a.vx -= impulseX / a.mass
  a.vy -= impulseY / a.mass
  b.vx += impulseX / b.mass
  b.vy += impulseY / b.mass
}

function handleGoalScored(scorer) {
  isMoving = false
  if (scorer === 'me') myScore.value++
  else oppScore.value++

  if (myScore.value >= GOALS_TO_WIN || oppScore.value >= GOALS_TO_WIN) {
    winner.value = myScore.value >= GOALS_TO_WIN ? 'me' : 'opp'
    phase.value = 'gameover'
    clearInterval(turnTimerId)
    emit('win', { winner: winner.value, score: `${myScore.value}-${oppScore.value}` })
    pushMultiplayerState()
    return
  }

  goalBanner.value = scorer === 'me' ? 'BUT ! ⚽🔥' : 'BUT ADVERSE !'
  setTimeout(() => {
    goalBanner.value = ''
    resetPositions()
    switchTurn(scorer === 'me' ? 'opp' : 'me')
  }, 1500)
}

// RENDU GRAPHIQUE SUR CANVAS
function drawScene() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const st = selectedStadium.value

  ctx.clearRect(0, 0, W, H)

  // Pelouse extérieure
  ctx.fillStyle = st.outerBg
  ctx.fillRect(0, 0, W, H)

  // Tribunes latérales (comme sur la capture 4)
  drawGrandstands(ctx)

  // Bandes horizontales du terrain
  const stripes = 12
  const stripeH = PITCH.h / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? st.turfA : st.turfB
    ctx.fillRect(PITCH.x, PITCH.y + i * stripeH, PITCH.w, stripeH)
  }

  // Lignes blanches du terrain
  ctx.strokeStyle = st.lineColor
  ctx.lineWidth = 2
  ctx.strokeRect(PITCH.x, PITCH.y, PITCH.w, PITCH.h)

  // Ligne médiane & rond central
  ctx.beginPath()
  ctx.moveTo(PITCH.x, PITCH.y + PITCH.h / 2)
  ctx.lineTo(PITCH.x + PITCH.w, PITCH.y + PITCH.h / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(PITCH.x + PITCH.w / 2, PITCH.y + PITCH.h / 2, 42, 0, Math.PI * 2)
  ctx.stroke()

  // Surfaces de réparation haut et bas
  const boxW = 154
  const boxH = 56
  ctx.strokeRect(PITCH.x + (PITCH.w - boxW) / 2, PITCH.y, boxW, boxH)
  ctx.strokeRect(PITCH.x + (PITCH.w - boxW) / 2, PITCH.y + PITCH.h - boxH, boxW, boxH)

  // Bordures métalliques & Buts (filets haut et bas)
  drawWallsAndGoals(ctx, st)

  // Flèche de visée si le joueur tire un pion
  if (dragPuck) {
    const dx = dragPuck.x - dragCurrent.x
    const dy = dragPuck.y - dragCurrent.y
    const dist = Math.min(Math.hypot(dx, dy), 95)
    if (dist > 8) {
      const angle = Math.atan2(dy, dx)
      const tipX = dragPuck.x + Math.cos(angle) * (dist * 1.15)
      const tipY = dragPuck.y + Math.sin(angle) * (dist * 1.15)

      ctx.save()
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 4
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(dragPuck.x, dragPuck.y)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      // Pointe de flèche
      ctx.setLineDash([])
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(tipX, tipY, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Pions (avec halo cyan lumineux autour des pions du joueur actif comme sur la capture 4)
  for (const p of pucks) {
    drawPuck(ctx, p)
  }

  // Ballon selon le stade choisi
  drawBall(ctx, ball, st.ballType)
}

function drawGrandstands(ctx) {
  const standW = 22
  const positions = [8, W - 8 - standW]
  const crowdColors = ['#ef4444', '#3b82f6', '#facc15', '#ffffff', '#22c55e', '#f97316']
  positions.forEach((sx) => {
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(sx, PITCH.y - 6, standW, PITCH.h + 12)
    for (let y = PITCH.y; y < PITCH.y + PITCH.h; y += 6) {
      for (let x = sx + 3; x < sx + standW - 3; x += 5) {
        ctx.fillStyle = crowdColors[(x + y) % crowdColors.length]
        ctx.fillRect(x, y, 3, 3)
      }
    }
  })
}

function drawWallsAndGoals(ctx, st) {
  const goalLeft = PITCH.x + (PITCH.w - GOAL_W) / 2
  const goalRight = goalLeft + GOAL_W

  // Cadre épais autour du terrain (sauf devant les cages)
  ctx.strokeStyle = st.wallColor
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(goalLeft, PITCH.y)
  ctx.lineTo(PITCH.x, PITCH.y)
  ctx.lineTo(PITCH.x, PITCH.y + PITCH.h)
  ctx.lineTo(goalLeft, PITCH.y + PITCH.h)

  ctx.moveTo(goalRight, PITCH.y)
  ctx.lineTo(PITCH.x + PITCH.w, PITCH.y)
  ctx.lineTo(PITCH.x + PITCH.w, PITCH.y + PITCH.h)
  ctx.lineTo(goalRight, PITCH.y + PITCH.h)
  ctx.stroke()

  // Cages & Filets (haut et bas)
  const goals = [
    { y: PITCH.y - GOAL_DEPTH, h: GOAL_DEPTH },
    { y: PITCH.y + PITCH.h, h: GOAL_DEPTH }
  ]
  goals.forEach((g) => {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(goalLeft, g.y, GOAL_W, g.h)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.strokeRect(goalLeft, g.y, GOAL_W, g.h)
  })
}

function drawPuck(ctx, p) {
  ctx.save()

  // Halo cyan lumineux quand c'est le tour du joueur (identique à la capture 4)
  if (p.owner === 'me' && turn.value === 'me' && !isMoving && phase.value === 'playing') {
    const pulseR = p.r + 5 + Math.sin(glowPulse) * 2
    const grad = ctx.createRadialGradient(p.x, p.y, p.r - 2, p.x, p.y, pulseR + 4)
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)')
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, pulseR + 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ombre portée
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.arc(p.x, p.y + 3, p.r, 0, Math.PI * 2)
  ctx.fill()

  // Clip circulaire pour le drapeau
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.r - 2, 0, Math.PI * 2)
  ctx.clip()

  drawTeamFlagOnCanvas(ctx, p.team, p.x, p.y, p.r - 2)
  ctx.restore()

  // Anneau métallique chromé autour du pion
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.r - 1.5, 0, Math.PI * 2)
  ctx.stroke()
}

function drawTeamFlagOnCanvas(ctx, team, cx, cy, r) {
  const d = r * 2
  const x0 = cx - r
  const y0 = cy - r

  if (team.type === 'v3') {
    team.colors.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(x0 + (d / 3) * i, y0, d / 3 + 1, d)
    })
  } else if (team.type === 'h3' || team.type === 'spain') {
    team.colors.forEach((c, i) => {
      ctx.fillStyle = c
      ctx.fillRect(x0, y0 + (d / 3) * i, d, d / 3 + 1)
    })
    if (team.type === 'spain') {
      ctx.fillStyle = '#aa151b'
      ctx.beginPath()
      ctx.arc(cx - 3, cy, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (team.type === 'h2') {
    ctx.fillStyle = team.colors[0]
    ctx.fillRect(x0, y0, d, r)
    ctx.fillStyle = team.colors[1]
    ctx.fillRect(x0, cy, d, r)
  } else if (team.type === 'tr') {
    ctx.fillStyle = '#e30a17'
    ctx.fillRect(x0, y0, d, d)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - 2, cy, 6.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e30a17'
    ctx.beginPath()
    ctx.arc(cx, cy, 5.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx + 5.5, cy, 2.3, 0, Math.PI * 2)
    ctx.fill()
  } else if (team.type === 'br') {
    ctx.fillStyle = team.bg
    ctx.fillRect(x0, y0, d, d)
    ctx.fillStyle = team.diamond
    ctx.beginPath()
    ctx.moveTo(cx, y0 + 3)
    ctx.lineTo(x0 + d - 3, cy)
    ctx.lineTo(cx, y0 + d - 3)
    ctx.lineTo(x0 + 3, cy)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = team.dot
    ctx.beginPath()
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = team.bg || '#1d8cf8'
    ctx.fillRect(x0, y0, d, d)
    if (team.dot || team.star) {
      ctx.fillStyle = team.dot || team.star
      ctx.beginPath()
      ctx.arc(cx, cy, 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawBall(ctx, b, type) {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.arc(b.x, b.y + 2, b.r, 0, Math.PI * 2)
  ctx.fill()

  if (type === 'retro') {
    ctx.fillStyle = '#b45309'
  } else if (type === 'eye') {
    ctx.fillStyle = '#e0f2fe'
  } else if (type === 'mushroom') {
    ctx.fillStyle = '#dc2626'
  } else {
    ctx.fillStyle = '#ffffff'
  }

  ctx.beginPath()
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Motif central du ballon
  ctx.fillStyle = type === 'eye' ? '#0284c7' : (type === 'mushroom' ? '#ffffff' : '#0f172a')
  ctx.beginPath()
  ctx.arc(b.x, b.y, b.r * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function startLoop() {
  cancelAnimationFrame(animFrameId)
  const loop = () => {
    updatePhysics()
    drawScene()
    animFrameId = requestAnimationFrame(loop)
  }
  animFrameId = requestAnimationFrame(loop)
}

function sendReaction(emoji) {
  showEmojiMenu.value = false
  activeReaction.value = emoji
  setTimeout(() => {
    if (activeReaction.value === emoji) activeReaction.value = null
  }, 1900)
}

function getTeamPreviewStyle(t) {
  if (t.type === 'v3') return { background: `linear-gradient(90deg, ${t.colors[0]} 33%, ${t.colors[1]} 33% 66%, ${t.colors[2]} 66%)` }
  if (t.type === 'h3' || t.type === 'spain') return { background: `linear-gradient(180deg, ${t.colors[0]} 33%, ${t.colors[1]} 33% 66%, ${t.colors[2]} 66%)` }
  if (t.type === 'h2') return { background: `linear-gradient(180deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)` }
  if (t.type === 'pt') return { background: `linear-gradient(90deg, ${t.colors[0]} 40%, ${t.colors[1]} 40%)` }
  return { background: t.bg || '#1d8cf8' }
}

function pushMultiplayerState() {
  if (props.mode !== 'multi') return
  emit('sync-state', {
    phase: phase.value,
    myScore: props.isHost ? myScore.value : oppScore.value,
    oppScore: props.isHost ? oppScore.value : myScore.value,
    turnHost: props.isHost ? turn.value === 'me' : turn.value === 'opp',
    pucks,
    ball
  })
}

watch(() => props.roomState, (st) => {
  if (props.mode !== 'multi' || !st || !st.pucks) return
  myScore.value = props.isHost ? st.myScore : st.oppScore
  oppScore.value = props.isHost ? st.oppScore : st.myScore
  turn.value = (props.isHost ? st.turnHost : !st.turnHost) ? 'me' : 'opp'
}, { deep: true })

onMounted(() => {
  startPrepCountdown(31, confirmFormation)
})

onUnmounted(() => {
  clearInterval(prepInterval)
  clearInterval(turnTimerId)
  clearTimeout(botTimeoutId)
  cancelAnimationFrame(animFrameId)
})
</script>

<template>
  <div class="plato-soccer-shell">
    <!-- BARRE SUPÉRIEURE IDENTIQUE AUX 4 CAPTURES -->
    <div class="soccer-hud">
      <div class="hud-side left">
        <span class="dot" :class="{ active: turn === 'opp' }"></span>
        <span class="hud-name">{{ opponentPseudo }}</span>
        <div class="hud-avatar opp">🐱</div>
      </div>

      <div class="hud-center">
        <div class="score-line">{{ oppScore }} - {{ myScore }}</div>
        <div class="goal-target">Buts pour gagner: {{ GOALS_TO_WIN }}</div>
      </div>

      <div class="hud-side right">
        <div class="hud-avatar me" :style="getTeamPreviewStyle(selectedTeam)">
          <span v-if="selectedTeam.id === 'turkey'">☪</span>
        </div>
        <div v-if="phase === 'playing' && turn === 'me'" class="turn-stack">
          <div class="mini-timer">
            <div class="mini-timer-fill" :style="{ width: turnTimeLeft + '%' }"></div>
          </div>
          <span class="turn-badge">À votre tour</span>
        </div>
        <template v-else>
          <span class="hud-name">{{ playerPseudo }}</span>
          <span class="dot active"></span>
        </template>
      </div>
    </div>

    <!-- ÉTAPE 1 : SÉLECTIONNEZ VOTRE FORMATION (Capture 1) -->
    <div v-if="phase === 'formation'" class="prep-modal">
      <h2 class="prep-title">SÉLECTIONNEZ VOTRE FORMATION</h2>

      <div class="formation-group">
        <h3>ATTAQUE</h3>
        <div class="formation-grid">
          <button
            v-for="f in FORMATIONS.filter(x => x.category === 'ATTAQUE')"
            :key="f.id"
            class="formation-card"
            :class="{ selected: selectedFormation.id === f.id }"
            @click="selectedFormation = f"
          >
            <div class="mini-pitch">
              <span
                v-for="(pt, i) in f.points"
                :key="i"
                class="mini-dot"
                :style="{ left: pt.x * 100 + '%', top: ((pt.y - 0.48) / 0.52) * 100 + '%' }"
              ></span>
            </div>
            <span class="form-label">{{ f.name }}</span>
          </button>
        </div>
      </div>

      <div class="formation-group">
        <h3>DÉFENSIF</h3>
        <div class="formation-grid">
          <button
            v-for="f in FORMATIONS.filter(x => x.category === 'DÉFENSIF')"
            :key="f.id"
            class="formation-card"
            :class="{ selected: selectedFormation.id === f.id }"
            @click="selectedFormation = f"
          >
            <div class="mini-pitch">
              <span
                v-for="(pt, i) in f.points"
                :key="i"
                class="mini-dot"
                :style="{ left: pt.x * 100 + '%', top: ((pt.y - 0.48) / 0.52) * 100 + '%' }"
              ></span>
            </div>
            <span class="form-label">{{ f.name }}</span>
          </button>
        </div>
      </div>

      <div class="prep-footer">
        <p class="countdown-text">Début de la partie dans <strong>{{ prepTimer }}</strong></p>
        <button class="confirm-blue-btn" @click="confirmFormation">CONFIRMER</button>
      </div>
    </div>

    <!-- ÉTAPE 2 : SÉLECTIONNEZ LE STADE (Capture 2) -->
    <div v-else-if="phase === 'stadium'" class="prep-modal">
      <h2 class="prep-title">SÉLECTIONNEZ LE STADE</h2>

      <div class="stadium-list">
        <button
          v-for="st in STADIUMS"
          :key="st.id"
          class="stadium-row"
          :class="{ selected: selectedStadium.id === st.id }"
          @click="selectedStadium = st"
        >
          <span class="stadium-name">{{ st.name }}</span>
          <div class="stadium-thumb" :style="{ background: st.previewBg }">
            <div class="thumb-lines"></div>
            <span class="thumb-ball">
              {{ st.ballType === 'retro' ? '🟤' : st.ballType === 'eye' ? '👁️' : st.ballType === 'mushroom' ? '🍄' : '⚽' }}
            </span>
          </div>
        </button>
      </div>

      <div class="prep-footer">
        <p class="countdown-text">Début de la partie dans <strong>{{ prepTimer }}</strong></p>
        <button class="confirm-blue-btn" @click="confirmStadium">CONFIRMER {{ selectedStadium.name }}</button>
      </div>
    </div>

    <!-- ÉTAPE 3 : SÉLECTIONNEZ VOTRE ÉQUIPE (Capture 3) -->
    <div v-else-if="phase === 'team'" class="prep-modal">
      <h2 class="prep-title">SÉLECTIONNEZ VOTRE ÉQUIPE</h2>

      <div class="team-tabs">
        <button :class="{ active: teamTab === 'regular' }" @click="teamTab = 'regular'">RÉGULIER</button>
        <button :class="{ active: teamTab === 'premium' }" @click="teamTab = 'premium'">PREMIUM</button>
      </div>

      <div class="teams-grid">
        <button
          v-for="t in filteredTeams"
          :key="t.id"
          class="team-badge-btn"
          :class="{
            selected: selectedTeam.id === t.id,
            adversaire: opponentTeam.id === t.id
          }"
          @click="selectedTeam = t"
        >
          <div class="glossy-flag" :style="getTeamPreviewStyle(t)">
            <span v-if="t.id === 'turkey'" class="flag-sym">☪</span>
            <span v-else-if="t.id === 'japan'" class="red-circle"></span>
            <span v-else-if="t.id === 'brazil'" class="br-diamond"></span>
            <span v-else-if="t.star" class="flag-sym">★</span>
            <span v-else-if="t.emblem" class="flag-sym">{{ t.emblem }}</span>
          </div>
          <span v-if="opponentTeam.id === t.id" class="adv-tag">Adversaire</span>
        </button>
      </div>

      <div class="prep-footer">
        <p class="countdown-text">Début de la partie dans <strong>{{ prepTimer }}</strong></p>
        <button class="confirm-blue-btn" @click="confirmTeam">CONFIRMER {{ selectedTeam.name }}</button>
      </div>
    </div>

    <!-- ÉTAPE 4 : TERRAIN DE JEU (Capture 4) -->
    <div v-else class="arena-wrapper">
      <canvas
        ref="canvasRef"
        :width="W"
        :height="H"
        class="soccer-canvas"
        @mousedown="onPointerDown"
        @mousemove="onPointerMove"
        @mouseup="onPointerUp"
        @touchstart.prevent="onPointerDown"
        @touchmove.prevent="onPointerMove"
        @touchend.prevent="onPointerUp"
      ></canvas>

      <!-- Bouton réaction rapide flottant à droite -->
      <div class="reaction-box">
        <div v-if="activeReaction" class="emoji-float">{{ activeReaction }}</div>
        <div v-if="showEmojiMenu" class="emoji-bar">
          <button v-for="e in EMOJIS" :key="e" @click="sendReaction(e)">{{ e }}</button>
        </div>
        <button class="emoji-fab" @click="showEmojiMenu = !showEmojiMenu">🙂</button>
      </div>

      <div v-if="goalBanner" class="goal-toast">{{ goalBanner }}</div>

      <!-- Écran de fin de match -->
      <div v-if="phase === 'gameover'" class="match-end-overlay">
        <h2>{{ winner === 'me' ? 'VICTOIRE ! 🏆' : 'DÉFAITE !' }}</h2>
        <p class="final-score">{{ oppScore }} - {{ myScore }}</p>
        <button class="confirm-blue-btn" @click="initMatch">Rejouer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plato-soccer-shell {
  position: relative;
  width: 100%;
  max-width: 440px;
  min-height: 640px;
  margin: 0 auto;
  background: #467326;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  user-select: none;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
  font-family: system-ui, -apple-system, sans-serif;
}

/* HUD SUPÉRIEUR */
.soccer-hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.22);
  color: #ffffff;
  z-index: 10;
}
.hud-side {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hud-name {
  font-size: 0.78rem;
  font-weight: 700;
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
}
.dot.active {
  background: #86efac;
  box-shadow: 0 0 6px #86efac;
}
.hud-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 900;
  color: #fff;
}
.hud-avatar.opp {
  background: #1e293b;
}
.hud-center {
  text-align: center;
}
.score-line {
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1.1;
}
.goal-target {
  font-size: 0.7rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}
.turn-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.mini-timer {
  width: 58px;
  height: 5px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 999px;
  overflow: hidden;
}
.mini-timer-fill {
  height: 100%;
  background: #facc15;
  transition: width 0.4s linear;
}
.turn-badge {
  background: #1d8cf8;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 999px;
}

/* MODALES DE PRÉPARATION (Captures 1, 2, 3) */
.prep-modal {
  flex: 1;
  margin: 4px 10px 10px;
  background: #0a0c0e;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 12px 0;
  color: #ffffff;
}
.prep-title {
  text-align: center;
  color: #eab308;
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.5px;
  margin: 0 0 10px;
}

/* FORMATIONS */
.formation-group h3 {
  text-align: center;
  font-size: 0.88rem;
  font-weight: 800;
  margin: 6px 0 8px;
}
.formation-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.formation-card {
  background: none;
  border: none;
  padding: 0;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}
.formation-card.selected {
  color: #ffffff;
}
.mini-pitch {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1.05;
  background: linear-gradient(180deg, #4c7c29 0%, #639a38 50%, #4c7c29 100%);
  border: 2px solid transparent;
  border-radius: 4px;
  opacity: 0.55;
}
.formation-card.selected .mini-pitch {
  border-color: #ffffff;
  opacity: 1;
}
.mini-dot {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #1d8cf8;
  border: 1.5px solid #cbd5e1;
  transform: translate(-50%, -50%);
}
.form-label {
  font-size: 0.78rem;
  font-weight: 800;
}

/* STADES */
.stadium-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stadium-row {
  background: #1a1d21;
  border: 2px solid transparent;
  border-radius: 8px;
  padding: 6px 6px 6px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #eab308;
  cursor: pointer;
}
.stadium-row.selected {
  border-color: #1d8cf8;
}
.stadium-name {
  font-size: 0.9rem;
  font-weight: 800;
}
.stadium-thumb {
  position: relative;
  width: 135px;
  height: 74px;
  border-radius: 6px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-lines {
  width: 82%;
  height: 76%;
  border: 1.5px solid rgba(255, 255, 255, 0.75);
}
.thumb-ball {
  position: absolute;
  bottom: -4px;
  right: -2px;
  font-size: 1.55rem;
}

/* ÉQUIPES */
.team-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #1e293b;
  margin-bottom: 12px;
}
.team-tabs button {
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: #94a3b8;
  font-weight: 800;
  font-size: 0.85rem;
  padding: 8px;
  cursor: pointer;
}
.team-tabs button.active {
  color: #ffffff;
  border-bottom-color: #1d8cf8;
}
.teams-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px 8px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}
.team-badge-btn {
  position: relative;
  background: none;
  border: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
.glossy-flag {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 3px solid #cbd5e1;
  box-shadow: inset 0 4px 6px rgba(255, 255, 255, 0.45), 0 4px 8px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 900;
}
.team-badge-btn.selected .glossy-flag {
  border-color: #1d8cf8;
  box-shadow: 0 0 0 3px rgba(29, 140, 248, 0.6);
}
.team-badge-btn.adversaire .glossy-flag {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.6);
}
.adv-tag {
  position: absolute;
  bottom: -8px;
  background: #dc2626;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
}
.red-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #bc002d;
}
.br-diamond {
  width: 22px;
  height: 22px;
  background: #ffdf00;
  transform: rotate(45deg);
}

/* PIED DES MODALES */
.prep-footer {
  margin: 10px -12px 0;
  text-align: center;
}
.countdown-text {
  font-size: 0.85rem;
  font-weight: 700;
  margin: 0 0 10px;
}
.countdown-text strong {
  font-size: 1.1rem;
}
.confirm-blue-btn {
  width: 100%;
  background: #1d8cf8;
  color: #ffffff;
  border: none;
  padding: 14px;
  font-size: 0.95rem;
  font-weight: 900;
  cursor: pointer;
}

/* ARÈNE CANVAS */
.arena-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.soccer-canvas {
  width: 100%;
  height: auto;
  display: block;
  touch-action: none;
  cursor: grab;
}
.reaction-box {
  position: absolute;
  right: 8px;
  bottom: 90px;
  z-index: 15;
}
.emoji-fab {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #facc15;
  border: 2px solid #1e293b;
  font-size: 1.35rem;
  cursor: pointer;
}
.emoji-bar {
  position: absolute;
  right: 46px;
  bottom: 0;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 999px;
  padding: 5px 10px;
  display: flex;
  gap: 6px;
}
.emoji-bar button {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
}
.emoji-float {
  position: absolute;
  bottom: 48px;
  right: 6px;
  font-size: 2.2rem;
  animation: floatUp 1.8s ease forwards;
}
@keyframes floatUp {
  0% { transform: translateY(10px) scale(0.6); opacity: 0; }
  30% { transform: translateY(-10px) scale(1.2); opacity: 1; }
  100% { transform: translateY(-45px) scale(1); opacity: 0; }
}
.goal-toast {
  position: absolute;
  top: 46%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(10, 14, 18, 0.9);
  color: #facc15;
  font-size: 1.5rem;
  font-weight: 900;
  padding: 12px 24px;
  border-radius: 14px;
  border: 2px solid #facc15;
}
.match-end-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 18, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #facc15;
  padding: 20px;
}
.final-score {
  font-size: 2rem;
  font-weight: 900;
  color: #ffffff;
  margin: 0;
}
</style>