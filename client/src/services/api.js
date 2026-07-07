const API_BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.details || 'Request failed')
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

function uploadWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${url}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { resolve(xhr.responseText) }
      } else {
        let msg = 'Upload failed'
        try { const j = JSON.parse(xhr.responseText); msg = j.error || msg } catch {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(fd)
  })
}

export const api = {
  // Media
  listMedia() { return request('/media/list') },
  deleteMedia(uuid) { return request(`/media/${uuid}`, { method: 'DELETE' }) },

  // Video
  uploadVideo(file, onProgress) {
    return uploadWithProgress('/video/upload', file, onProgress)
  },
  getSubtitles(uuid) { return request(`/video/subtitles/${uuid}`) },
  saveSubtitles(uuid, subtitles) {
    return request(`/video/subtitles/${uuid}`, {
      method: 'POST',
      body: JSON.stringify({ subtitles }),
    })
  },
  uploadSubtitleFile(uuid, file) {
    const fd = new FormData()
    fd.append('file', file)
    return request(`/video/subtitles/upload/${uuid}`, { method: 'POST', body: fd })
  },
  exportSubtitlesJson(uuid) {
    return fetch(`${API_BASE}/video/export/subtitles/json/${uuid}`, { method: 'POST' })
  },
  exportVideo(uuid, data) {
    return request(`/video/export/video/${uuid}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  videoStreamUrl(uuid) { return `${API_BASE}/video/stream/${uuid}` },
  getItems(uuid) { return request(`/video/items/${uuid}`) },
  createItem(uuid, data) {
    return request(`/video/items/${uuid}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  deleteItem(id) { return request(`/video/items/${id}`, { method: 'DELETE' }) },
  exportItemsJson(uuid) {
    return fetch(`${API_BASE}/video/export/items/json/${uuid}`, { method: 'POST' })
  },
  getBlurRegions(uuid) { return request(`/video/blur/${uuid}`) },
  saveBlurRegions(uuid, regions) {
    return request(`/video/blur/${uuid}`, {
      method: 'POST',
      body: JSON.stringify({ regions }),
    })
  },

  // Image
  uploadImage(file, onProgress) {
    return uploadWithProgress('/image/upload', file, onProgress)
  },
  processImage(uuid, params) {
    return request(`/image/process/${uuid}`, {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },
  downloadImage(uuid) { return request(`/image/download/${uuid}`) },
  listImages() { return request('/image/list') },
}
