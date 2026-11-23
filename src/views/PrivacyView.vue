<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const router = useRouter()
const user = ref(null)
const deleting = ref(false)
const statusMsg = ref('')

onMounted(async () => {
  const { data } = await supabase.auth.getUser()
  user.value = data?.user || null
})

async function handleDeleteAccount() {
  if (!user.value || deleting.value) return
  const ok = confirm(
    'Es-tu sûr de vouloir supprimer définitivement ton compte MultiJeuxGo, ton profil, tes scores et tes messages ? Cette action est irréversible.'
  )
  if (!ok) return

  deleting.value = true
  statusMsg.value = ''
  try {
    const { error } = await supabase.rpc('delete_own_account')
    if (error) throw error
    await supabase.auth.signOut()
    user.value = null
    statusMsg.value = 'Ton compte et toutes tes données ont bien été supprimés.'
    setTimeout(() => router.push('/login'), 1500)
  } catch (err) {
    statusMsg.value = 'Erreur lors de la suppression : ' + (err.message || err)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="privacy-page">
    <div class="privacy-card">
      <div class="top-row">
        <h1>Politique de confidentialité — MultiJeuxGo</h1>
        <router-link to="/" class="btn-back">← Retour</router-link>
      </div>

      <p class="updated">Dernière mise à jour : Novembre 2026</p>

      <section>
        <h2>1. Données collectées</h2>
        <p>
          Lors de la création d'un compte sur <strong>MultiJeuxGo</strong>, nous collectons uniquement les données nécessaires au fonctionnement du jeu en ligne :
        </p>
        <ul>
          <li><strong>Identifiants de compte :</strong> adresse e-mail et mot de passe chiffré (gérés par Supabase Auth).</li>
          <li><strong>Profil joueur :</strong> pseudonyme choisi et score cumulé dans le classement.</li>
          <li><strong>Activité multijoueur :</strong> salons de jeu créés et messages envoyés dans le chat.</li>
        </ul>
      </section>

      <section>
        <h2>2. Utilisation et partage des données</h2>
        <p>
          Vos données sont utilisées exclusivement pour l'authentification, la sauvegarde de vos scores et les parties multijoueurs en temps réel. Aucune donnée personnelle n'est vendue ou transmise à des tiers publicitaires.
        </p>
      </section>

      <section>
        <h2>3. Conservation et suppression du compte</h2>
        <p>
          Vous pouvez supprimer définitivement votre compte et l'intégralité de vos données associées à tout moment directement depuis le bouton ci-dessous.
        </p>

        <div v-if="user" class="danger-zone">
          <p>Connecté en tant que : <strong>{{ user.email }}</strong></p>
          <button class="btn-delete" :disabled="deleting" @click="handleDeleteAccount">
            {{ deleting ? 'Suppression en cours...' : '🗑️ Supprimer définitivement mon compte' }}
          </button>
        </div>
        <p v-else class="hint">
          Connectez-vous à votre compte pour afficher le bouton de suppression immédiate.
        </p>

        <p v-if="statusMsg" class="status-msg">{{ statusMsg }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.privacy-page {
  max-width: 760px;
  margin: 28px auto;
  padding: 0 16px;
  color: #e2e8f0;
}
.privacy-card {
  background: #14192d;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
h1 {
  font-size: 1.35rem;
  margin: 0;
  color: #ffffff;
}
h2 {
  font-size: 1.05rem;
  color: #38bdf8;
  margin: 0 0 8px;
}
.updated {
  color: #94a3b8;
  font-size: 0.85rem;
  margin: -10px 0 0;
}
p, li {
  line-height: 1.55;
  color: #cbd5e1;
  font-size: 0.94rem;
}
ul {
  padding-left: 20px;
  margin: 6px 0 0;
}
.btn-back {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  text-decoration: none;
  padding: 8px 14px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.88rem;
}
.danger-zone {
  margin-top: 12px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.btn-delete {
  background: #dc2626;
  color: #ffffff;
  border: none;
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 800;
  cursor: pointer;
}
.btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.hint {
  color: #94a3b8;
  font-style: italic;
}
.status-msg {
  color: #fbbf24;
  font-weight: 700;
}
</style>