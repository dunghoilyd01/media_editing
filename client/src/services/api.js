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

export const api = {
  // Media
  listMedia() { return request('/media/list') },
  deleteMedia(uuid) { return request(`/media/${uuid}`, { method: 'DELETE' }) },

  // Video
  uploadVideo(file) {
    const fd = new FormData()
    fd.append('file', file)
    return request('/video/upload', { method: 'POST', body: fd })
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

  // Image
  uploadImage(file) {
    const fd = new FormData()
    fd.append('file', file)
    return request('/image/upload', { method: 'POST', body: fd })
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
