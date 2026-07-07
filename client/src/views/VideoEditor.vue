<template>
  <div class="video-editor">
    <h1>Video Editor</h1>

    <div v-if="!videoUuid" class="upload-area">
      <div class="drop-zone" @dragover.prevent @drop.prevent="handleDrop">
        <p>Drag & drop a video file here</p>
        <p class="upload-hint">or</p>
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
            :class="{ drawing: isDrawing, active: blurMode || itemPickId !== null }"
            :style="{ pointerEvents: (blurMode || itemPickId !== null) ? 'auto' : 'none' }">
            <template v-for="r in blurRegions" :key="r.id">
              <div v-if="currentTime >= r.start_time && currentTime <= r.end_time"
                class="blur-rect"
                :style="rectStyle(r)"
                :class="{ active: activeBlurId === r.id }">
              </div>
            </template>
            <div v-if="isDrawing" class="draw-rect" :style="drawStyle"></div>
            <template v-for="i in items" :key="'dot'+i.id">
              <div v-if="i.x != null && i.y != null && (i.end_time != null ? (currentTime >= i.timestamp && currentTime <= i.end_time) : Math.abs(currentTime - i.timestamp) < 0.3)"
                class="item-dot"
                :class="{ active: activeItemId === i.id }"
                :style="itemDotStyle(i)">
              </div>
            </template>
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
        <div v-if="itemPickId !== null" class="draw-confirm-bar pick-bar">
          <span>Click on the video to set the item position</span>
          <button @click="cancelItemPick">Cancel</button>
        </div>
        <div class="toolbar">
          <button @click="exportVideo">
            <span>&#9660;</span> Export Video
          </button>
          <button @click="exportSubtitleJson">
            <span>&#11021;</span> Export Subtitles JSON
          </button>
        </div>
        <div class="export-options">
          <label class="check-label">
            <input type="checkbox" v-model="exportBlur" :disabled="!blurRegions.length" />
            Export blurred video
          </label>
          <label class="check-label">
            <input type="checkbox" v-model="exportSubs" :disabled="!subtitles.length" />
            Export subbed video
          </label>
        </div>
      </div>

      <div class="sidebar">
        <div class="tab-headers">
          <button class="tab-header" :class="{ active: activeTab === 'subtitles' }" @click="activeTab = 'subtitles'">Subtitles ({{ subtitles.length }})</button>
          <button class="tab-header" :class="{ active: activeTab === 'blur' }" @click="activeTab = 'blur'">Blur ({{ blurRegions.length }})</button>
          <button class="tab-header" :class="{ active: activeTab === 'items' }" @click="activeTab = 'items'">Items ({{ items.length }})</button>
        </div>
        <div v-if="activeTab === 'subtitles'" class="tab-content">
          <div class="subtitle-upload">
            <button @click="addSubtitle">+ Add at Current Time</button>
          </div>
          <div class="subtitle-list" ref="subList">
            <div
              v-for="(sub, i) in subtitles"
              :key="i"
              class="sub-line"
              :class="{ active: subActiveIndex === i }"
              @click="seekTo(sub.start_time); showSubtitleModal = true"
            >
              <span class="time">{{ formatTime(sub.start_time) }} - {{ formatTime(sub.end_time) }}</span>
              <span class="text">{{ sub.text }}</span>
            </div>
            <div v-if="!subtitles.length" class="empty">No subtitles loaded</div>
          </div>
        </div>
        <div v-if="activeTab === 'blur'" class="tab-content">
          <div class="subtitle-upload">
            <button @click="toggleBlurMode" :class="{ active: blurMode }">{{ blurMode ? 'Cancel' : '+ Add at Current Time' }}</button>
          </div>
          <div class="subtitle-list" ref="blurList">
            <div
              v-for="r in blurRegions"
              :key="r.id"
              class="sub-line"
              :class="{ active: activeBlurId === r.id }"
              @click="seekTo(r.start_time); showBlurModal = true"
            >
              <span class="time">{{ formatTime(r.start_time) }} - {{ formatTime(r.end_time) }}</span>
              <span class="text">Blur ({{ r.width }}x{{ r.height }} at {{ r.x }},{{ r.y }})</span>
            </div>
            <div v-if="!blurRegions.length" class="empty">No blur regions. Click "Blur" then drag on the video.</div>
          </div>
        </div>
        <div v-if="activeTab === 'items'" class="tab-content">
          <div class="subtitle-upload">
            <button @click="addItem">+ Add at Current Time</button>
            <button @click="exportItemsJson" class="tiny-btn">Export JSON</button>
          </div>
          <div class="subtitle-list" ref="itemsList">
            <div
              v-for="i in items"
              :key="i.id"
              class="sub-line"
              :class="{ active: activeItemId === i.id }"
              @click="selectItem(i)"
            >
              <span class="time">{{ formatTime(i.timestamp) }}{{ i.end_time != null ? ' - ' + formatTime(i.end_time) : '' }}</span>
              <span class="text">{{ itemLabel(i) }}{{ i.x != null && i.y != null ? ' ('+i.x+','+i.y+')' : '' }}</span>
              <button class="danger tiny-btn" @click.stop="removeItem(i)">X</button>
            </div>
            <div v-if="!items.length" class="empty">No items yet</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Subtitle Modal -->
    <div v-if="showSubtitleModal" class="modal-overlay" @click.self="showSubtitleModal = false">
      <div class="modal">
        <h2>Edit Subtitles</h2>
        <p class="modal-hint">
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
        <p class="modal-hint">
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
              <button class="danger" @click="removeBlurRegion(i)">X</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showBlurModal = false; saveBlurRegions()">Close</button>
        </div>
      </div>
    </div>

    <!-- Item Modal -->
    <div v-if="showItemModal" class="modal-overlay" @click.self="showItemModal = false">
      <div class="modal">
        <h2>Edit Item</h2>
        <div class="obj-modal-time">
          <label>Start
            <span class="time-display">{{ formatTime(editingItem.timestamp) }}</span>
            <div class="time-btns">
              <button class="tiny-btn" @click="editingItem.timestamp = Math.max(0, +(editingItem.timestamp - 0.1).toFixed(3))">-0.1</button>
              <button class="tiny-btn" @click="editingItem.timestamp = +(editingItem.timestamp + 0.1).toFixed(3)">+0.1</button>
            </div>
          </label>
          <label>End
            <span class="time-display">{{ editingItem.end_time != null ? formatTime(editingItem.end_time) : '—' }}</span>
            <div class="time-btns">
              <button class="tiny-btn" @click="editingItem.end_time = editingItem.end_time != null ? Math.max(0, +(editingItem.end_time - 0.1).toFixed(3)) : +(editingItem.timestamp + 1).toFixed(3)">-0.1</button>
              <button class="tiny-btn" @click="editingItem.end_time = editingItem.end_time != null ? +(editingItem.end_time + 0.1).toFixed(3) : +(editingItem.timestamp + 1).toFixed(3)">+0.1</button>
            </div>
          </label>
          <label v-if="editingItem.x != null && editingItem.y != null">Position
            <span class="time-display" style="min-width:80px;">({{ editingItem.x }}, {{ editingItem.y }})</span>
          </label>
        </div>
        <div style="margin-top:8px;">
          <button @click="startItemPick(editingItem)" class="tiny-btn">Set position on video</button>
        </div>
        <h3 style="margin-top:12px;margin-bottom:8px;font-size:14px;">Properties</h3>
        <div class="obj-fields-list">
          <div v-for="(f, i) in editingItem.fields" :key="i" class="obj-field-row">
            <input type="text" v-model="f.key" placeholder="Key" class="field-key" />
            <input type="text" v-model="f.value" placeholder="Value" class="field-value" />
            <button class="danger tiny-btn" @click="editingItem.fields.splice(i,1)">X</button>
          </div>
        </div>
        <button @click="editingItem.fields.push({key:'', value:''})" class="add-field-btn">+ Add Property</button>
        <div class="modal-actions">
          <button @click="saveItem">Save</button>
          <button @click="showItemModal = false">Close</button>
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
      exportBlur: true,
      exportSubs: true,
      activeTab: 'subtitles',
      items: [],
      activeItemId: null,
      showItemModal: false,
      editingItem: { timestamp: 0, end_time: null, x: null, y: null, fields: [] },
      itemPickId: null,
    }
  },
  async mounted() {
    const uuid = this.$route.params.uuid
    if (uuid) {
      this.videoUuid = uuid
      this.videoUrl = api.videoStreamUrl(uuid)
      await this.loadSubtitles()
      await this.loadItems()
      await this.loadBlurRegions()
    }
  },
  methods: {
    async handleUpload(e) {
      const file = e.target.files?.[0] || e.dataTransfer?.files?.[0]
      if (!file) return
      this.uploading = true
      this.uploadProgress = 0
      try {
        const result = await api.uploadVideo(file, (pct) => { this.uploadProgress = pct })
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

      const item = this.items.find(i => i.end_time != null ? (current >= i.timestamp && current <= i.end_time) : Math.abs(current - i.timestamp) < 0.3)
      this.activeItemId = item ? item.id : null
      if (item && this.$refs.itemsList) {
        const itemIdx = this.items.indexOf(item)
        const el = this.$refs.itemsList.children[itemIdx]
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
    async exportItemsJson() {
      try {
        const res = await api.exportItemsJson(this.videoUuid)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `items-${this.videoUuid}.json`
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
          subtitles: this.exportSubs && this.subtitles.length ? this.subtitles : undefined,
          blur_regions: this.exportBlur && this.blurRegions.length ? this.blurRegions : undefined,
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
    async loadBlurRegions() {
      try {
        this.blurRegions = await api.getBlurRegions(this.videoUuid)
        if (this.blurRegions.length > 0) {
          blurIdCounter = Math.max(...this.blurRegions.map(r => r.id), 0)
        }
      } catch {}
    },
    async saveBlurRegions() {
      try {
        await api.saveBlurRegions(this.videoUuid, this.blurRegions)
      } catch (err) {
        alert('Failed to save blur regions: ' + err.message)
      }
    },
    removeBlurRegion(index) {
      this.blurRegions.splice(index, 1)
      this.saveBlurRegions()
    },

    // Items
    async loadItems() {
      try { this.items = await api.getItems(this.videoUuid) } catch {}
    },
    async addItem() {
      const current = this.$refs.video?.currentTime || 0
      try {
        const item = await api.createItem(this.videoUuid, {
          timestamp: current,
          end_time: null,
          x: null,
          y: null,
          fields: [],
        })
        this.items.push(item)
        this.editingItem = { ...item }
        this.showItemModal = true
      } catch (err) {
        alert('Failed to create item: ' + err.message)
      }
    },
    selectItem(i) {
      this.editingItem = { ...i, fields: i.fields.map(f => ({ ...f })) }
      this.showItemModal = true
    },
    itemLabel(i) {
      if (!i.fields || !i.fields.length) return '(empty)'
      const first = i.fields[0]
      return first.key && first.value ? `${first.key}: ${first.value}` : '(empty)'
    },
    async saveItem() {
      try {
        await api.deleteItem(this.editingItem.id)
        const item = await api.createItem(this.videoUuid, {
          timestamp: this.editingItem.timestamp,
          end_time: this.editingItem.end_time ?? null,
          x: this.editingItem.x ?? null,
          y: this.editingItem.y ?? null,
          fields: this.editingItem.fields.filter(f => f.key || f.value),
        })
        const idx = this.items.findIndex(i => i.id === this.editingItem.id)
        if (idx >= 0) this.items.splice(idx, 1, item)
        else this.items.push(item)
        this.editingItem = item
        alert('Item saved!')
      } catch (err) {
        alert('Save failed: ' + err.message)
      }
    },
    async removeItem(i) {
      if (!confirm('Delete this item?')) return
      try {
        await api.deleteItem(i.id)
        const idx = this.items.indexOf(i)
        if (idx >= 0) this.items.splice(idx, 1)
        if (this.editingItem.id === i.id) this.showItemModal = false
      } catch (err) {
        alert('Delete failed: ' + err.message)
      }
    },
    startItemPick(i) {
      this.showItemModal = false
      this.itemPickId = i.id
      this.editingItem = { ...i, fields: i.fields.map(f => ({ ...f })) }
    },
    cancelItemPick() {
      this.itemPickId = null
    },
    async handleItemPick(e) {
      const item = this.items.find(i => i.id === this.itemPickId)
      if (!item) return
      const video = this.$refs.video
      if (!video || !this.videoWidth || !this.videoHeight) return
      const vr = video.getBoundingClientRect()
      const scaleX = this.videoWidth / vr.width
      const scaleY = this.videoHeight / vr.height
      const x = Math.round((e.clientX - vr.left) * scaleX)
      const y = Math.round((e.clientY - vr.top) * scaleY)
      if (x < 0 || y < 0 || x > this.videoWidth || y > this.videoHeight) return
      this.itemPickId = null
      item.x = x
      item.y = y
      this.editingItem.x = x
      this.editingItem.y = y
      try {
        await api.deleteItem(item.id)
        const updated = await api.createItem(this.videoUuid, {
          timestamp: item.timestamp,
          end_time: item.end_time ?? null,
          x: item.x,
          y: item.y,
          fields: item.fields,
        })
        Object.assign(item, updated)
        Object.assign(this.editingItem, updated)
      } catch (err) {
        alert('Failed to save position: ' + err.message)
      }
    },
    itemDotStyle(i) {
      const video = this.$refs?.video
      if (!video || i.x == null || i.y == null) return {}
      const vr = video.getBoundingClientRect()
      const scaleX = vr.width / (this.videoWidth || 1)
      const scaleY = vr.height / (this.videoHeight || 1)
      return {
        left: `${i.x * scaleX}px`,
        top: `${i.y * scaleY}px`,
      }
    },

    // Drag-to-select blur region
    onMouseDown(e) {
      if (e.button !== 0) return
      if (this.itemPickId !== null) { this.handleItemPick(e); return }
      if (!this.blurMode) return
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
      this.saveBlurRegions()
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

.drop-zone { border: 2px dashed var(--border-light); border-radius: 12px; padding: 60px; text-align: center; cursor: pointer; transition: border-color .2s; }
.drop-zone:hover { border-color: var(--accent); }
.progress { margin-top: 12px; text-align: center; color: var(--accent); }

.editor-layout { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
@media (min-width: 1600px) { .editor-layout { grid-template-columns: 1fr 400px; gap: 24px; } }
@media (min-width: 2200px) { .editor-layout { grid-template-columns: 1fr 440px; gap: 28px; } }

.video-section .video-wrapper { position: relative; display: inline-block; width: 100%; }
.video-section video { width: 100%; border-radius: 8px; background: var(--bg-video); max-height: calc(100vh - 260px); display: block; }
@media (min-width: 1600px) { .video-section video { max-height: calc(100vh - 280px); } }
@media (min-width: 2200px) { .video-section video { max-height: calc(100vh - 320px); } }

.selection-overlay { position: absolute; inset: 0; z-index: 10; }
.selection-overlay.active { cursor: crosshair; }
.selection-overlay.active::before { content: 'Click and drag to select blur area'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); background: rgba(0,0,0,.75); color: #fff; padding: 10px 20px; border-radius: 8px; font-size: 14px; pointer-events: none; white-space: nowrap; z-index: 5; }
.selection-overlay.drawing { cursor: crosshair; }
.selection-overlay.drawing::before { display: none; }

.blur-rect { position: absolute; border: 2px solid rgba(255, 165, 0, 0.8); background: rgba(255, 165, 0, 0.15); pointer-events: none; }
.blur-rect.active { border-color: var(--accent); background: rgba(59, 130, 246, 0.2); }

.draw-rect { position: absolute; border: 2px dashed #fff; background: rgba(255,255,255,0.1); pointer-events: none; }

.timestamp-bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding: 8px 14px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; }
.timestamp-label { font-family: monospace; font-size: 18px; color: var(--accent); letter-spacing: 1px; }
.copy-btn { background: none; border: 1px solid var(--border-light); color: var(--text-secondary); padding: 4px 10px; border-radius: 4px; font-size: 14px; cursor: pointer; }
.copy-btn:hover { color: var(--text-primary); border-color: var(--text-secondary); }
.export-options { display: flex; gap: 20px; margin-top: 10px; padding: 8px 14px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; }
.check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
.check-label input[type=checkbox] { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
.check-label input:disabled { opacity: 0.4; cursor: default; }
.draw-confirm-bar { display: flex; align-items: center; gap: 12px; margin-top: 8px; padding: 10px 16px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; }
.draw-confirm-bar span { flex: 1; color: var(--text-secondary); font-family: monospace; }

.toolbar { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.toolbar button { font-size: 13px; padding: 6px 12px; }
.toolbar button span { margin-right: 4px; }
.toolbar button.active { background: var(--danger); }
.toolbar button.active:hover { background: var(--danger-hover); }

.sidebar { display: flex; flex-direction: column; }
.tab-headers { display: flex; border-bottom: 1px solid var(--border-subtle); margin-bottom: 12px; }
.tab-header { flex: 1; padding: 8px 12px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-secondary); font-size: 13px; cursor: pointer; transition: color .15s, border-color .15s; font-weight: 500; }
.tab-header:hover { color: var(--text-primary); }
.tab-header.active { color: var(--text-primary); border-bottom-color: var(--accent); font-weight: 600; }
.tab-content { flex: 1; overflow: auto; }
.subtitle-upload { margin-bottom: 12px; }
.subtitle-list { max-height: calc(100vh - 320px); overflow-y: auto; }
@media (min-width: 1600px) { .subtitle-list { max-height: calc(100vh - 340px); } }
@media (min-width: 2200px) { .subtitle-list { max-height: calc(100vh - 380px); } }
.sub-line { padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: background .15s; margin-bottom: 4px; border-left: 3px solid transparent; }
.sub-line:hover { background: color-mix(in srgb, var(--bg-surface), var(--text-primary) 8%); }
.sub-line.active { background: color-mix(in srgb, var(--bg-page), var(--accent) 30%); border-left-color: var(--accent); }
.sub-line .time { display: block; font-size: 11px; color: var(--text-secondary); font-family: monospace; }
.sub-line .text { display: block; font-size: 13px; margin-top: 2px; }
.empty { color: var(--text-muted); font-size: 13px; padding: 20px; text-align: center; }
.upload-hint { color: var(--text-muted); font-size: 13px; margin-top: 8px; }
.modal-hint { color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; }
.draw-confirm-bar.pick-bar { border-color: var(--accent); }

.modal-overlay { position: fixed; inset: 0; background: var(--modal-overlay); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: 90%; max-width: 700px; max-height: 80vh; overflow-y: auto; }
.modal h2 { margin-bottom: 8px; }
.sub-edit-list { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
.sub-edit-row { display: flex; gap: 6px; align-items: center; }
.blur-edit-row { background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px; }
.blur-time-row { display: flex; gap: 8px; margin-bottom: 6px; }
.blur-pos-row { display: flex; gap: 6px; align-items: center; }
.time-control { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.time-display { font-family: monospace; font-size: 13px; color: var(--accent); background: var(--bg-page); padding: 4px 8px; border-radius: 4px; min-width: 110px; text-align: center; }
.time-btns { display: flex; gap: 3px; }
.tiny-btn { background: var(--bg-elevated); border: 1px solid var(--border-light); color: var(--text-secondary); padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer; line-height: 1.2; }
.tiny-btn:hover { background: var(--bg-surface); color: var(--text-primary); }
.time-input { width: 100px; font-family: monospace; }
.time-input-sm { width: 70px; font-family: monospace; }
.text-input { flex: 1; }
.sub-edit-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.blur-edit-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.modal-actions { display: flex; gap: 8px; margin-top: 12px; }
.item-dot { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: var(--purple); border: 2px solid #fff; transform: translate(-50%,-50%); pointer-events: none; z-index: 5; box-shadow: 0 0 6px rgba(139,92,246,.6); }
.item-dot.active { background: var(--danger); box-shadow: 0 0 8px rgba(239,68,68,.8); width: 16px; height: 16px; }
.obj-modal-time { display: flex; gap: 20px; margin-top: 10px; }
.obj-modal-time label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.obj-fields-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; max-height: 250px; overflow-y: auto; }
.obj-field-row { display: flex; gap: 6px; align-items: center; }
.field-key { width: 120px; }
.field-value { flex: 1; }
.add-field-btn { background: none; border: 1px dashed var(--border-light); color: var(--text-secondary); padding: 6px; border-radius: 6px; width: 100%; font-size: 12px; cursor: pointer; }
.add-field-btn:hover { border-color: var(--purple); color: var(--purple); }
</style>
