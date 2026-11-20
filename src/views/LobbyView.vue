<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { GAMES_CATALOG } from '../games/catalog'

const props = defineProps(['profile'])
const router = useRouter()
const selectedCat = ref('ALL')
const roomCode = ref('')
const leaderboard = ref([])

const filteredGames = computed(() =>
  selectedCat.value === 'ALL'
    ? GAMES_CATALOG
    : GAMES_CATALOG.filter(g => g.categorie === selectedCat.value)
)

async function fetchLeaderboard() {
  const { data } = await supabase
    .from('profiles')
    .select('pseudo, score')
    .order('score', { ascending: false })
    .limit(8)
  leaderboard.value = data || []
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function randomUnoCard(numOnly = false) {
  const cols = ['#ef4444', '#3b82f6', '#22c55e', '#eab308']
  const c = cols[Math.floor(Math.random() * 4)]
  if (numOnly) return { c, v: String(Math.floor(Math.random() * 9) + 1) }
  const r = Math.random()
  if (r < 0.68) return { c, v: String(Math.floor(Math.random() * 9) + 1) }
  if (r < 0.80) return { c, v: '+2' }
  if (r < 0.90) return { c, v: '🚫' }
  if (r < 0.96) return { c: '#1e293b', v: '🎨' }
  return { c: '#1e293b', v: '+4' }
}

function initialRoomState(slug) {
  if (slug === 'morpion') return { board: Array(9).fill(''), tour: 'hote', gagnant: null }
  if (slug === 'puissance-4') return { grid: Array.from({ length: 6 }, () => Array(7).fill(0)), tour: 'hote', gagnant: null }
  if (slug === 'pfc') return { choix_hote: null, choix_invite: null, hp_hote: 100, hp_invite: 100, info: 'Choisissez votre attaque !', gagnant: null }
  if (slug === 'ludo') return { pions_hote: [0, 0], pions_invite: [0, 0], tour: 'hote', de: null, peut_jouer: false, info: 'Lance le dé !', gagnant: null }
  if (slug === 'uno') {
    return {
      top: randomUnoCard(true),
      hand_hote: Array.from({ length: 7 }, () => randomUnoCard()),
      hand_invite: Array.from({ length: 7 }, () => randomUnoCard()),
      tour: 'hote',
      info: 'La partie commence !',
      gagnant: null
    }
  }
  return { mode: 'duel', hote_fini: false, invite_fini: false, score_hote: 0, score_invite: 0, gagnant: null }
}

async function createRoom(slug) {
  if (!props.profile) return router.push('/login')
  const code = generateCode()
  const { error } = await supabase.from('rooms').insert({
    code,
    slug,
    host_id: props.profile.id,
    host_pseudo: props.profile.pseudo,
    status: 'attente',
    state: initialRoomState(slug)
  })
  if (error) return alert('Erreur création salon : ' + error.message)
  router.push({ path: `/jeu/${slug}`, query: { salon: code } })
}

async function joinRoom() {
  if (!props.profile) return router.push('/login')
  const code = roomCode.value.trim().toUpperCase()
  if (!code) return
  const { data: room, error } = await supabase.from('rooms').select('*').eq('code', code).single()
  if (error || !room) return alert('Code de salon introuvable.')
  if (room.host_id !== props.profile.id) {
    if (room.guest_id && room.guest_id !== props.profile.id) return alert('Salon déjà complet (2/2).')
    await supabase.from('rooms').update({
      guest_id: props.profile.id,
      guest_pseudo: props.profile.pseudo,
      status: 'en_cours'
    }).eq('id', room.id)
  }
  router.push({ path: `/jeu/${room.slug}`, query: { salon: room.code } })
}

onMounted(fetchLeaderboard)
</script>

<template>
  <div class="container">
    <section class="hero">
      <div>
        <h1>Joue. Défie tes amis. Grimpe au classement.</h1>
        <p>Propulsé par Vue 3 & Supabase Realtime : crée un salon privé et partage ton code à 6 caractères.</p>
      </div>
      <div class="stat-pill"><strong>{{ GAMES_CATALOG.length }}</strong><span>JEUX ACTIFS</span></div>
    </section>

    <section class="room-bar">
      <div>
        <strong>👥 Jouer entre amis</strong>
        <p class="muted">Entre le code à 6 caractères envoyé par ton ami :</p>
      </div>
      <form @submit.prevent="joinRoom" class="join-form">
        <input v-model="roomCode" maxlength="6" placeholder="CODE" required />
        <button type="submit" class="btn-primary">Rejoindre</button>
      </form>
    </section>

    <div class="filters">
      <button v-for="cat in ['ALL', 'Sport', 'Plateau & Cartes', 'Arcade', 'Réflexion']"
              :key="cat"
              :class="['pill', { active: selectedCat === cat }]"
              @click="selectedCat = cat">
        {{ cat === 'ALL' ? `Tous les jeux (${GAMES_CATALOG.length})` : cat }}
      </button>
    </div>

    <div class="lobby-layout">
      <div class="games-grid">
        <article v-for="g in filteredGames" :key="g.slug" class="card">
          <div class="banner" :style="{ background: g.couleur }">
            <span class="tag">{{ g.categorie }}</span>
            <img :src="`/img/jeux/${g.slug}.svg`" :alt="g.nom" />
          </div>
          <div class="card-body">
            <h3>{{ g.nom }}</h3>
            <p class="muted">{{ g.desc }}</p>
            <div class="actions">
              <router-link :to="`/jeu/${g.slug}`" class="btn-solo" :style="{ background: g.couleur }">Solo</router-link>
              <button class="btn-friends" @click="createRoom(g.slug)">👥 Amis</button>
            </div>
          </div>
        </article>
      </div>

      <aside class="side-panel">
        <h2>🏆 Classement Général</h2>
        <div v-for="(p, idx) in leaderboard" :key="p.pseudo" class="leader-row">
          <span><strong>#{{ idx + 1 }}</strong> {{ p.pseudo }}</span>
          <span class="pts">{{ p.score }} pts</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.container { max-width: 1240px; margin: 0 auto; padding: 24px 18px; }
.hero { background: linear-gradient(135deg, #312e81, #1e1b4b); padding: 26px; border-radius: 22px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.stat-pill { background: rgba(0,0,0,0.3); padding: 14px 20px; border-radius: 16px; text-align: center; }
.stat-pill strong { display: block; font-size: 1.6rem; color: #38bdf8; }
.room-bar { background: #14192d; border: 1px solid rgba(99,102,241,0.4); border-radius: 18px; padding: 16px 22px; margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
.join-form { display: flex; gap: 10px; }
.join-form input { width: 140px; text-transform: uppercase; letter-spacing: 3px; font-weight: 800; text-align: center; padding: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: #0b0e1a; color: #fff; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.pill { background: #14192d; color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; border-radius: 999px; cursor: pointer; font-weight: 700; }
.pill.active { background: #6366f1; color: #fff; }
.lobby-layout { display: grid; grid-template-columns: 1fr 290px; gap: 22px; }
@media (max-width: 900px) { .lobby-layout { grid-template-columns: 1fr; } }
.games-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.card { background: #14192d; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; }
.banner { height: 125px; position: relative; }
.banner img { width: 100%; height: 100%; object-fit: cover; }
.tag { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.65); padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.card-body { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
.muted { color: #94a3b8; font-size: 0.85rem; }
.actions { display: flex; gap: 8px; margin-top: auto; }
.btn-solo { flex: 1; text-align: center; padding: 9px; border-radius: 10px; color: #fff; text-decoration: none; font-weight: 800; font-size: 0.85rem; }
.btn-friends { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 9px 12px; border-radius: 10px; cursor: pointer; font-weight: 700; }
.side-panel { background: #14192d; border-radius: 18px; padding: 18px; height: fit-content; border: 1px solid rgba(255,255,255,0.08); }
.leader-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
.pts { color: #fbbf24; font-weight: 800; }
</style>