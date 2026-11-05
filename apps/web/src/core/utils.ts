export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
}

export function relativeTime(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (Number.isNaN(diff)) return ''
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day === 1) return '昨天'
  if (day < 7) return `${day} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function shortTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

export function nowIso() {
  return new Date().toISOString()
}

export function minutesAgo(n: number) {
  return new Date(Date.now() - n * 60000).toISOString()
}

export function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString()
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '午安'
  if (h < 18) return '下午好'
  return '晚上好'
}

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase()
}

export function hueStyle(hue: number, light = 62, sat = 72) {
  return {
    background: `linear-gradient(145deg, hsl(${hue} ${sat}% ${light}%), hsl(${(hue + 42) % 360} ${sat - 8}% ${light - 18}%))`,
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function makeThumbnail(source: Blob | string, max = 640, quality = 0.78): Promise<string> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0b101b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

export function randomCode(length = 6) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function fileKindLabel(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return '图片'
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return '视频'
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return '音频'
  if (['md', 'txt'].includes(ext)) return '文本'
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py'].includes(ext)) return '代码'
  if (ext === 'pdf') return 'PDF'
  return ext ? ext.toUpperCase() : '文件'
}

export function isImageMime(mime: string) {
  return mime.startsWith('image/')
}
export function isVideoMime(mime: string) {
  return mime.startsWith('video/')
}
export function isAudioMime(mime: string) {
  return mime.startsWith('audio/')
}

export function encodeSvg(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Deterministic abstract "photo" used for demo content — no external assets. */
export function makeArt(seed: number, label = '', w = 900, h = 640) {
  let s = seed * 9301 + 49297
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const h1 = Math.floor(rnd() * 360)
  const h2 = (h1 + 48 + Math.floor(rnd() * 120)) % 360
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = Math.floor(rnd() * w)
    const cy = Math.floor(rnd() * h)
    const r = Math.floor(80 + rnd() * 280)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${(h1 + i * 36) % 360} 80% 65% / ${0.10 + rnd() * 0.22})" />`
  }).join('')
  const lines = Array.from({ length: 5 }, (_, i) => {
    const y = 60 + i * (h / 6)
    return `<path d="M ${w * 0.1} ${y} C ${w * 0.3} ${y - 40 + rnd() * 80}, ${w * 0.6} ${y + 40 - rnd() * 80}, ${w * 0.92} ${y}" stroke="hsl(${h2} 90% 85% / .045)" stroke-width=".7"/>`
  }).join('')
  const labelSvg = label
    ? `<text x="${w * 0.08}" y="${h * 0.88}" fill="rgba(244,249,255,.82)" font-family="Manrope, system-ui, sans-serif" font-size="${Math.round(w / 22)}" font-weight="700" letter-spacing="4">${label}</text>`
    : ''
  return encodeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${h1} 58% 18%)"/><stop offset="1" stop-color="hsl(${h2} 64% 8%)"/></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <g filter="url(#blur)">${blobs}</g>
    <circle cx="${w * 0.78}" cy="${h * 0.24}" r="${w * 0.06}" fill="hsl(${h2} 90% 76% / .8)"/>
    ${labelSvg}
  </svg>`)
}

export function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || '未命名'
}

export async function fileToBlob(file: File): Promise<Blob> {
  return file
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
