<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()
const isRegister = ref(false)
const pseudo = ref('')
const email = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMsg.value = ''
  loading.value = true
  try {
    if (isRegister.value) {
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value
      })
      if (error) throw error
      if (data.user) {
        const { error: profErr } = await supabase.from('profiles').insert({
          id: data.user.id,
          pseudo: pseudo.value.trim(),
          score: 0
        })
        if (profErr) throw profErr
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value
      })
      if (error) throw error
    }
    router.push('/')
  } catch (e) {
    errorMsg.value = e.message || 'Erreur d’authentification'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-box">
    <h2>{{ isRegister ? 'Créer un compte joueur' : 'Connexion à MultiJeuxGo' }}</h2>
    <p v-if="errorMsg" class="err">{{ errorMsg }}</p>
    <form @submit.prevent="handleSubmit">
      <input v-if="isRegister" v-model="pseudo" placeholder="Pseudo (ex: Berkan)" required />
      <input v-model="email" type="email" placeholder="Adresse e-mail" required />
      <input v-model="password" type="password" minlength="6" placeholder="Mot de passe (6 car. min)" required />
      <button type="submit" class="btn-primary" :disabled="loading">
        {{ loading ? 'Chargement...' : (isRegister ? 'S’inscrire et jouer' : 'Se connecter') }}
      </button>
    </form>
    <button class="link-btn" @click="isRegister = !isRegister">
      {{ isRegister ? 'Déjà un compte ? Se connecter' : 'Pas encore de compte ? Créer un profil' }}
    </button>
  </div>
</template>

<style scoped>
.auth-box { max-width: 400px; margin: 60px auto; background: #14192d; padding: 28px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 14px; }
form { display: flex; flex-direction: column; gap: 12px; }
input { padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: #0b0e1a; color: #fff; }
.err { color: #f87171; font-size: 0.9rem; }
.link-btn { background: none; border: none; color: #818cf8; cursor: pointer; font-weight: 700; }
</style>