export type Corner = [number, number]
export type FilterId = 'original' | 'enhance' | 'magic' | 'gray' | 'bw' | 'removeInk'

export const FULL_CORNERS: Corner[] = [
  [0.035, 0.035],
  [0.965, 0.035],
  [0.965, 0.965],
  [0.035, 0.965],
]

export const FILTERS: { id: FilterId; label: string; note: string }[] = [
  { id: 'original', label: '原图', note: '保留纹理与光影' },
  { id: 'enhance', label: '增强', note: '提高对比与饱和' },
  { id: 'magic', label: '魔法白', note: '去灰底、提亮纸面' },
  { id: 'gray', label: '灰度', note: '温和去色' },
  { id: 'bw', label: '黑白', note: '自适应二值化' },
  { id: 'removeInk', label: '去手写', note: '清除彩色笔迹' },
]

interface Matrix3 {
  h: number[]
}

function solve8(A: number[][]): number[] | null {
  const n = 8
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    if (Math.abs(A[pivot][col]) < 1e-9) return null
    ;[A[col], A[pivot]] = [A[pivot], A[col]]
    const pv = A[col][col]
    for (let c = col; c <= n; c++) A[col][c] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r][col]
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c]
    }
  }
  return A.map((row) => row[n])
}

/** Returns a homography mapping source quad -> destination quad. */
export function perspectiveTransform(src: Corner[], dst: Corner[]): Matrix3 {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  const solved = solve8(A)
  return { h: solved ? [...solved, 1] : [1, 0, 0, 0, 1, 0, 0, 0, 1] }
}

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export async function makeScan(original: string, corners: Corner[], filter: FilterId, inkStrength = 70, maxSide = 1700): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImageEl(original)
  const srcQuad: Corner[] = corners.map(([x, y]) => [x * img.naturalWidth, y * img.naturalHeight] as Corner)
  const topW = dist(srcQuad[0], srcQuad[1])
  const bottomW = dist(srcQuad[3], srcQuad[2])
  const leftH = dist(srcQuad[0], srcQuad[3])
  const rightH = dist(srcQuad[1], srcQuad[2])
  let w = Math.max(80, Math.round(Math.max(topW, bottomW)))
  let h = Math.max(80, Math.round(Math.max(leftH, rightH)))
  const scale = Math.min(1, maxSide / Math.max(w, h))
  w = Math.max(80, Math.round(w * scale))
  h = Math.max(80, Math.round(h * scale))

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = img.naturalWidth
  sourceCanvas.height = img.naturalHeight
  const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(img, 0, 0)
  const src = sctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const outCanvas = document.createElement('canvas')
  outCanvas.width = w
  outCanvas.height = h
  const octx = outCanvas.getContext('2d', { willReadFrequently: true })!
  const out = octx.createImageData(w, h)
  const H = perspectiveTransform(
    [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ],
    srcQuad,
  )
  const M = H.h
  const sd = src.data
  const od = out.data
  const sw = sourceCanvas.width
  const sh = sourceCanvas.height
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const den = M[6] * x + M[7] * y + M[8]
      const sx = (M[0] * x + M[1] * y + M[2]) / den
      const sy = (M[3] * x + M[4] * y + M[5]) / den
      const ix = Math.max(0, Math.min(sw - 1, Math.round(sx)))
      const iy = Math.max(0, Math.min(sh - 1, Math.round(sy)))
      const si = (iy * sw + ix) * 4
      const oi = (y * w + x) * 4
      od[oi] = sd[si]
      od[oi + 1] = sd[si + 1]
      od[oi + 2] = sd[si + 2]
      od[oi + 3] = 255
    }
  }
  applyFilter(od, w, h, filter, inkStrength)
  octx.putImageData(out, 0, 0)
  return { dataUrl: outCanvas.toDataURL('image/jpeg', 0.92), width: w, height: h }
}

function dist(a: Corner, b: Corner) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function applyFilter(d: Uint8ClampedArray, w: number, h: number, filter: FilterId, strength: number) {
  if (filter === 'original') return
  if (filter === 'gray') {
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = g
    }
    return
  }
  if (filter === 'bw') {
    const gray = new Float32Array(w * h)
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const integral = new Float64Array((w + 1) * (h + 1))
    for (let y = 1; y <= h; y++) {
      let row = 0
      for (let x = 1; x <= w; x++) {
        row += gray[(y - 1) * w + (x - 1)]
        integral[y * (w + 1) + x] = integral[(y - 1) * (w + 1) + x] + row
      }
    }
    const win = Math.max(12, Math.floor(Math.min(w, h) / 26))
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - win)
        const y1 = Math.max(0, y - win)
        const x2 = Math.min(w - 1, x + win)
        const y2 = Math.min(h - 1, y + win)
        const area = (x2 - x1 + 1) * (y2 - y1 + 1)
        const sum = integral[(y2 + 1) * (w + 1) + x2 + 1] - integral[y1 * (w + 1) + x2 + 1] - integral[(y2 + 1) * (w + 1) + x1] + integral[y1 * (w + 1) + x1]
        const mean = sum / area
        const v = gray[y * w + x] < mean * 0.88 - 4 ? 0 : 255
        const i = (y * w + x) * 4
        d[i] = d[i + 1] = d[i + 2] = v
      }
    }
    return
  }
  if (filter === 'magic') {
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++
    const target = w * h * 0.9
    let acc = 0
    let p90 = 220
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc >= target) { p90 = v; break }
    }
    const gain = Math.min(1.45, 246 / Math.max(90, p90))
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp8((d[i] * gain - 128) * 1.06 + 132)
      d[i + 1] = clamp8((d[i + 1] * gain - 128) * 1.06 + 132)
      d[i + 2] = clamp8((d[i + 2] * gain - 128) * 1.06 + 132)
    }
    return
  }
  if (filter === 'enhance') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const avg = (r + g + b) / 3
      d[i] = clamp8((r - avg) * 1.12 + avg * 1.02 + 7)
      d[i + 1] = clamp8((g - avg) * 1.12 + avg * 1.02 + 7)
      d[i + 2] = clamp8((b - avg) * 1.12 + avg * 1.02 + 7)
    }
    return
  }
  if (filter === 'removeInk') {
    const satCut = 0.42 - (strength / 100) * 0.23
    const mask = new Uint8Array(w * h)
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2]
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const sat = mx === 0 ? 0 : (mx - mn) / mx
      const chroma = mx - mn
      const warmEdge = r - (g + b) / 2 > 9
      const coolEdge = b - (r + g) / 2 > 9
      if ((sat > satCut && mx > 42) || (chroma > 13 && mx > 55 && (warmEdge || coolEdge))) {
        // colored ink / highlighter (including anti-aliased fringe) -> paper white
        d[i] = d[i + 1] = d[i + 2] = 255
        mask[i >> 2] = 1
        continue
      }
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      // whiten paper, deepen print
      let v = (lum - 118) * 1.16 + 150
      if (lum > 188) v = 255
      if (lum < 92) v = Math.max(0, lum * 0.78)
      v = clamp8(v)
      d[i] = d[i + 1] = d[i + 2] = v
    }
    // Dilate the ink mask to erase anti-aliased halos left around pen strokes.
    const radius = 3
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue
        const x0 = Math.max(0, x - radius)
        const x1 = Math.min(w - 1, x + radius)
        const y0 = Math.max(0, y - radius)
        const y1 = Math.min(h - 1, y + radius)
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            const i = (yy * w + xx) * 4
            d[i] = d[i + 1] = d[i + 2] = 255
          }
        }
      }
    }
  }
}

function clamp8(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

export async function autoCrop(dataUrl: string): Promise<Corner[]> {
  const img = await loadImageEl(dataUrl)
  const scale = 220 / Math.max(img.naturalWidth, img.naturalHeight)
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = 0, maxY = 0, count = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      if (lum < 168) {
        count++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (count < w * h * 0.012 || maxX <= minX || maxY <= minY) return FULL_CORNERS
  const pad = 0.025
  const n = (v: number, total: number) => Math.max(0.005, Math.min(0.995, v / total))
  return [
    [Math.max(0.005, n(minX, w) - pad), Math.max(0.005, n(minY, h) - pad)],
    [Math.min(0.995, n(maxX, w) + pad), Math.max(0.005, n(minY, h) - pad)],
    [Math.min(0.995, n(maxX, w) + pad), Math.min(0.995, n(maxY, h) + pad)],
    [Math.max(0.005, n(minX, w) - pad), Math.min(0.995, n(maxY, h) + pad)],
  ]
}

export async function rotateDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImageEl(dataUrl)
  const c = document.createElement('canvas')
  c.width = img.naturalHeight
  c.height = img.naturalWidth
  const ctx = c.getContext('2d')!
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  return c.toDataURL('image/jpeg', 0.94)
}

export async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadImageEl(dataUrl)
  return { width: img.naturalWidth, height: img.naturalHeight }
}
