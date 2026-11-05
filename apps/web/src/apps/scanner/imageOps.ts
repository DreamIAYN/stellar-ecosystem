export type Corner = [number, number]
export type FilterId = 'original' | 'enhance' | 'magic' | 'gray' | 'bw' | 'removeInk'
export type InkMode = 'redblue' | 'all'
export interface InkOptions { mode: InkMode; preserve: boolean }
export interface NormRect { x: number; y: number; w: number; h: number }

export const FULL_CORNERS: Corner[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
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

export async function makeScan(
  original: string,
  corners: Corner[],
  filter: FilterId,
  inkStrength = 70,
  inkOptions: InkOptions = { mode: 'redblue', preserve: true },
  maxSide = 1700,
  sharpen = 0,
  upscale = 1,
  whiteBg = false,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImageEl(original)
  const srcQuad: Corner[] = corners.map(([x, y]) => [x * img.naturalWidth, y * img.naturalHeight] as Corner)
  const topW = dist(srcQuad[0], srcQuad[1])
  const bottomW = dist(srcQuad[3], srcQuad[2])
  const leftH = dist(srcQuad[0], srcQuad[3])
  const rightH = dist(srcQuad[1], srcQuad[2])
  const baseW = Math.max(80, Math.round(Math.max(topW, bottomW)))
  const baseH = Math.max(80, Math.round(Math.max(leftH, rightH)))
  // Keep the homography pass bounded, then upscale in a separate high-quality
  // draw. This is what makes local "smart HD" practical in the browser.
  const cap = Math.max(320, Math.round(maxSide / Math.max(1, upscale)))
  const warpScale = Math.min(1, cap / Math.max(baseW, baseH))
  const w = Math.max(80, Math.round(baseW * warpScale))
  const h = Math.max(80, Math.round(baseH * warpScale))

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = img.naturalWidth
  sourceCanvas.height = img.naturalHeight
  const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(img, 0, 0)
  const src = sctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)

  const warpCanvas = document.createElement('canvas')
  warpCanvas.width = w
  warpCanvas.height = h
  const wctx = warpCanvas.getContext('2d', { willReadFrequently: true })!
  const out = wctx.createImageData(w, h)
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
  wctx.putImageData(out, 0, 0)

  let finalCanvas = warpCanvas
  if (upscale > 1) {
    finalCanvas = document.createElement('canvas')
    finalCanvas.width = Math.round(w * upscale)
    finalCanvas.height = Math.round(h * upscale)
    const fctx = finalCanvas.getContext('2d', { willReadFrequently: true })!
    fctx.imageSmoothingEnabled = true
    fctx.imageSmoothingQuality = 'high'
    fctx.drawImage(warpCanvas, 0, 0, finalCanvas.width, finalCanvas.height)
  }
  const fctx = finalCanvas.getContext('2d', { willReadFrequently: true })!
  const finalData = fctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height)
  applyFilter(finalData.data, finalCanvas.width, finalCanvas.height, filter, inkStrength, inkOptions)
  if (whiteBg) applyWhiteBackground(finalData.data, finalCanvas.width, finalCanvas.height)
  if (sharpen > 0) applySharpen(finalData.data, finalCanvas.width, finalCanvas.height, sharpen)
  fctx.putImageData(finalData, 0, 0)
  return { dataUrl: finalCanvas.toDataURL('image/jpeg', 0.94), width: finalCanvas.width, height: finalCanvas.height }
}

function applyWhiteBackground(d: Uint8ClampedArray, w: number, h: number) {
  const block = Math.max(28, Math.round(Math.min(w, h) / 22))
  const cols = Math.ceil(w / block)
  const rows = Math.ceil(h / block)
  const bgR = new Float32Array(cols * rows)
  const bgG = new Float32Array(cols * rows)
  const bgB = new Float32Array(cols * rows)
  let gr = 0, gg = 0, gb = 0, gn = 0
  for (let y = 0; y < h; y += 5) {
    for (let x = 0; x < w; x += 5) {
      const i = (y * w + x) * 4
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const chroma = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])
      if (lum > 150 && chroma < 45) { gr += d[i]; gg += d[i + 1]; gb += d[i + 2]; gn++ }
    }
  }
  const globalR = gn ? gr / gn : 235
  const globalG = gn ? gg / gn : 232
  const globalB = gn ? gb / gn : 225

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const x0 = bx * block
      const y0 = by * block
      const x1 = Math.min(w, x0 + block)
      const y1 = Math.min(h, y0 + block)
      const hist = new Uint32Array(256)
      let count = 0
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * w + x) * 4
          hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++
          count++
        }
      }
      let acc = 0
      let threshold = 160
      const target = count * 0.78
      for (let v = 0; v < 256; v++) {
        acc += hist[v]
        if (acc >= target) { threshold = v; break }
      }
      let sr = 0, sg = 0, sb = 0, sn = 0
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * w + x) * 4
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          if (lum >= threshold) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; sn++ }
        }
      }
      const idx = by * cols + bx
      if (sn > 10 && threshold > 130) {
        bgR[idx] = sr / sn
        bgG[idx] = sg / sn
        bgB[idx] = sb / sn
      } else {
        bgR[idx] = globalR
        bgG[idx] = globalG
        bgB[idx] = globalB
      }
    }
  }

  const sample = (arr: Float32Array, gx: number, gy: number) => {
    const x = Math.max(0, Math.min(cols - 1, gx))
    const y = Math.max(0, Math.min(rows - 1, gy))
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const x1 = Math.min(cols - 1, x0 + 1)
    const y1 = Math.min(rows - 1, y0 + 1)
    const fx = x - x0
    const fy = y - y0
    const a = arr[y0 * cols + x0] * (1 - fx) + arr[y0 * cols + x1] * fx
    const b = arr[y1 * cols + x0] * (1 - fx) + arr[y1 * cols + x1] * fx
    return a * (1 - fy) + b * fy
  }

  for (let y = 0; y < h; y++) {
    const gy = y / block - 0.5
    for (let x = 0; x < w; x++) {
      const gx = x / block - 0.5
      const br = Math.max(18, sample(bgR, gx, gy))
      const bg = Math.max(18, sample(bgG, gx, gy))
      const bb = Math.max(18, sample(bgB, gx, gy))
      const i = (y * w + x) * 4
      let r = d[i] * (246 / br)
      let g = d[i + 1] * (246 / bg)
      let b = d[i + 2] * (246 / bb)
      r = r < 0 ? 0 : r > 255 ? 255 : r
      g = g < 0 ? 0 : g > 255 ? 255 : g
      b = b < 0 ? 0 : b > 255 ? 255 : b
      const mn = Math.min(r, g, b)
      const mx = Math.max(r, g, b)
      if (mn > 232 || (mn > 208 && mx - mn < 26)) { r = 255; g = 255; b = 255 }
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
    }
  }
}

function applySharpen(d: Uint8ClampedArray, w: number, h: number, amount: number) {
  const a = Math.min(0.8, (amount / 100) * 0.55)
  if (a <= 0.01) return
  const src = new Uint8ClampedArray(d)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1) * w
    const y1 = y * w
    const y2 = Math.min(h - 1, y + 1) * w
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1)
      const x2 = Math.min(w - 1, x + 1)
      const i = (y1 + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = src[i + c]
        const left = src[(y1 + x0) * 4 + c]
        const right = src[(y1 + x2) * 4 + c]
        const up = src[(y0 + x) * 4 + c]
        const down = src[(y2 + x) * 4 + c]
        d[i + c] = clamp8(center + a * (4 * center - left - right - up - down))
      }
    }
  }
}

function dist(a: Corner, b: Corner) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function applyFilter(d: Uint8ClampedArray, w: number, h: number, filter: FilterId, strength: number, inkOptions: InkOptions) {
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
    const satCut = 0.32 - (strength / 100) * 0.14
    const mask = new Uint8Array(w * h)
    // Estimate the local paper tone so removed ink blends into warm/beige
    // photographed paper instead of leaving obvious pure-white patches.
    let pr = 0, pg = 0, pb = 0, pn = 0
    for (let p = 0; p < w * h; p += 4) {
      const i = p * 4
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      if (lum > 165 && chroma < 16) { pr += r; pg += g; pb += b; pn++ }
    }
    const paperR = pn ? Math.round(pr / pn) : 255
    const paperG = pn ? Math.round(pg / pn) : 255
    const paperB = pn ? Math.round(pb / pn) : 255
    // Protect printed glyphs: coloured anti-aliasing around dark print must not
    // be mistaken for pen ink. We dilate a dark-core mask and never erase it.
    const dark = new Uint8Array(w * h)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const warmCast = d[i] - Math.max(d[i + 1], d[i + 2]) < 30
      const coolCast = d[i + 2] - Math.max(d[i], d[i + 1]) < 20
      if (lum < 68 && Math.max(d[i], d[i + 1], d[i + 2]) < 125 && warmCast && coolCast) dark[p] = 1
    }
    const protect = new Uint8Array(w * h)
    const protectRadius = 2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!dark[y * w + x]) continue
        const x0 = Math.max(0, x - protectRadius)
        const x1 = Math.min(w - 1, x + protectRadius)
        const y0 = Math.max(0, y - protectRadius)
        const y1 = Math.min(h - 1, y + protectRadius)
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) protect[yy * w + xx] = 1
      }
    }
    const isInkHue = (r: number, g: number, b: number) => {
      // Deliberately strict: warm ambient light makes dark print look slightly
      // red. Requiring a strong channel gap and high value protects the print.
      const red = r - Math.max(g, b) > 22
      const blue = b - Math.max(r, g) > 18
      const magenta = r - g > 20 && b - g > 15
      return red || blue || magenta
    }
    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const sat = mx === 0 ? 0 : (mx - mn) / mx
      const chroma = mx - mn
      const colored = inkOptions.mode === 'redblue' ? isInkHue(r, g, b) : true
      // High value + saturation = pen ink. Low-value warm pixels are printed
      // text under an ambient cast and must stay.
      const strongInk = colored && mx > 86 && sat > (inkOptions.mode === 'all' ? Math.max(0.26, satCut) : satCut)
      const fringe = colored && mx > 106 && chroma > 18 && sat > (inkOptions.mode === 'all' ? 0.24 : 0.15)
      if (fringe) {
        // Anti-aliased pen edge: whiten it, but do not grow the mask from it.
        if (!protect[p]) { d[i] = paperR; d[i + 1] = paperG; d[i + 2] = paperB }
        continue
      }
      if (strongInk) {
        // Pen core: whiten and remember it for a tiny halo dilation.
        if (!protect[p]) {
          d[i] = paperR; d[i + 1] = paperG; d[i + 2] = paperB
          mask[p] = 1
        }
        continue
      }
      if (!inkOptions.preserve) {
        // Optional gentle paper clean-up. Keeps the original hues and printed
        // content intact; only lifts pale paper and deepens dark print.
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        const gain = lum > 170 ? 1 + ((lum - 170) / 85) * 0.18 : lum < 95 ? 0.95 : 1
        d[i] = clamp8(r * gain + 3)
        d[i + 1] = clamp8(g * gain + 3)
        d[i + 2] = clamp8(b * gain + 3)
      }
    }
    // Dilate only around detected ink pixels so printed content away from the
    // pen strokes is never touched.
    const radius = 2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue
        const x0 = Math.max(0, x - radius)
        const x1 = Math.min(w - 1, x + radius)
        const y0 = Math.max(0, y - radius)
        const y1 = Math.min(h - 1, y + radius)
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            if (protect[yy * w + xx]) continue
            const i = (yy * w + xx) * 4
            d[i] = paperR; d[i + 1] = paperG; d[i + 2] = paperB
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
  const maxSide = 360
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data

  const lumAt = (i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  const median = (values: number[]) => {
    if (!values.length) return 0
    values.sort((a, b) => a - b)
    return values[values.length >> 1]
  }

  // Sample the outer band and the centre. A document photo almost always has a
  // visible page/desk contrast or colour difference; flat scans fall back to
  // the full frame, which avoids the old fixed 3.5% border.
  const band = Math.max(3, Math.round(Math.min(w, h) * 0.055))
  const borderLums: number[] = []
  const borderR: number[] = []
  const borderG: number[] = []
  const borderB: number[] = []
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x >= band && x < w - band && y >= band && y < h - band) continue
      const i = (y * w + x) * 4
      borderLums.push(lumAt(i))
      borderR.push(d[i]); borderG.push(d[i + 1]); borderB.push(d[i + 2])
    }
  }
  const bx0 = Math.round(w * 0.32), bx1 = Math.round(w * 0.68)
  const by0 = Math.round(h * 0.32), by1 = Math.round(h * 0.68)
  const centreLums: number[] = []
  const centreR: number[] = []
  const centreG: number[] = []
  const centreB: number[] = []
  for (let y = by0; y < by1; y += 2) {
    for (let x = bx0; x < bx1; x += 2) {
      const i = (y * w + x) * 4
      centreLums.push(lumAt(i))
      centreR.push(d[i]); centreG.push(d[i + 1]); centreB.push(d[i + 2])
    }
  }
  if (!borderLums.length || !centreLums.length) return FULL_CORNERS
  const bl = median(borderLums)
  const cl = median(centreLums)
  const br = median(borderR), bg = median(borderG), bb = median(borderB)
  const cr = median(centreR), cg = median(centreG), cb = median(centreB)
  const delta = cl - bl
  const colourDist = Math.hypot(cr - br, cg - bg, cb - bb)
  const mode: 'bright' | 'dark' | 'colour' | null =
    delta > 16 ? 'bright' : delta < -16 ? 'dark' : colourDist > 30 ? 'colour' : null
  if (!mode) return FULL_CORNERS

  const mask = new Uint8Array(w * h)
  const threshold = (bl + cl) / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = lumAt(i)
      let inside = false
      if (mode === 'bright') inside = lum > threshold
      else if (mode === 'dark') inside = lum < threshold
      else {
        const dp = Math.hypot(d[i] - cr, d[i + 1] - cg, d[i + 2] - cb)
        const db = Math.hypot(d[i] - br, d[i + 1] - bg, d[i + 2] - bb)
        inside = dp < db && dp < 90
      }
      mask[y * w + x] = inside ? 1 : 0
    }
  }

  // Largest 4-connected component = the page, ignoring shadows / speckles.
  const seen = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let best: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x
      if (!mask[start] || seen[start]) continue
      let head = 0, tail = 0
      queue[tail++] = start
      seen[start] = 1
      const comp: number[] = []
      while (head < tail) {
        const p = queue[head++]
        comp.push(p)
        const px = p % w
        const py = (p / w) | 0
        if (px > 0) { const n = p - 1; if (mask[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n } }
        if (px < w - 1) { const n = p + 1; if (mask[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n } }
        if (py > 0) { const n = p - w; if (mask[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n } }
        if (py < h - 1) { const n = p + w; if (mask[n] && !seen[n]) { seen[n] = 1; queue[tail++] = n } }
      }
      if (comp.length > best.length) best = comp
    }
  }
  if (best.length < w * h * 0.06) return FULL_CORNERS
  if (best.length > w * h * 0.985) return FULL_CORNERS

  let qTL = best[0], qTR = best[0], qBR = best[0], qBL = best[0]
  let minS = Infinity, maxD = -Infinity, maxS = -Infinity, minD = Infinity
  let minX = w, maxX = 0, minY = h, maxY = 0
  for (const p of best) {
    const x = p % w
    const y = (p / w) | 0
    const s = x + y
    const dd = x - y
    if (s < minS) { minS = s; qTL = p }
    if (dd > maxD) { maxD = dd; qTR = p }
    if (s > maxS) { maxS = s; qBR = p }
    if (dd < minD) { minD = dd; qBL = p }
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  // If the page is clipped by three or four frame edges, using the full frame
  // is safer than a strange partial quadrilateral.
  const touches = (minX <= 1 ? 1 : 0) + (maxX >= w - 2 ? 1 : 0) + (minY <= 1 ? 1 : 0) + (maxY >= h - 2 ? 1 : 0)
  if (touches >= 3) return FULL_CORNERS

  const pointOf = (p: number): Corner => [(p % w) / w, ((p / w) | 0) / h]
  const quad = [pointOf(qTL), pointOf(qTR), pointOf(qBR), pointOf(qBL)]
  const area = Math.abs(
    quad.reduce((sum, [x, y], i) => {
      const [nx, ny] = quad[(i + 1) % 4]
      return sum + x * ny - nx * y
    }, 0) / 2,
  )
  if (area < 0.06 || area > 0.98) return FULL_CORNERS
  // Slightly expand outward so the scanner look does not trim the paper edge.
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4
  const expanded = quad.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    return [Math.max(0, Math.min(1, x + (dx / len) * 0.008)), Math.max(0, Math.min(1, y + (dy / len) * 0.008))] as Corner
  })
  return expanded
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

export async function removeBlackInk(dataUrl: string, boxes: NormRect[], threshold = 155): Promise<string> {
  if (!boxes.length) return dataUrl
  const img = await loadImageEl(dataUrl)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, c.width, c.height)
  const d = image.data
  const w = c.width
  const h = c.height
  // Estimate a paper fill from bright, low-chroma pixels.
  let pr = 0, pg = 0, pb = 0, pn = 0
  for (let p = 0; p < w * h; p += 5) {
    const i = p * 4
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum > 165 && mx - mn < 16) { pr += r; pg += g; pb += b; pn++ }
  }
  const fillR = pn ? Math.round(pr / pn) : 255
  const fillG = pn ? Math.round(pg / pn) : 255
  const fillB = pn ? Math.round(pb / pn) : 255
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor(box.x * w))
    const y0 = Math.max(0, Math.floor(box.y * h))
    const x1 = Math.min(w - 1, Math.ceil((box.x + box.w) * w))
    const y1 = Math.min(h - 1, Math.ceil((box.y + box.h) * h))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        if (lum < threshold) {
          d[i] = fillR
          d[i + 1] = fillG
          d[i + 2] = fillB
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return c.toDataURL('image/jpeg', 0.94)
}

export async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadImageEl(dataUrl)
  return { width: img.naturalWidth, height: img.naturalHeight }
}
