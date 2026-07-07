<template>
  <div class="home">
    <h1>Media Editor</h1>
    <div class="cards">
      <router-link to="/video" class="card">
        <div class="icon">&#9654;</div>
        <h2>Video Editor</h2>
        <p>Upload videos, add subtitles, blur regions, and export</p>
      </router-link>
      <router-link to="/image" class="card">
        <div class="icon">&#128247;</div>
        <h2>Image Editor</h2>
        <p>Blur, rotate, crop, and flip images</p>
      </router-link>
    </div>
    <h2 v-if="media.length" style="margin-top: 40px;">Recent Media</h2>
    <div v-if="media.length" class="media-list">
      <div v-for="m in media" :key="m.uuid" class="media-item">
        <span class="badge" :class="m.type">{{ m.type }}</span>
        <span class="name">{{ m.original_name }}</span>
        <span class="info">{{ (m.size / 1024 / 1024).toFixed(1) }} MB</span>
        <router-link :to="`/${m.type}/${m.uuid}`" class="btn-sm">Open</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '../services/api.js'
export default {
  data() { return { media: [] } },
  async mounted() {
    try { this.media = await api.listMedia() } catch {}
  },
}
</script>

<style scoped>
.home h1 { font-size: 32px; margin-bottom: 24px; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 32px; text-decoration: none; color: inherit; transition: border-color .2s; }
.card:hover { border-color: #3b82f6; }
.card .icon { font-size: 40px; margin-bottom: 12px; }
.card h2 { margin-bottom: 8px; }
.card p { color: #888; font-size: 14px; }
.media-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.media-item { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
.media-item .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.media-item .badge.video { background: #3b82f6; color: #fff; }
.media-item .badge.image { background: #8b5cf6; color: #fff; }
.media-item .name { flex: 1; }
.media-item .info { color: #666; font-size: 13px; }
.btn-sm { padding: 4px 12px; border-radius: 4px; background: #3b82f6; color: #fff; text-decoration: none; font-size: 13px; }
</style>
