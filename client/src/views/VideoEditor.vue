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
        <div class="video-wrapper" ref="videoWrapper">
          <video ref="video" :src="videoUrl" controls @timeupdate="onTimeUpdate" @loadedmetadata="onLoaded"></video>
          <div class="selection-overlay"
            @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp"
            :class="{ drawing: isDrawing, active: blurMode }"
            :style="{ pointerEvents: blurMode ? 'auto' : 'none' }">
            <div v-for="r in blurRegions" :key="r.id"
              class="blur-rect"
              :style="rectStyle(r)"
              :class="{ active: activeBlurId === r.id }">
            </div>
            <div v-if="isDrawing" class="draw-rect" :style="drawStyle"></div>
          </div>
        </div>
        <div class="timestamp-bar">
          <span class="timestamp-label">{{ formatTime(currentTime) }}</span>
          <button class="copy-btn" @click="copyTimestamp" title="Copy timestamp to clipboard">&#128203;</button>
        </div>
        <div v-if="drawConfirm" class="draw-confirm-bar">
          <span>Selection: {{ drawConfirm.w }}x{{ drawConfirm.h }} at ({{ drawConfirm.x }}, {{ drawConfirm.y }})</span>
          <button @click="confirmBlurRegion">Add Blur Region</button>
          <button @click="cancelDraw">Cancel</button>
        </div>

        <div class="toolbar">
          <button @click="showSubtitleModal = true">
            <span>&#10014;</span> Subtitles ({{ subtitles.length }})
          </button>
          <button @click="toggleBlurMode" :class="{ active: blurMode }">
            <span>&#9670;</span> {{ blurMode ? 'Cancel Blur' : 'Blur' }}
          </button>
          <button @click="showBlurModal = true">
            <span>&#9998;</span> Edit Blur Regions ({{ blurRegions.length }})
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

        <h3 style="margin-top:20px;">Blur Regions</h3>
        <div class="subtitle-list" ref="blurList">
          <div
            v-for="r in blurRegions"
            :key="r.id"
            class="sub-line"
            :class="{ active: activeBlurId === r.id }"
            @click="seekTo(r.start_time)"
          >
            <span class="time">{{ formatTime(r.start_time) }} - {{ formatTime(r.end_time) }}</span>
            <span class="text">Blur ({{ r.width }}x{{ r.height }} at {{ r.x }},{{ r.y }})</span>
          </div>
          <div v-if="!blurRegions.length" class="empty">No blur regions. Click "Blur" then drag on the video.</div>
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
            <div class="time-control">
              <span class="time-display">{{ formatTime(sub.start_time) }}</span>
              <div class="time-btns">
                <button class="tiny-btn" @click="sub.start_time = Math.max(0, +(sub.start_time - 0.1).toFixed(3))">-0.1</button>
                <button class="tiny-btn" @click="sub.start_time = +(sub.start_time + 0.1).toFixed(3)">+0.1</button>
              </div>
            </div>
            <div class="time-control">
              <span class="time-display">{{ formatTime(sub.end_time) }}</span>
              <div class="time-btns">
                <button class="tiny-btn" @click="sub.end_time = Math.max(0, +(sub.end_time - 0.1).toFixed(3))">-0.1</button>
                <button class="tiny-btn" @click="sub.end_time = +(sub.end_time + 0.1).toFixed(3)">+0.1</button>
              </div>
            </div>
            <input type="text" v-model="sub.text" class="text-input" placeholder="subtitle text" />
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

    <!-- Blur Edit Modal -->
    <div v-if="showBlurModal" class="modal-overlay" @click.self="showBlurModal = false">
      <div class="modal">
        <h2>Edit Blur Regions</h2>
        <p style="color:#888;font-size:13px;margin-bottom:12px;">
          Each region has a time range and position. Drag on the video to add new regions.
        </p>
        <div class="sub-edit-list">
          <div v-for="(r, i) in blurRegions" :key="r.id" class="blur-edit-row">
            <div class="blur-time-row">
              <div class="time-control">
                <label>Start</label>
                <span class="time-display">{{ formatTime(r.start_time) }}</span>
                <div class="time-btns">
                  <button class="tiny-btn" @click="r.start_time = Math.max(0, +(r.start_time - 0.1).toFixed(3))">-0.1</button>
                  <button class="tiny-btn" @click="r.start_time = +(r.start_time + 0.1).toFixed(3)">+0.1</button>
                </div>
              </div>
              <div class="time-control">
                <label>End</label>
                <span class="time-display">{{ formatTime(r.end_time) }}</span>
                <div class="time-btns">
                  <button class="tiny-btn" @click="r.end_time = Math.max(0, +(r.end_time - 0.1).toFixed(3))">-0.1</button>
                  <button class="tiny-btn" @click="r.end_time = +(r.end_time + 0.1).toFixed(3)">+0.1</button>
                </div>
              </div>
            </div>
            <div class="blur-pos-row">
              <label>X <input type="number" v-model.number="r.x" class="time-input-sm" /></label>
              <label>Y <input type="number" v-model.number="r.y" class="time-input-sm" /></label>
              <label>W <input type="number" v-model.number="r.width" class="time-input-sm" /></label>
              <label>H <input type="number" v-model.number="r.height" class="time-input-sm" /></label>
              <button class="danger" @click="blurRegions.splice(i,1)">X</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
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
let blurIdCounter = 0

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
      activeBlurId: null,
      showSubtitleModal: false,
      showBlurModal: false,
      exporting: false,
      subtitleFile: null,
      blurMode: false,
      currentTime: 0,
      isDrawing: false,
      drawStart: null,
      drawEnd: null,
      drawConfirm: null,
      videoWidth: 0,
      videoHeight: 0,
      wrapperRect: null,
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
    onLoaded() {
      const v = this.$refs.video
      if (!v) return
      this.videoWidth = v.videoWidth || 0
      this.videoHeight = v.videoHeight || 0
    },
    onTimeUpdate() {
      const current = this.$refs.video?.currentTime || 0
      this.currentTime = current

      const subIdx = this.subtitles.findIndex(s => current >= s.start_time && current <= s.end_time)
      this.subActiveIndex = subIdx
      if (subIdx >= 0 && this.$refs.subList) {
        const el = this.$refs.subList.children[subIdx]
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }

      const blur = this.blurRegions.find(r => current >= r.start_time && current <= r.end_time)
      this.activeBlurId = blur ? blur.id : null
      if (blur && this.$refs.blurList) {
        const blurIdx = this.blurRegions.indexOf(blur)
        const el = this.$refs.blurList.children[blurIdx]
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    },
    seekTo(time) {
      if (this.$refs.video) this.$refs.video.currentTime = time
    },
    formatTime(t) {
      const h = Math.floor(t / 3600)
      const m = Math.floor((t % 3600) / 60)
      const sec = Math.floor(t % 60)
      const ms = Math.round((t % 1) * 1000)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
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
          video_width: this.videoWidth,
          video_height: this.videoHeight,
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

    copyTimestamp() {
      const t = this.currentTime
      const str = this.formatTime(t)
      navigator.clipboard.writeText(str).catch(() => {
        const ta = document.createElement('textarea')
        ta.value = str
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
      })
    },
    toggleBlurMode() {
      this.blurMode = !this.blurMode
      if (!this.blurMode) this.cancelDraw()
    },
    // Drag-to-select blur region
    onMouseDown(e) {
      if (e.button !== 0 || !this.blurMode) return
      const rect = this.$refs.videoWrapper.getBoundingClientRect()
      this.wrapperRect = rect
      this.isDrawing = true
      this.drawStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      this.drawEnd = null
      this.drawConfirm = null
    },
    onMouseMove(e) {
      if (!this.isDrawing) return
      const rect = this.wrapperRect || this.$refs.videoWrapper.getBoundingClientRect()
      this.drawEnd = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    },
    onMouseUp() {
      if (!this.isDrawing || !this.drawStart || !this.drawEnd) {
        this.isDrawing = false
        return
      }
      this.isDrawing = false
      const s = this.normalizedCoords(this.drawStart)
      const en = this.normalizedCoords(this.drawEnd)
      const x = Math.min(s.x, en.x)
      const y = Math.min(s.y, en.y)
      const w = Math.abs(en.x - s.x)
      const h = Math.abs(en.y - s.y)
      if (w < 5 || h < 5) {
        this.drawStart = null
        this.drawEnd = null
        return
      }
      this.drawConfirm = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
      this.drawStart = null
      this.drawEnd = null
    },
    normalizedCoords(pt) {
      const wrapper = this.$refs.videoWrapper.getBoundingClientRect()
      const video = this.$refs.video.getBoundingClientRect()
      const offsetX = video.left - wrapper.left
      const offsetY = video.top - wrapper.top
      const scaleX = (this.videoWidth || 1) / video.width
      const scaleY = (this.videoHeight || 1) / video.height
      return {
        x: (pt.x - offsetX) * scaleX,
        y: (pt.y - offsetY) * scaleY,
      }
    },
    confirmBlurRegion() {
      if (!this.drawConfirm) return
      const current = this.$refs.video?.currentTime || 0
      blurIdCounter++
      this.blurRegions.push({
        id: blurIdCounter,
        x: this.drawConfirm.x,
        y: this.drawConfirm.y,
        width: this.drawConfirm.w,
        height: this.drawConfirm.h,
        start_time: current,
        end_time: current + 3,
      })
      this.drawConfirm = null
      this.blurMode = false
    },
    cancelDraw() {
      this.drawConfirm = null
      this.blurMode = false
    },
    rectStyle(r) {
      const video = this.$refs?.video
      if (!video) return {}
      const vr = video.getBoundingClientRect()
      const scaleX = vr.width / (this.videoWidth || 1)
      const scaleY = vr.height / (this.videoHeight || 1)
      return {
        left: `${r.x * scaleX}px`,
        top: `${r.y * scaleY}px`,
        width: `${r.width * scaleX}px`,
        height: `${r.height * scaleY}px`,
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

.video-section .video-wrapper { position: relative; display: inline-block; width: 100%; }
.video-section video { width: 100%; border-radius: 8px; background: #000; max-height: 500px; display: block; }

.selection-overlay { position: absolute; inset: 0; z-index: 10; }
.selection-overlay.active { cursor: crosshair; }
.selection-overlay.active::before { content: 'Click and drag to select blur area'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(0,0,0,.75); color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; pointer-events: none; white-space: nowrap; z-index: 5; }
.selection-overlay.drawing { cursor: crosshair; }
.selection-overlay.drawing::before { display: none; }

.blur-rect { position: absolute; border: 2px solid rgba(255, 165, 0, 0.8); background: rgba(255, 165, 0, 0.15); pointer-events: none; }
.blur-rect.active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.2); }

.draw-rect { position: absolute; border: 2px dashed #fff; background: rgba(255,255,255,0.1); pointer-events: none; }

.timestamp-bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 14px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; }
.timestamp-label { font-family: monospace; font-size: 18px; color: #3b82f6; letter-spacing: 1px; }
.copy-btn { background: none; border: 1px solid #444; color: #aaa; padding: 4px 10px; border-radius: 4px; font-size: 14px; cursor: pointer; }
.copy-btn:hover { color: #fff; border-color: #888; }
.draw-confirm-bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; padding: 10px 16px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; font-size: 13px; }
.draw-confirm-bar span { flex: 1; color: #ccc; font-family: monospace; }

.toolbar { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.toolbar button { font-size: 13px; padding: 6px 12px; }
.toolbar button span { margin-right: 4px; }
.toolbar button.active { background: #ef4444; }
.toolbar button.active:hover { background: #dc2626; }

.sidebar h3 { margin-bottom: 8px; }
.subtitle-upload { margin-bottom: 12px; }
.subtitle-list { max-height: 300px; overflow-y: auto; }
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
.blur-edit-row { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px; }
.blur-time-row { display: flex; gap: 8px; margin-bottom: 6px; }
.blur-pos-row { display: flex; gap: 6px; align-items: center; }
.time-control { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.time-display { font-family: monospace; font-size: 13px; color: #3b82f6; background: #0f0f0f; padding: 4px 8px; border-radius: 4px; min-width: 110px; text-align: center; }
.time-btns { display: flex; gap: 3px; }
.tiny-btn { background: #2a2a2a; border: 1px solid #444; color: #ccc; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; line-height: 1.2; }
.tiny-btn:hover { background: #3a3a3a; color: #fff; }
.time-input { width: 100px; font-family: monospace; }
.time-input-sm { width: 70px; font-family: monospace; }
.text-input { flex: 1; }
.sub-edit-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #888; }
.blur-edit-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #888; }
.modal-actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
