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
          <div class="image-viewport" ref="viewport"
            @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" @mouseleave="onMouseUp"
            :class="{ 'blur-mode': blurMode && !isDrawing }">
            <img :src="imagePreview" ref="img" :style="imgStyle" @load="onImgLoad" />
            <div v-for="(r, i) in blurRegions" :key="i" class="blur-preview" :style="blurStyle(r)"></div>
            <div v-if="isDrawing" class="draw-rect" :style="drawRectStyle"></div>
            <div v-if="showCrop && imgNaturalWidth" class="crop-overlay" :style="cropOverlayStyle"></div>
            <div v-if="showCrop && imgNaturalWidth" class="crop-window" :style="cropWindowStyle"></div>
          </div>
        </div>
        <div class="toolbar">
          <button @click="rotateLeft">Rotate -90</button>
          <button @click="rotateRight">Rotate +90</button>
          <button @click="flipHoriz">Flip H</button>
          <button @click="flipVert">Flip V</button>
          <button @click="showCrop = !showCrop" :class="{ active: showCrop }">Crop</button>
          <button @click="blurMode = !blurMode" :class="{ active: blurMode }" :disabled="!imgNaturalWidth">
            {{ blurMode ? 'Cancel Blur' : 'Blur Select' }}
          </button>
          <button @click="showBlurModal = true" :disabled="!imgNaturalWidth">Blur List</button>
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
          <h3 style="display:flex;align-items:center;gap:8px;">
            Crop
            <button class="unit-btn" @click="cropUnit = cropUnit === 'px' ? '%' : 'px'">{{ cropUnit }}</button>
          </h3>
          <div class="crop-grid">
            <label>X: <input type="number" :value="cropDisplay.x" @input="setCrop('x', $event.target.value)" min="0" :max="cropUnit === '%' ? 100 : imgNaturalWidth" :step="cropUnit === '%' ? 0.1 : 1" /></label>
            <label>Y: <input type="number" :value="cropDisplay.y" @input="setCrop('y', $event.target.value)" min="0" :max="cropUnit === '%' ? 100 : imgNaturalHeight" :step="cropUnit === '%' ? 0.1 : 1" /></label>
            <label>W: <input type="number" :value="cropDisplay.width" @input="setCrop('width', $event.target.value)" min="1" :max="cropUnit === '%' ? 100 : imgNaturalWidth" :step="cropUnit === '%' ? 0.1 : 1" /></label>
            <label>H: <input type="number" :value="cropDisplay.height" @input="setCrop('height', $event.target.value)" min="1" :max="cropUnit === '%' ? 100 : imgNaturalHeight" :step="cropUnit === '%' ? 0.1 : 1" /></label>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showBlurModal" class="modal-overlay" @click.self="showBlurModal = false">
      <div class="modal">
        <h2>Blur Regions ({{ blurRegions.length }})</h2>
        <p class="modal-hint">Drag on the image in Blur Select mode, or edit values below.</p>
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
      imgNaturalWidth: 0,
      imgNaturalHeight: 0,
      rotation: 0,
      flipMode: '',
      crop: { x: 0, y: 0, width: 100, height: 100 },
      cropUnit: 'px',
      showCrop: false,
      blurMode: false,
      isDrawing: false,
      drawStart: null,
      drawCurrent: null,
      showBlurModal: false,
      blurRegions: [],
      exportFormat: '',
    }
  },
  computed: {
    imgTransform() {
      const t = []
      if (this.rotation) t.push(`rotate(${this.rotation}deg)`)
      if (this.flipMode === 'horizontal') t.push('scaleX(-1)')
      if (this.flipMode === 'vertical') t.push('scaleY(-1)')
      return t.join(' ')
    },
    imgStyle() {
      return {
        transform: this.imgTransform,
        transition: 'transform 0.2s ease',
      }
    },
    cropDisplay() {
      if (this.cropUnit === '%' && this.imgNaturalWidth) {
        return {
          x: +((this.crop.x / this.imgNaturalWidth) * 100).toFixed(1),
          y: +((this.crop.y / this.imgNaturalHeight) * 100).toFixed(1),
          width: +((this.crop.width / this.imgNaturalWidth) * 100).toFixed(1),
          height: +((this.crop.height / this.imgNaturalHeight) * 100).toFixed(1),
        }
      }
      return { ...this.crop }
    },
  },
  async mounted() {
    const uuid = this.$route.params.uuid
    if (uuid) {
      this.imageUuid = uuid
      await this.loadImage()
    }
    window.addEventListener('resize', this.onResize)
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize)
  },
  methods: {
    onImgLoad(e) {
      this.imgLoaded = true
      this.imgNaturalWidth = e.target.naturalWidth
      this.imgNaturalHeight = e.target.naturalHeight
    },
    onResize() {
      this.$forceUpdate()
    },
    imgScale() {
      const viewport = this.$refs.viewport
      const img = this.$refs.img
      if (!viewport || !img || !this.imgNaturalWidth) return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, displayW: 0, displayH: 0 }
      const vr = viewport.getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      const scaleX = ir.width / this.imgNaturalWidth
      const scaleY = ir.height / this.imgNaturalHeight
      return {
        scaleX: isFinite(scaleX) ? scaleX : 1,
        scaleY: isFinite(scaleY) ? scaleY : 1,
        offsetX: ir.left - vr.left,
        offsetY: ir.top - vr.top,
        displayW: ir.width,
        displayH: ir.height,
      }
    },
    blurStyle(r) {
      const s = this.imgScale()
      if (!s.displayW) return {}
      return {
        left: `${r.x * s.scaleX + s.offsetX}px`,
        top: `${r.y * s.scaleY + s.offsetY}px`,
        width: `${r.width * s.scaleX}px`,
        height: `${r.height * s.scaleY}px`,
      }
    },
    cropWindowStyle() {
      const s = this.imgScale()
      if (!s.displayW) return {}
      return {
        left: `${this.crop.x * s.scaleX + s.offsetX}px`,
        top: `${this.crop.y * s.scaleY + s.offsetY}px`,
        width: `${this.crop.width * s.scaleX}px`,
        height: `${this.crop.height * s.scaleY}px`,
        border: '2px dashed var(--accent)',
      }
    },
    cropOverlayStyle() {
      const s = this.imgScale()
      if (!s.displayW) return {}
      const x = this.crop.x * s.scaleX + s.offsetX
      const y = this.crop.y * s.scaleY + s.offsetY
      const w = this.crop.width * s.scaleX
      const h = this.crop.height * s.scaleY
      return {
        clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${y}px, ${x}px ${y}px, ${x}px ${y + h}px, ${x + w}px ${y + h}px, ${x + w}px ${y}px, 0% ${y}px)`,
      }
    },
    setCrop(field, value) {
      const v = parseFloat(value) || 0
      if (this.cropUnit === '%' && this.imgNaturalWidth) {
        const w = this.imgNaturalWidth
        const h = this.imgNaturalHeight
        if (field === 'x' || field === 'width') this.crop[field] = (v / 100) * w
        else this.crop[field] = (v / 100) * h
      } else {
        this.crop[field] = v
      }
    },
    drawRectStyle() {
      if (!this.drawStart || !this.drawCurrent) return { display: 'none' }
      const x1 = Math.min(this.drawStart.x, this.drawCurrent.x)
      const y1 = Math.min(this.drawStart.y, this.drawCurrent.y)
      const x2 = Math.max(this.drawStart.x, this.drawCurrent.x)
      const y2 = Math.max(this.drawStart.y, this.drawCurrent.y)
      const s = this.imgScale()
      return {
        left: `${x1 * s.scaleX + s.offsetX}px`,
        top: `${y1 * s.scaleY + s.offsetY}px`,
        width: `${(x2 - x1) * s.scaleX}px`,
        height: `${(y2 - y1) * s.scaleY}px`,
      }
    },
    onMouseDown(e) {
      if (e.button !== 0 || !this.blurMode) return
      const viewport = this.$refs.viewport
      if (!viewport || !this.imgNaturalWidth) return
      const rect = viewport.getBoundingClientRect()
      const s = this.imgScale()
      this.drawStart = {
        x: (e.clientX - rect.left - s.offsetX) / s.scaleX,
        y: (e.clientY - rect.top - s.offsetY) / s.scaleY,
      }
      this.drawCurrent = { ...this.drawStart }
      this.isDrawing = true
    },
    onMouseMove(e) {
      if (!this.isDrawing) return
      const viewport = this.$refs.viewport
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const s = this.imgScale()
      this.drawCurrent = {
        x: (e.clientX - rect.left - s.offsetX) / s.scaleX,
        y: (e.clientY - rect.top - s.offsetY) / s.scaleY,
      }
    },
    onMouseUp() {
      if (!this.isDrawing || !this.drawStart || !this.drawCurrent) {
        this.isDrawing = false
        return
      }
      this.isDrawing = false
      const x = Math.min(this.drawStart.x, this.drawCurrent.x)
      const y = Math.min(this.drawStart.y, this.drawCurrent.y)
      const w = Math.abs(this.drawCurrent.x - this.drawStart.x)
      const h = Math.abs(this.drawCurrent.y - this.drawStart.y)
      if (w >= 3 && h >= 3) {
        this.blurRegions.push({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(w),
          height: Math.round(h),
        })
      }
      this.drawStart = null
      this.drawCurrent = null
    },
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

.image-container { background: var(--bg-video); border-radius: 8px; min-height: 300px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }
.image-viewport { position: relative; max-width: 100%; max-height: 100%; display: flex; align-items: center; justify-content: center; cursor: default; }
.image-viewport.blur-mode { cursor: crosshair; }
.image-viewport img { display: block; max-width: 100%; max-height: calc(100vh - 300px); width: auto; height: auto; pointer-events: none; }
@media (min-width: 1600px) { .image-viewport img { max-height: calc(100vh - 320px); } }
@media (min-width: 2200px) { .image-viewport img { max-height: calc(100vh - 360px); } }

.blur-preview { position: absolute; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(139,92,246,.3); pointer-events: none; z-index: 2; }
.draw-rect { position: absolute; border: 2px dashed #fff; background: rgba(255,255,255,.1); pointer-events: none; z-index: 5; }
.crop-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.45); pointer-events: none; z-index: 3; }
.crop-window { position: absolute; pointer-events: none; z-index: 4; border-radius: 2px; }

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
.unit-btn { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-primary); padding: 2px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; line-height: 1.4; }
.unit-btn:hover { border-color: var(--accent); }

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
