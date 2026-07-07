<template>
  <div class="video-editor">
    <h1>Video Editor</h1>

    <div v-if="!videoUuid" class="upload-area">
      <div class="drop-zone" @dragover.prevent @drop.prevent="handleDrop">
        <p>Drag & drop a video file here</p>
        <p style="color:#666;font-size:13px;margin-top:8px;">or</p>
        <input type="file" accept="video/*" @change="handleUpload" id="video-input" hidden />
        <button @click="$refs.input.click()">Choose File</button>
        <input ref="input" type="file" accept="video/*" @change="handleUpload" hidden />
      </div>
      <div v-if="uploading" class="progress">{{ uploadProgress }}%</div>
    </div>

    <div v-else class="editor-layout">
      <div class="video-section">
        <video ref="video" :src="videoUrl" controls @timeupdate="onTimeUpdate" @loadedmetadata="onLoaded"></video>

        <div class="toolbar">
          <button @click="showSubtitleModal = true">
            <span>&#10014;</span> Subtitles ({{ subtitles.length }})
          </button>
          <button @click="showBlurModal = true">
            <span>&#9670;</span> Blur Region ({{ blurRegions.length }})
          </button>
          <button @click="exportVideo">
            <span>&#9660;</span> Export Video
          </button>
          <button @click="exportSubtitleJson">
            <span>&#11021;</span> Export Subtitles JSON
          </button>
        </div>
      </div>

      <div class="sidebar">
        <h3>Subtitles</h3>
        <div class="subtitle-upload">
          <input type="file" accept=".srt,.vtt,.txt" @change="handleSubtitleUpload" ref="subInput" hidden />
          <button @click="addSubtitle">+ Add at Current Time</button>
          <button @click="$refs.subInput.click()">Upload SRT</button>
        </div>
        <div class="subtitle-list" ref="subList">
          <div
            v-for="(sub, i) in subtitles"
            :key="i"
            class="sub-line"
            :class="{ active: subActiveIndex === i }"
            @click="seekTo(sub.start_time)"
          >
            <span class="time">{{ formatTime(sub.start_time) }} - {{ formatTime(sub.end_time) }}</span>
            <span class="text">{{ sub.text }}</span>
          </div>
          <div v-if="!subtitles.length" class="empty">No subtitles loaded</div>
        </div>
      </div>
    </div>

    <!-- Subtitle Modal -->
    <div v-if="showSubtitleModal" class="modal-overlay" @click.self="showSubtitleModal = false">
      <div class="modal">
        <h2>Edit Subtitles</h2>
        <p style="color:#888;font-size:13px;margin-bottom:12px;">
          Each line shows start time, end time, and text. Click any row to jump the video to that time.
        </p>
        <div class="sub-edit-list">
          <div v-for="(sub, i) in subtitles" :key="i" class="sub-edit-row">
            <input type="number" step="0.001" v-model.number="sub.start_time" class="time-input" />
            <input type="number" step="0.001" v-model.number="sub.end_time" class="time-input" />
            <input type="text" v-model="sub.text" class="text-input" />
            <button class="danger" @click="removeSubtitle(i)">X</button>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="addSubtitle">+ Add Line</button>
          <button @click="saveSubtitles">Save</button>
          <button @click="showSubtitleModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Blur Modal -->
    <div v-if="showBlurModal" class="modal-overlay" @click.self="showBlurModal = false">
      <div class="modal">
        <h2>Blur Regions</h2>
        <p style="color:#888;font-size:13px;margin-bottom:12px;">
          Define regions to blur. Specify x, y, width, height as pixel values.
        </p>
        <div class="sub-edit-list">
          <div v-for="(r, i) in blurRegions" :key="i" class="sub-edit-row">
            <label>X <input type="number" v-model.number="r.x" class="time-input-sm" /></label>
            <label>Y <input type="number" v-model.number="r.y" class="time-input-sm" /></label>
            <label>W <input type="number" v-model.number="r.width" class="time-input-sm" /></label>
            <label>H <input type="number" v-model.number="r.height" class="time-input-sm" /></label>
            <button class="danger" @click="blurRegions.splice(i,1)">X</button>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="blurRegions.push({x:0,y:0,width:200,height:100})">+ Add Region</button>
          <button @click="showBlurModal = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Export Progress -->
    <div v-if="exporting" class="modal-overlay">
      <div class="modal" style="text-align:center;">
        <h2>Exporting...</h2>
        <p>Your video is being processed. It will download automatically when ready.</p>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '../services/api.js'
export default {
  data() {
    return {
      videoUuid: null,
      videoUrl: '',
      uploading: false,
      uploadProgress: 0,
      subtitles: [],
      blurRegions: [],
      subActiveIndex: -1,
      showSubtitleModal: false,
      showBlurModal: false,
      exporting: false,
      subtitleFile: null,
    }
  },
  async mounted() {
    const uuid = this.$route.params.uuid
    if (uuid) {
      this.videoUuid = uuid
      this.videoUrl = api.videoStreamUrl(uuid)
      await this.loadSubtitles()
    }
  },
  methods: {
    async handleUpload(e) {
      const file = e.target.files?.[0] || e.dataTransfer?.files?.[0]
      if (!file) return
      this.uploading = true
      try {
        const result = await api.uploadVideo(file)
        this.videoUuid = result.uuid
        this.videoUrl = api.videoStreamUrl(result.uuid)
        this.$router.replace(`/video/${result.uuid}`)
      } catch (err) {
        alert('Upload failed: ' + err.message)
      } finally {
        this.uploading = false
      }
    },
    handleDrop(e) {
      const file = e.dataTransfer.files[0]
      if (file) this.handleUpload({ target: { files: [file] } })
    },
    async loadSubtitles() {
      try {
        this.subtitles = await api.getSubtitles(this.videoUuid)
      } catch {}
    },
    onTimeUpdate() {
      const current = this.$refs.video.currentTime
      const idx = this.subtitles.findIndex(s => current >= s.start_time && current <= s.end_time)
      this.subActiveIndex = idx
      if (idx >= 0 && this.$refs.subList) {
        const el = this.$refs.subList.children[idx]
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    onLoaded() {
      if (this.subtitles.length && this.$refs.video) {
        this.$refs.video.currentTime = this.subtitles[0].start_time
      }
    },
    seekTo(time) {
      if (this.$refs.video) this.$refs.video.currentTime = time
    },
    formatTime(t) {
      const h = Math.floor(t / 3600)
      const m = Math.floor((t % 3600) / 60)
      const s = (t % 60).toFixed(1)
      return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(4,'0')}`
        : `${m}:${String(s).padStart(4,'0')}`
    },
    addSubtitle() {
      const currentTime = this.$refs.video?.currentTime || 0
      this.subtitles.push({ start_time: currentTime, end_time: currentTime + 2, text: '' })
    },
    removeSubtitle(i) { this.subtitles.splice(i, 1) },
    async saveSubtitles() {
      try {
        await api.saveSubtitles(this.videoUuid, this.subtitles)
        alert('Subtitles saved!')
      } catch (err) {
        alert('Save failed: ' + err.message)
      }
    },
    async handleSubtitleUpload(e) {
      const file = e.target.files?.[0]
      if (!file) return
      this.subtitleFile = file
      try {
        await api.uploadSubtitleFile(this.videoUuid, file)
        await this.loadSubtitles()
        alert('Subtitles imported from file!')
      } catch (err) {
        alert('Import failed: ' + err.message)
      }
    },
    async exportSubtitleJson() {
      try {
        const res = await api.exportSubtitlesJson(this.videoUuid)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `subtitles-${this.videoUuid}.json`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        alert('Export failed: ' + err.message)
      }
    },
    async exportVideo() {
      this.exporting = true
      try {
        const res = await api.exportVideo(this.videoUuid, {
          subtitles: this.subtitles,
          blur_regions: this.blurRegions.length ? this.blurRegions : undefined,
        })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'exported-video.mp4'
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        alert('Export failed: ' + err.message)
      } finally {
        this.exporting = false
      }
    },
  },
}
</script>

<style scoped>
.video-editor h1 { margin-bottom: 20px; }

.drop-zone { border: 2px dashed #444; border-radius: 12px; padding: 60px; text-align: center; cursor: pointer; transition: border-color .2s; }
.drop-zone:hover { border-color: #3b82f6; }
.progress { margin-top: 12px; text-align: center; color: #3b82f6; }

.editor-layout { display: grid; grid-template-columns: 1fr 350px; gap: 20px; }

.video-section video { width: 100%; border-radius: 8px; background: #000; max-height: 500px; }
.toolbar { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.toolbar button { font-size: 13px; padding: 6px 12px; }
.toolbar button span { margin-right: 4px; }

.sidebar h3 { margin-bottom: 8px; }
.subtitle-upload { margin-bottom: 12px; }
.subtitle-list { max-height: 500px; overflow-y: auto; }
.sub-line { padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background .15s; margin-bottom: 4px; border-left: 3px solid transparent; }
.sub-line:hover { background: #1f2937; }
.sub-line.active { background: #1e3a5f; border-left-color: #3b82f6; }
.sub-line .time { display: block; font-size: 11px; color: #888; font-family: monospace; }
.sub-line .text { display: block; font-size: 13px; margin-top: 2px; }
.empty { color: #555; font-size: 13px; padding: 20px; text-align: center; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 24px; width: 90%; max-width: 700px; max-height: 80vh; overflow-y: auto; }
.modal h2 { margin-bottom: 8px; }
.sub-edit-list { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
.sub-edit-row { display: flex; gap: 6px; align-items: center; }
.time-input { width: 100px; font-family: monospace; }
.time-input-sm { width: 65px; font-family: monospace; }
.text-input { flex: 1; }
.sub-edit-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #888; }
.modal-actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
