import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabase'
import LobbyView from '../views/LobbyView.vue'
import LoginView from '../views/LoginView.vue'
import GameView from '../views/GameView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'lobby', component: LobbyView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/jeu/:slug', name: 'game', component: GameView, meta: { requiresAuth: true } },
    { path: '/confidentialite', name: 'privacy', component: () => import('../views/PrivacyView.vue') }
  ]
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (to.meta.requiresAuth && !session) return { name: 'login' }
})

export default router