<template>
  <div class="image-editor">
    <h1>Image Editor</h1>

    <div v-if="!imageUuid" class="upload-area">
      <div class="drop-zone" @dragover.prevent @drop.prevent="handleDrop">
        <p>Drag & drop an image here</p>
        <p class="upload-hint">or</p>
        <input type="file" accept="image/*" ref="fileInput" @change="handleUpload" hidden />
        <button @click="$refs.fileInput.click()">Choose File</button>
      </div>
      <p class="upload-hint-sm">Supports JPEG, PNG, GIF, WebP, TIFF, BMP, SVG, AVIF</p>
      <div v-if="uploading" class="progress">Uploading...</div>
    </div>

    <div v-else class="editor-layout">
      <div class="image-section">
        <div class="image-container">
          <img :src="imagePreview" ref="img" alt="preview" @load="imgLoaded = true" />
        </div>
        <div class="toolbar">
          <button @click="rotateLeft">Rotate -90</button>
          <button @click="rotateRight">Rotate +90</button>
          <button @click="flipHoriz">Flip H</button>
          <button @click="flipVert">Flip V</button>
          <button @click="showCrop = !showCrop" :class="{ active: showCrop }">Crop</button>
          <button @click="showBlurModal = true">Blur Regions</button>
          <select v-model="exportFormat">
            <option value="">Original format</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
          <button @click="processImage" :disabled="processing">Apply & Download</button>
        </div>
      </div>

      <div class="sidebar">
        <h3>Info</h3>
        <div class="info-list">
          <div><span>Name:</span> {{ imageInfo.original_name }}</div>
          <div><span>Dimensions:</span> {{ imageInfo.width }} x {{ imageInfo.height }}</div>
          <div><span>Size:</span> {{ (imageInfo.size / 1024).toFixed(1) }} KB</div>
        </div>

        <h3 style="margin-top:20px;">Adjustments</h3>
        <div class="adjustments">
          <label>Rotation: {{ rotation }}&deg;</label>
          <input type="range" min="0" max="360" v-model.number="rotation" />
          <label>Flip: {{ flipMode || 'none' }}</label>
        </div>

        <div v-if="showCrop" class="crop-controls">
          <h3>Crop</h3>
          <div class="crop-grid">
            <label>X: <input type="number" v-model.number="crop.x" /></label>
            <label>Y: <input type="number" v-model.number="crop.y" /></label>
            <label>W: <input type="number" v-model.number="crop.width" /></label>
            <label>H: <input type="number" v-model.number="crop.height" /></label>
          </div>
        </div>
      </div>
    </div>

    <!-- Blur Regions Modal -->
    <div v-if="showBlurModal" class="modal-overlay" @click.self="showBlurModal = false">
      <div class="modal">
        <h2>Blur Regions</h2>
        <p class="modal-hint">Regions to blur before export.</p>
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
          <button @click="blurRegions.push({x:50,y:50,width:150,height:100})">+ Add</button>
          <button @click="showBlurModal = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { api } from '../services/api.js'
export default {
  data() {
    return {
      imageUuid: null,
      imageInfo: {},
      imagePreview: '',
      uploading: false,
      processing: false,
      imgLoaded: false,
      rotation: 0,
      flipMode: '',
      crop: { x: 0, y: 0, width: 100, height: 100 },
      showCrop: false,
      showBlurModal: false,
      blurRegions: [],
      exportFormat: '',
    }
  },
  async mounted() {
    const uuid = this.$route.params.uuid
    if (uuid) {
      this.imageUuid = uuid
      await this.loadImage()
    }
  },
  methods: {
    async handleUpload(e) {
      const file = e.target.files?.[0] || e.dataTransfer?.files?.[0]
      if (!file) return
      this.uploading = true
      try {
        const result = await api.uploadImage(file)
        this.imageUuid = result.uuid
        this.imageInfo = result
        this.imagePreview = URL.createObjectURL(file)
        this.crop.width = result.width
        this.crop.height = result.height
        this.$router.replace(`/image/${result.uuid}`)
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
    async loadImage() {
      try {
        const list = await api.listImages()
        const found = list.find(m => m.uuid === this.imageUuid)
        if (found) {
          this.imageInfo = found
          this.crop.width = found.width
          this.crop.height = found.height
          this.imagePreview = await api.downloadImage(this.imageUuid)
            .then(res => res.blob())
            .then(blob => URL.createObjectURL(blob))
        }
      } catch {}
    },
    rotateLeft() { this.rotation = (this.rotation - 90 + 360) % 360 },
    rotateRight() { this.rotation = (this.rotation + 90) % 360 },
    flipHoriz() { this.flipMode = this.flipMode === 'horizontal' ? '' : 'horizontal' },
    flipVert() { this.flipMode = this.flipMode === 'vertical' ? '' : 'vertical' },
    async processImage() {
      this.processing = true
      try {
        const params = {}
        if (this.rotation) params.rotate = this.rotation
        if (this.flipMode) params.flip = this.flipMode
        if (this.showCrop) params.crop = { ...this.crop }
        if (this.blurRegions.length) params.blur = this.blurRegions
        if (this.exportFormat) params.format = this.exportFormat

        const res = await api.processImage(this.imageUuid, params)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const ext = this.exportFormat || (this.imageInfo.original_name || '').split('.').pop() || 'png'
        a.download = `edited-image.${ext}`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        alert('Processing failed: ' + err.message)
      } finally {
        this.processing = false
      }
    },
  },
}
</script>

<style scoped>
.image-editor h1 { margin-bottom: 20px; }

.drop-zone { border: 2px dashed var(--border-light); border-radius: 12px; padding: 60px; text-align: center; cursor: pointer; }
.drop-zone:hover { border-color: var(--purple); }
.progress { margin-top: 12px; color: var(--purple); }

.editor-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
@media (min-width: 1600px) { .editor-layout { grid-template-columns: 1fr 380px; gap: 24px; } }
@media (min-width: 2200px) { .editor-layout { grid-template-columns: 1fr 420px; gap: 28px; } }

.image-section .image-container { background: var(--bg-video); border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 300px; overflow: hidden; }
.image-section img { max-width: 100%; max-height: calc(100vh - 260px); object-fit: contain; }
@media (min-width: 1600px) { .image-section img { max-height: calc(100vh - 280px); } }
@media (min-width: 2200px) { .image-section img { max-height: calc(100vh - 320px); } }

.toolbar { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.toolbar select { background: var(--bg-input); border: 1px solid var(--border); color: var(--text-primary); padding: 6px 10px; border-radius: 6px; }
.toolbar button.active { background: var(--purple); }

.info-list div { font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--border-subtle); }
.info-list span { color: var(--text-secondary); }

.adjustments label { display: block; font-size: 13px; color: var(--text-secondary); margin-top: 8px; }
.adjustments input[type=range] { width: 100%; margin: 4px 0; }

.crop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
.crop-grid label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.crop-grid input { width: 70px; }

.modal-overlay { position: fixed; inset: 0; background: var(--modal-overlay); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
.modal h2 { margin-bottom: 8px; }
.upload-hint { color: var(--text-muted); font-size: 13px; margin-top: 8px; }
.upload-hint-sm { color: var(--text-muted); font-size: 12px; margin-top: 8px; }
.modal-hint { color: var(--text-secondary); font-size: 13px; margin-bottom: 12px; }
.sub-edit-list { display: flex; flex-direction: column; gap: 6px; margin: 12px 0; }
.sub-edit-row { display: flex; gap: 6px; align-items: center; }
.time-input-sm { width: 65px; font-family: monospace; }
.sub-edit-row label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); }
.modal-actions { display: flex; gap: 8px; margin-top: 12px; }
</style>
