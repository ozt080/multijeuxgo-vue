<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from './lib/supabase'
import ChatWidget from './components/ChatWidget.vue'

const router = useRouter()
const profile = ref(null)

async function loadProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { profile.value = null; return }
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  profile.value = data
}

async function logout() {
  await supabase.auth.signOut()
  profile.value = null
  router.push('/login')
}

onMounted(() => {
  loadProfile()
  supabase.auth.onAuthStateChange(() => loadProfile())
})
</script>

<template>
  <nav class="navbar">
    <router-link to="/" class="brand">🎮 MultiJeux<span>Go</span></router-link>
    <div class="nav-right">
      <template v-if="profile">
        <span class="user-pill">👤 {{ profile.pseudo }} · ⭐ {{ profile.score }} pts</span>
        <button @click="logout" class="btn-logout">Quitter</button>
      </template>
      <router-link v-else to="/login" class="btn-primary">Connexion</router-link>
    </div>
  </nav>

  <router-view :profile="profile" @refresh-profile="loadProfile" />
  <ChatWidget :profile="profile" />
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
body { background: #0b0e1a; color: #f8fafc; }
.navbar { background: #14192d; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); }
.brand { color: #fff; text-decoration: none; font-size: 1.3rem; font-weight: 900; }
.brand span { color: #818cf8; }
.nav-right { display: flex; align-items: center; gap: 12px; }
.user-pill { background: #1b223c; padding: 7px 14px; border-radius: 999px; font-weight: 700; font-size: 0.88rem; }
.btn-primary { background: #6366f1; color: #fff; border: none; padding: 9px 16px; border-radius: 10px; font-weight: 800; text-decoration: none; cursor: pointer; }
.btn-logout { background: #ef4444; color: #fff; border: none; padding: 8px 14px; border-radius: 10px; font-weight: 700; cursor: pointer; }
</style>
