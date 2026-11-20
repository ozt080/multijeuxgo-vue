<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

const props = defineProps(['profile'])
const route = useRoute()
const isOpen = ref(false)
const mode = ref('general')
const friends = ref([])
const selectedFriend = ref('')
const messages = ref([])
const text = ref('')
let channel = null

const salonCode = () => (route.query.salon ? String(route.query.salon).toUpperCase() : null)

watch(() => route.query.salon, (val) => {
  if (val) { mode.value = 'salon'; isOpen.value = true }
  else if (mode.value === 'salon') { mode.value = 'general' }
  loadMessages()
}, { immediate: true })

async function loadFriends() {
  if (!props.profile) return
  const { data } = await supabase.from('profiles').select('id, pseudo').neq('id', props.profile.id)
  friends.value = data || []
  if (friends.value.length && !selectedFriend.value) selectedFriend.value = friends.value[0].id
}

async function loadMessages() {
  if (!props.profile) return
  let q = supabase.from('messages').select('*').order('id', { ascending: false }).limit(40)
  if (mode.value === 'salon' && salonCode()) {
    q = q.eq('room_code', salonCode())
  } else if (mode.value === 'prive' && selectedFriend.value) {
    q = q.is('room_code', null).or(`and(sender_id.eq.${props.profile.id},recipient_id.eq.${selectedFriend.value}),and(sender_id.eq.${selectedFriend.value},recipient_id.eq.${props.profile.id})`)
  } else {
    q = q.is('room_code', null).is('recipient_id', null)
  }
  const { data } = await q
  messages.value = (data || []).reverse()
}

async function sendMessage() {
  if (!text.value.trim() || !props.profile) return
  const payload = {
    sender_id: props.profile.id,
    sender_pseudo: props.profile.pseudo,
    content: text.value.trim().slice(0, 500),
    room_code: mode.value === 'salon' ? salonCode() : null,
    recipient_id: mode.value === 'prive' ? selectedFriend.value : null
  }
  text.value = ''
  await supabase.from('messages').insert(payload)
}

onMounted(() => {
  loadFriends()
  loadMessages()
  channel = supabase.channel('realtime-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadMessages())
    .subscribe()
})

onUnmounted(() => { if (channel) supabase.removeChannel(channel) })
</script>

<template>
  <div v-if="profile">
    <button class="chat-fab" @click="isOpen = !isOpen">💬 Chat</button>
    <div v-if="isOpen" class="chat-box">
      <div class="chat-head">
        <strong>💬 Discussion Live</strong>
        <button @click="isOpen = false">✕</button>
      </div>
      <div class="tabs">
        <button v-if="salonCode()" :class="{ active: mode === 'salon' }" @click="mode = 'salon'; loadMessages()">🎮 Salon</button>
        <button :class="{ active: mode === 'general' }" @click="mode = 'general'; loadMessages()">🌍 Général</button>
        <button :class="{ active: mode === 'prive' }" @click="mode = 'prive'; loadFriends(); loadMessages()">👥 Amis</button>
      </div>
      <select v-if="mode === 'prive'" v-model="selectedFriend" @change="loadMessages" class="friend-sel">
        <option v-for="f in friends" :key="f.id" :value="f.id">{{ f.pseudo }}</option>
      </select>
      <div class="msgs">
        <div v-for="m in messages" :key="m.id" :class="['bubble', m.sender_id === profile.id ? 'mine' : 'other']">
          <small>{{ m.sender_id === profile.id ? 'Moi' : m.sender_pseudo }}</small>
          <div>{{ m.content }}</div>
        </div>
      </div>
      <form @submit.prevent="sendMessage" class="send-row">
        <input v-model="text" @keydown.stop placeholder="Écrire un message..." />
        <button type="submit" class="btn-primary">➤</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.chat-fab { position: fixed; bottom: 20px; right: 20px; z-index: 90; background: linear-gradient(135deg, #6366f1, #ec4899); color: #fff; border: none; border-radius: 999px; padding: 13px 20px; font-weight: 800; cursor: pointer; }
.chat-box { position: fixed; bottom: 78px; right: 20px; width: 330px; height: 420px; background: #14192d; border: 1px solid rgba(255,255,255,0.15); border-radius: 18px; display: flex; flex-direction: column; z-index: 95; overflow: hidden; }
.chat-head { padding: 12px; background: #1b223c; display: flex; justify-content: space-between; }
.chat-head button { background: none; border: none; color: #94a3b8; cursor: pointer; }
.tabs { display: flex; gap: 4px; padding: 6px; background: #0f1424; }
.tabs button { flex: 1; background: none; border: none; color: #94a3b8; padding: 6px; border-radius: 8px; cursor: pointer; font-weight: 700; }
.tabs button.active { background: #6366f1; color: #fff; }
.friend-sel { margin: 6px; padding: 6px; background: #0b0e1a; color: #fff; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); }
.msgs { flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.bubble { max-width: 80%; padding: 8px 11px; border-radius: 12px; font-size: 0.85rem; }
.mine { align-self: flex-end; background: #6366f1; }
.other { align-self: flex-start; background: #1b223c; }
.bubble small { display: block; font-size: 0.68rem; opacity: 0.75; }
.send-row { display: flex; gap: 6px; padding: 8px; background: #1b223c; }
.send-row input { flex: 1; padding: 8px; border-radius: 8px; border: none; background: #0b0e1a; color: #fff; }
</style>