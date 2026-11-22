<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  mode: { type: String, default: 'solo' }, // 'solo' | 'multi'
  playerPseudo: { type: String, default: 'boztas' },
  opponentPseudo: { type: String, default: 'keepmecloser' },
  roomState: { type: Object, default: null },
  isHost: { type: Boolean, default: true }
})

const emit = defineEmits(['sync-state', 'win'])

// Dimensions logiques du terrain
const W = 380
const H = 560
const MAX_STROKES = 5
const BALL_R = 7.5

// État du match (3 trous)
const currentHoleIdx = ref(0)
const myTotalScore = ref(0)
const oppTotalScore = ref(0)
const myHoleStrokes = ref(0)
const oppHoleStrokes = ref(0)

const turn = ref('me') // 'me' | 'opp'
const subPhase = ref('place') // 'place' | 'aim' | 'rolling' | 'hole_end' | 'match_end'
const turnTimeLeft = ref(100)
const toastMessage = ref('')

// Balles des deux joueurs
const myBall = ref({ x: 75, y: 487, vx: 0, vy: 0, placed: false, sunk: false })
const oppBall = ref({ x: 301, y: 487, vx: 0, vy: 0, placed: false, sunk: false })

// Visée tactile / souris
const canvasRef = ref(null)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragCurrent = ref({ x: 0, y: 0 })

// Réactions rapides
const showEmojiMenu = ref(false)
const activeReaction = ref(null)
const EMOJIS = ['😄', '🔥', '😱', '👏', '😂', '😡']

let animFrameId = null
let turnTimerId = null
let botTimeoutId = null
let wheelAngle = 0
let arrowOffset = 0

// DÉFINITION DES PARCOURS (Trou 1 = réplique exacte de ta capture)
const COURSES = [
  {
    name: 'Trou 1 - Les Trois Couloirs',
    tees: [
      { x: 42, y: 454, w: 66, h: 66 },  // Zone départ bas-gauche
      { x: 268, y: 454, w: 66, h: 66 }  // Zone départ bas-droite
    ],
    hole: { x: 190, y: 482, r: 12 },
    walls: [
      // Cadre extérieur brique/bois
      { x: 14, y: 18, w: 352, h: 14 },
      { x: 14, y: 532, w: 352, h: 14 },
      { x: 14, y: 18, w: 14, h: 528 },
      { x: 352, y: 18, w: 14, h: 528 },

      // Deux grandes cloisons verticales (passage libre en haut y: 32..80)
      { x: 130, y: 80, w: 12, h: 452 },
      { x: 238, y: 80, w: 12, h: 452 },

      // Chicanes du couloir gauche (slalom)
      { x: 28, y: 386, w: 56, h: 12 },
      { x: 74, y: 314, w: 56, h: 12 },
      { x: 28, y: 242, w: 56, h: 12 },
      { x: 74, y: 170, w: 56, h: 12 },
      { x: 28, y: 98, w: 56, h: 12 }
    ],
    // Tapis de flèches descendantes au centre
    boosters: [
      { x: 142, y: 32, w: 96, h: 365, fx: 0, fy: 0.14 }
    ],
    // Tourniquets rebondissants (couloir droit)
    spinners: [
      { x: 312, y: 165, r: 18 },
      { x: 278, y: 255, r: 18 },
      { x: 332, y: 295, r: 18 },
      { x: 312, y: 385, r: 18 }
    ],
    // Maisonnettes obstacles dans le couloir central
    houses: [
      { x: 152, y: 185, w: 20, h: 22 },
      { x: 178, y: 185, w: 20, h: 22 },
      { x: 212, y: 185, w: 20, h: 22 },

      { x: 146, y: 255, w: 18, h: 22 },
      { x: 168, y: 255, w: 18, h: 22 },
      { x: 190, y: 255, w: 18, h: 22 },
      { x: 212, y: 255, w: 18, h: 22 },

      { x: 146, y: 315, w: 18, h: 22 },
      { x: 168, y: 315, w: 18, h: 22 },
      { x: 190, y: 315, w: 18, h: 22 },
      { x: 212, y: 315, w: 18, h: 22 },

      { x: 146, y: 368, w: 18, h: 22 },
      { x: 168, y: 368, w: 18, h: 22 },
      { x: 190, y: 368, w: 18, h: 22 },
      { x: 212, y: 368, w: 18, h: 22 }
    ]
  },
  {
    name: 'Trou 2 - Le Double Virage',
    tees: [
      { x: 52, y: 456, w: 66, h: 66 },
      { x: 262, y: 456, w: 66, h: 66 }
    ],
    hole: { x: 190, y: 92, r: 12 },
    walls: [
      { x: 14, y: 18, w: 352, h: 14 },
      { x: 14, y: 532, w: 352, h: 14 },
      { x: 14, y: 18, w: 14, h: 528 },
      { x: 352, y: 18, w: 14, h: 528 },
      { x: 95, y: 340, w: 190, h: 14 },
      { x: 28, y: 205, w: 125, h: 14 },
      { x: 227, y: 205, w: 125, h: 14 }
    ],
    boosters: [
      { x: 162, y: 215, w: 56, h: 115, fx: 0, fy: -0.15 }
    ],
    spinners: [
      { x: 190, y: 415, r: 20 },
      { x: 115, y: 135, r: 18 },
      { x: 265, y: 135, r: 18 }
    ],
    houses: []
  },
  {
    name: 'Trou 3 - La Forteresse',
    tees: [
      { x: 157, y: 456, w: 66, h: 66 }
    ],
    hole: { x: 190, y: 84, r: 12 },
    walls: [
      { x: 14, y: 18, w: 352, h: 14 },
      { x: 14, y: 532, w: 352, h: 14 },
      { x: 14, y: 18, w: 14, h: 528 },
      { x: 352, y: 18, w: 14, h: 528 },
      { x: 110, y: 145, w: 160, h: 14 },
      { x: 110, y: 145, w: 14, h: 160 },
      { x: 256, y: 145, w: 14, h: 160 }
    ],
    boosters: [
      { x: 42, y: 180, w: 52, h: 180, fx: 0, fy: -0.14 },
      { x: 286, y: 180, w: 52, h: 180, fx: 0, fy: -0.14 }
    ],
    spinners: [
      { x: 190, y: 375, r: 22 },
      { x: 190, y: 230, r: 18 }
    ],
    houses: [
      { x: 145, y: 74, w: 20, h: 22 },
      { x: 215, y: 74, w: 20, h: 22 }
    ]
  }
]

const course = computed(() => COURSES[currentHoleIdx.value] || COURSES[0])
const activeBall = computed(() => (turn.value === 'me' ? myBall.value : oppBall.value))

function setupHole(idx) {
  currentHoleIdx.value = idx
  myHoleStrokes.value = 0
  oppHoleStrokes.value = 0

  const firstTee = COURSES[idx].tees[0]
  myBall.value = {
    x: firstTee.x + firstTee.w / 2,
    y: firstTee.y + firstTee.h / 2,
    vx: 0,
    vy: 0,
    placed: false,
    sunk: false
  }
  const secondTee = COURSES[idx].tees[1] || firstTee
  oppBall.value = {
    x: secondTee.x + secondTee.w / 2,
    y: secondTee.y + secondTee.h / 2,
    vx: 0,
    vy: 0,
    placed: false,
    sunk: false
  }

  turn.value = 'me'
  subPhase.value = 'place'
  startTurnTimer()
  pushMultiplayerState()
}

function startTurnTimer() {
  clearInterval(turnTimerId)
  turnTimeLeft.value = 100
  if (subPhase.value === 'hole_end' || subPhase.value === 'match_end') return

  turnTimerId = setInterval(() => {
    if (subPhase.value === 'rolling') return
    turnTimeLeft.value -= 2.2
    if (turnTimeLeft.value <= 0) {
      clearInterval(turnTimerId)
      if (turn.value === 'me') {
        if (!myBall.value.placed) {
          myBall.value.placed = true
        }
        myHoleStrokes.value++
        myTotalScore.value++
        advanceTurn()
      }
    }
  }, 400)
}

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
  if (turn.value !== 'me') return
  const pos = getCanvasCoords(e)

  // 1. Phase de placement sur une zone de départ (comme sur ta capture)
  if (subPhase.value === 'place') {
    for (const tee of course.value.tees) {
      if (pos.x >= tee.x && pos.x <= tee.x + tee.w && pos.y >= tee.y && pos.y <= tee.y + tee.h) {
        myBall.value.x = Math.max(tee.x + 12, Math.min(tee.x + tee.w - 12, pos.x))
        myBall.value.y = Math.max(tee.y + 12, Math.min(tee.y + tee.h - 12, pos.y))
        myBall.value.placed = true
        subPhase.value = 'aim'
        pushMultiplayerState()
        return
      }
    }
    return
  }

  // 2. Phase de tir (glisser depuis la balle)
  if (subPhase.value === 'aim') {
    const dist = Math.hypot(pos.x - myBall.value.x, pos.y - myBall.value.y)
    if (dist <= 34) {
      isDragging.value = true
      dragStart.value = { x: myBall.value.x, y: myBall.value.y }
      dragCurrent.value = { ...pos }
    }
  }
}

function onPointerMove(e) {
  if (!isDragging.value) return
  dragCurrent.value = getCanvasCoords(e)
}

function onPointerUp() {
  if (!isDragging.value) return
  isDragging.value = false

  const dx = myBall.value.x - dragCurrent.value.x
  const dy = myBall.value.y - dragCurrent.value.y
  const dist = Math.hypot(dx, dy)

  if (dist > 8) {
    const clamped = Math.min(dist, 95)
    const power = (clamped / 95) * 14.5
    const angle = Math.atan2(dy, dx)
    myBall.value.vx = Math.cos(angle) * power
    myBall.value.vy = Math.sin(angle) * power
    myHoleStrokes.value++
    myTotalScore.value++
    subPhase.value = 'rolling'
    pushMultiplayerState()
  }
}

function advanceTurn() {
  // Vérifier si les deux joueurs ont fini le trou (balle rentrée ou 5 coups atteints)
  const meDone = myBall.value.sunk || myHoleStrokes.value >= MAX_STROKES
  const oppDone = oppBall.value.sunk || oppHoleStrokes.value >= MAX_STROKES

  if (meDone && oppDone) {
    if (currentHoleIdx.value < COURSES.length - 1) {
      subPhase.value = 'hole_end'
      flashToast(`Trou ${currentHoleIdx.value + 1} terminé !`)
      setTimeout(() => setupHole(currentHoleIdx.value + 1), 1800)
    } else {
      subPhase.value = 'match_end'
      clearInterval(turnTimerId)
      const iWon = myTotalScore.value <= oppTotalScore.value
      emit('win', { winner: iWon ? 'me' : 'opp', score: `${myTotalScore.value} - ${oppTotalScore.value}` })
    }
    pushMultiplayerState()
    return
  }

  // Passer la main à l'autre joueur s'il n'a pas encore fini
  if (turn.value === 'me' && !oppDone) {
    turn.value = 'opp'
  } else if (turn.value === 'opp' && !meDone) {
    turn.value = 'me'
  }

  const nextBall = turn.value === 'me' ? myBall.value : oppBall.value
  subPhase.value = nextBall.placed ? 'aim' : 'place'
  startTurnTimer()
  pushMultiplayerState()

  if (turn.value === 'opp' && props.mode === 'solo') {
    botTimeoutId = setTimeout(executeBotPlay, 1100)
  }
}

function executeBotPlay() {
  if (turn.value !== 'opp' || props.mode !== 'solo') return

  if (!oppBall.value.placed) {
    const tees = course.value.tees
    const chosen = tees[tees.length - 1]
    oppBall.value.x = chosen.x + chosen.w / 2
    oppBall.value.y = chosen.y + chosen.h / 2
    oppBall.value.placed = true
    subPhase.value = 'aim'
  }

  // Tir intelligent vers le haut de son couloir ou vers le trou
  const h = course.value.hole
  let targetX = h.x
  let targetY = h.y
  if (currentHoleIdx.value === 0 && oppBall.value.y > 110 && oppBall.value.x > 240) {
    targetX = 295
    targetY = 42
  }
  const angle = Math.atan2(targetY - oppBall.value.y, targetX - oppBall.value.x) + (Math.random() - 0.5) * 0.14
  const power = 11.5 + Math.random() * 2.5
  oppBall.value.vx = Math.cos(angle) * power
  oppBall.value.vy = Math.sin(angle) * power
  oppHoleStrokes.value++
  oppTotalScore.value++
  subPhase.value = 'rolling'
}

function updatePhysics() {
  wheelAngle += 0.045
  arrowOffset = (arrowOffset + 0.6) % 24

  if (subPhase.value !== 'rolling') return

  const b = activeBall.value
  const c = course.value
  const SUBSTEPS = 4

  for (let s = 0; s < SUBSTEPS; s++) {
    b.x += b.vx / SUBSTEPS
    b.y += b.vy / SUBSTEPS

    // Accélérateurs (tapis de flèches)
    for (const bst of c.boosters) {
      if (b.x > bst.x && b.x < bst.x + bst.w && b.y > bst.y && b.y < bst.y + bst.h) {
        b.vx += bst.fx / SUBSTEPS
        b.vy += bst.fy / SUBSTEPS
      }
    }

    // Murs + maisonnettes
    const solidRects = [...c.walls, ...c.houses]
    for (const rect of solidRects) {
      resolveRectCollision(b, rect)
    }

    // Tourniquets rebondissants
    for (const sp of c.spinners) {
      const dx = b.x - sp.x
      const dy = b.y - sp.y
      const dist = Math.hypot(dx, dy)
      const minDist = BALL_R + sp.r
      if (dist > 0 && dist < minDist) {
        const nx = dx / dist
        const ny = dy / dist
        b.x = sp.x + nx * minDist
        b.y = sp.y + ny * minDist
        const speed = Math.max(Math.hypot(b.vx, b.vy) * 1.15, 7.2)
        b.vx = nx * speed
        b.vy = ny * speed
      }
    }

    // Détection du trou
    const dHole = Math.hypot(b.x - c.hole.x, b.y - c.hole.y)
    if (dHole < c.hole.r + 1 && Math.hypot(b.vx, b.vy) < 11.8) {
      b.x = c.hole.x
      b.y = c.hole.y
      b.vx = 0
      b.vy = 0
      b.sunk = true
      flashToast(turn.value === 'me' ? 'Dans le trou ! ⛳' : 'Adversaire dans le trou !')
      advanceTurn()
      return
    }
  }

  // Friction de l'herbe
  b.vx *= 0.983
  b.vy *= 0.983

  if (Math.hypot(b.vx, b.vy) < 0.08) {
    b.vx = 0
    b.vy = 0
    advanceTurn()
  }
}

function resolveRectCollision(b, rect) {
  const cx = Math.max(rect.x, Math.min(b.x, rect.x + rect.w))
  const cy = Math.max(rect.y, Math.min(b.y, rect.y + rect.h))
  const dx = b.x - cx
  const dy = b.y - cy
  const dist = Math.hypot(dx, dy)

  if (dist < BALL_R) {
    if (dist === 0) {
      b.y -= BALL_R
      b.vy = -Math.abs(b.vy) * 0.78
      return
    }
    const nx = dx / dist
    const ny = dy / dist
    b.x = cx + nx * BALL_R
    b.y = cy + ny * BALL_R

    const dot = b.vx * nx + b.vy * ny
    if (dot < 0) {
      b.vx = (b.vx - 2 * dot * nx) * 0.78
      b.vy = (b.vy - 2 * dot * ny) * 0.78
    }
  }
}

// DESSIN DU TERRAIN STYLE PLATO
function drawScene() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const c = course.value

  // Fond pelouse extérieure
  ctx.fillStyle = '#64871e'
  ctx.fillRect(0, 0, W, H)

  // Intérieur du parcours vert clair
  ctx.fillStyle = '#76b82a'
  ctx.fillRect(28, 32, 324, 500)

  // Petits reflets d'herbe
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  for (let gx = 45; gx < 340; gx += 46) {
    for (let gy = 55; gy < 515; gy += 64) {
      ctx.fillRect(gx, gy, 5, 2)
      ctx.fillRect(gx + 8, gy + 3, 4, 2)
    }
  }

  // Tapis de flèches descendantes (zone sombre + chevrons vert clair)
  for (const bst of c.boosters) {
    ctx.fillStyle = '#4e7c1c'
    ctx.fillRect(bst.x, bst.y, bst.w, bst.h)

    ctx.save()
    ctx.beginPath()
    ctx.rect(bst.x, bst.y, bst.w, bst.h)
    ctx.clip()

    ctx.strokeStyle = '#9be14d'
    ctx.lineWidth = 2.5
    const dir = bst.fy >= 0 ? 1 : -1
    for (let ax = bst.x + 12; ax <= bst.x + bst.w - 12; ax += 18) {
      for (let ay = bst.y - 24 + arrowOffset * dir; ay < bst.y + bst.h + 24; ay += 24) {
        ctx.beginPath()
        ctx.moveTo(ax, ay - 6 * dir)
        ctx.lineTo(ax, ay + 6 * dir)
        ctx.moveTo(ax - 4, ay + 2 * dir)
        ctx.lineTo(ax, ay + 6 * dir)
        ctx.lineTo(ax + 4, ay + 2 * dir)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // Zones de départ quadrillées (carreaux verts + bordure blanche)
  for (const tee of c.tees) {
    const cols = 4
    const cellW = tee.w / cols
    const cellH = tee.h / cols
    for (let r = 0; r < cols; r++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = (r + col) % 2 === 0 ? '#4d7c1b' : '#659e24'
        ctx.fillRect(tee.x + col * cellW, tee.y + r * cellH, cellW, cellH)
      }
    }
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.strokeRect(tee.x, tee.y, tee.w, tee.h)
  }

  // Murs brique/bois texturés
  for (const w of c.walls) {
    ctx.fillStyle = '#c87a3b'
    ctx.fillRect(w.x, w.y, w.w, w.h)
    ctx.strokeStyle = '#8c4a19'
    ctx.lineWidth = 1.5
    ctx.strokeRect(w.x, w.y, w.w, w.h)

    // Lignes de briques
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    if (w.w > w.h) {
      for (let bx = w.x + 4; bx < w.x + w.w - 10; bx += 18) {
        ctx.fillRect(bx, w.y + 2, 12, 3)
      }
    } else {
      for (let by = w.y + 4; by < w.y + w.h - 10; by += 18) {
        ctx.fillRect(w.x + 2, by, 3, 12)
      }
    }
  }

  // Pilule "COUPS MAX : 5" sur le mur du haut (comme sur la capture)
  ctx.fillStyle = '#8b5a2b'
  ctx.beginPath()
  ctx.roundRect(W / 2 - 58, 16, 116, 18, 9)
  ctx.fill()
  ctx.fillStyle = '#fde68a'
  ctx.font = 'bold 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`COUPS MAX : ${MAX_STROKES}`, W / 2, 28)

  // Maisonnettes obstacles dans le couloir central
  for (const h of c.houses) {
    // Corps blanc
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(h.x + 2, h.y + 8, h.w - 4, h.h - 8)
    // Fenêtre
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(h.x + 6, h.y + 12, 4, 4)
    // Toit rouge
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.moveTo(h.x, h.y + 9)
    ctx.lineTo(h.x + h.w / 2, h.y)
    ctx.lineTo(h.x + h.w, h.y + 9)
    ctx.closePath()
    ctx.fill()
  }

  // Tourniquets rebondissants (rouge / jaune / blanc)
  for (const sp of c.spinners) {
    ctx.save()
    ctx.translate(sp.x, sp.y)
    ctx.rotate(wheelAngle)
    const sliceColors = ['#ef4444', '#facc15', '#ffffff', '#f97316', '#ef4444', '#ffffff']
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = sliceColors[i]
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, sp.r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3)
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = '#7c2d12'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, sp.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Le Trou + Drapeau rouge
  ctx.fillStyle = '#18181b'
  ctx.beginPath()
  ctx.arc(c.hole.x, c.hole.y, c.hole.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3f3f46'
  ctx.lineWidth = 2
  ctx.stroke()

  // Mât et fanion rouge
  ctx.strokeStyle = '#e4e4e7'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(c.hole.x, c.hole.y)
  ctx.lineTo(c.hole.x, c.hole.y - 34)
  ctx.stroke()

  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.moveTo(c.hole.x, c.hole.y - 34)
  ctx.lineTo(c.hole.x + 18, c.hole.y - 27)
  ctx.lineTo(c.hole.x, c.hole.y - 20)
  ctx.closePath()
  ctx.fill()

  // Ligne de visée pointillée si le joueur tire
  if (isDragging.value && turn.value === 'me') {
    const dx = myBall.value.x - dragCurrent.value.x
    const dy = myBall.value.y - dragCurrent.value.y
    const dist = Math.min(Math.hypot(dx, dy), 95)
    if (dist > 8) {
      const angle = Math.atan2(dy, dx)
      const tipX = myBall.value.x + Math.cos(angle) * (dist * 1.25)
      const tipY = myBall.value.y + Math.sin(angle) * (dist * 1.25)

      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3.5
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(myBall.value.x, myBall.value.y)
      ctx.lineTo(tipX, tipY)
      ctx.stroke()

      ctx.setLineDash([])
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.arc(tipX, tipY, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // Dessiner les balles placées
  if (oppBall.value.placed && !oppBall.value.sunk) {
    drawGolfBall(ctx, oppBall.value.x, oppBall.value.y, '#e9d5ff', false)
  }
  if (myBall.value.placed && !myBall.value.sunk) {
    drawGolfBall(ctx, myBall.value.x, myBall.value.y, '#ffffff', turn.value === 'me' && subPhase.value === 'aim')
  }
}

function drawGolfBall(ctx, x, y, color, highlight) {
  if (highlight) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.45)'
    ctx.beginPath()
    ctx.arc(x, y, BALL_R + 6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.arc(x, y + 2, BALL_R, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, BALL_R, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1.2
  ctx.stroke()
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

function flashToast(msg) {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) toastMessage.value = ''
  }, 1600)
}

function sendReaction(emoji) {
  showEmojiMenu.value = false
  activeReaction.value = emoji
  setTimeout(() => {
    if (activeReaction.value === emoji) activeReaction.value = null
  }, 1800)
}

function pushMultiplayerState() {
  if (props.mode !== 'multi') return
  emit('sync-state', {
    holeIdx: currentHoleIdx.value,
    hostScore: props.isHost ? myTotalScore.value : oppTotalScore.value,
    guestScore: props.isHost ? oppTotalScore.value : myTotalScore.value,
    turnHost: props.isHost ? turn.value === 'me' : turn.value === 'opp'
  })
}

watch(() => props.roomState, (st) => {
  if (props.mode !== 'multi' || !st || st.holeIdx === undefined) return
  myTotalScore.value = props.isHost ? st.hostScore : st.guestScore
  oppTotalScore.value = props.isHost ? st.guestScore : st.hostScore
}, { deep: true })

onMounted(() => {
  setupHole(0)
  startLoop()
})

onUnmounted(() => {
  clearInterval(turnTimerId)
  clearTimeout(botTimeoutId)
  cancelAnimationFrame(animFrameId)
})
</script>

<template>
  <div class="plato-golf-shell">
    <!-- BARRE SUPÉRIEURE IDENTIQUE À TA CAPTURE -->
    <div class="golf-hud">
      <!-- Adversaire (gauche) -->
      <div class="player-col">
        <div class="avatar-row">
          <div class="avatar-badge opp">🧑</div>
          <span class="score-pill purple">{{ oppTotalScore }}</span>
        </div>
        <div class="name-row">
          <span>{{ opponentPseudo }}</span>
          <span class="online-dot" :class="{ active: turn === 'opp' }"></span>
        </div>
        <div class="coup-text">COUP : {{ oppHoleStrokes }}</div>
      </div>

      <!-- Joueur actif (droite) -->
      <div class="player-col">
        <div v-if="turn === 'me'" class="timer-row">
          <span class="clock-ico">🕒</span>
          <div class="timer-bar">
            <div class="timer-fill" :style="{ width: turnTimeLeft + '%' }"></div>
          </div>
        </div>
        <div v-else class="timer-spacer"></div>

        <div class="avatar-row">
          <div class="avatar-badge me">🇹🇷</div>
          <span class="score-pill orange">{{ myTotalScore }}</span>
        </div>

        <div class="turn-pill" :class="{ active: turn === 'me' }">
          {{ turn === 'me' ? 'À votre tour' : `• ${playerPseudo}` }}
        </div>
        <div class="coup-text">COUP : {{ myHoleStrokes }}</div>
      </div>
    </div>

    <!-- TERRAIN DE MINI-GOLF -->
    <div class="course-wrapper">
      <canvas
        ref="canvasRef"
        :width="W"
        :height="H"
        class="golf-canvas"
        @mousedown="onPointerDown"
        @mousemove="onPointerMove"
        @mouseup="onPointerUp"
        @touchstart.prevent="onPointerDown"
        @touchmove.prevent="onPointerMove"
        @touchend.prevent="onPointerUp"
      ></canvas>

      <!-- Bandeau noir "Placez votre balle sur une zone de départ" (comme sur ta capture) -->
      <div v-if="turn === 'me' && subPhase === 'place'" class="place-banner">
        Placez votre balle sur une zone de départ
      </div>

      <div v-if="toastMessage" class="golf-toast">{{ toastMessage }}</div>

      <!-- Bouton réaction rapide -->
      <div class="reaction-box">
        <div v-if="activeReaction" class="emoji-float">{{ activeReaction }}</div>
        <div v-if="showEmojiMenu" class="emoji-bar">
          <button v-for="e in EMOJIS" :key="e" @click="sendReaction(e)">{{ e }}</button>
        </div>
        <button class="emoji-fab" @click="showEmojiMenu = !showEmojiMenu">😄</button>
      </div>

      <!-- Écran de fin des 3 trous -->
      <div v-if="subPhase === 'match_end'" class="end-overlay">
        <h2>{{ myTotalScore <= oppTotalScore ? 'VICTOIRE AU MINI-GOLF ! 🏆' : 'FIN DE PARTIE !' }}</h2>
        <p>{{ playerPseudo }} : {{ myTotalScore }} coups — {{ opponentPseudo }} : {{ oppTotalScore }} coups</p>
        <button class="replay-btn" @click="myTotalScore = 0; oppTotalScore = 0; setupHole(0)">Rejouer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plato-golf-shell {
  position: relative;
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
  background: #64871e;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  user-select: none;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
  font-family: system-ui, -apple-system, sans-serif;
}

/* HUD SUPÉRIEUR */
.golf-hud {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  padding: 10px 16px 6px;
  color: #ffffff;
}
.player-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.timer-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.timer-spacer {
  height: 14px;
}
.clock-ico {
  font-size: 0.65rem;
}
.timer-bar {
  width: 58px;
  height: 6px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 999px;
  overflow: hidden;
}
.timer-fill {
  height: 100%;
  background: #facc15;
  transition: width 0.4s linear;
}
.avatar-row {
  position: relative;
  display: flex;
  align-items: center;
}
.avatar-badge {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #1e293b;
  border: 2.5px solid #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
}
.avatar-badge.me {
  background: #e30a17;
}
.score-pill {
  margin-left: -6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 900;
  color: #ffffff;
  border: 1.5px solid rgba(255, 255, 255, 0.5);
}
.score-pill.purple {
  background: #a855f7;
}
.score-pill.orange {
  background: #f97316;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 700;
}
.online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #cbd5e1;
}
.online-dot.active {
  background: #86efac;
}
.turn-pill {
  background: rgba(0, 0, 0, 0.25);
  font-size: 0.76rem;
  font-weight: 800;
  padding: 2px 10px;
  border-radius: 999px;
}
.turn-pill.active {
  background: #1d8cf8;
}
.coup-text {
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.4px;
}

/* CANVAS & OVERLAYS */
.course-wrapper {
  position: relative;
  width: 100%;
}
.golf-canvas {
  width: 100%;
  height: auto;
  display: block;
  touch-action: none;
  cursor: pointer;
}
.place-banner {
  position: absolute;
  top: 47%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  background: rgba(15, 20, 10, 0.82);
  color: #ffffff;
  text-align: center;
  font-size: 0.98rem;
  font-weight: 800;
  padding: 14px 18px;
  pointer-events: none;
}
.golf-toast {
  position: absolute;
  top: 38%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.9);
  color: #facc15;
  padding: 8px 18px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 0.95rem;
}

/* RÉACTIONS */
.reaction-box {
  position: absolute;
  right: 10px;
  bottom: 14px;
  z-index: 15;
}
.emoji-fab {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #111827;
  border: 2px solid rgba(255, 255, 255, 0.2);
  font-size: 1.25rem;
  cursor: pointer;
}
.emoji-bar {
  position: absolute;
  right: 44px;
  bottom: 0;
  background: rgba(15, 23, 42, 0.92);
  border-radius: 999px;
  padding: 4px 8px;
  display: flex;
  gap: 5px;
}
.emoji-bar button {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
}
.emoji-float {
  position: absolute;
  bottom: 44px;
  right: 6px;
  font-size: 2rem;
  animation: floatUp 1.8s ease forwards;
}
@keyframes floatUp {
  0% { transform: translateY(8px) scale(0.6); opacity: 0; }
  30% { transform: translateY(-10px) scale(1.2); opacity: 1; }
  100% { transform: translateY(-42px) scale(1); opacity: 0; }
}

/* FIN DE PARTIE */
.end-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 14, 18, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #facc15;
  text-align: center;
  padding: 20px;
}
.end-overlay p {
  color: #ffffff;
  font-weight: 700;
  margin: 0;
}
.replay-btn {
  background: #1d8cf8;
  color: #ffffff;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 900;
  cursor: pointer;
}
</style>