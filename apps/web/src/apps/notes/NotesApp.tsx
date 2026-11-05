import {
  BookOpen,
  Check,
  Copy,
  Download,
  Eraser,
  Highlighter,
  Minus,
  PenLine,
  Plus,
  Redo2,
  ScanText,
  Share2,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { visionCompletion } from '../../core/ai'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import type { Notebook, NotePage, NoteText, Point, Stroke } from '../../core/types'
import { cn, copyText, downloadBlob, nowIso, uid } from '../../core/utils'

const MAX_W = 1240
const MAX_H = 1754
const COLORS = ['#1f2937', '#1d4ed8', '#b91c1c', '#059669', '#7c3aed', '#d97706']
const WIDTHS = [1.6, 3, 5.4]
const TEMPLATES: { id: NotePage['template']; label: string }[] = [
  { id: 'blank', label: '空白' },
  { id: 'lined', label: '横线' },
  { id: 'grid', label: '网格' },
  { id: 'dot', label: '点阵' },
]

function drawPage(ctx: CanvasRenderingContext2D, page: NotePage, width: number, height: number, opts: { background?: boolean; shadow?: string } = {}) {
  const scale = width / MAX_W
  if (opts.background !== false) {
    ctx.fillStyle = '#fdfaf2'
    ctx.fillRect(0, 0, width, height)
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, 'rgba(255,255,255,.35)')
    g.addColorStop(1, 'rgba(237,228,208,.18)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }
  ctx.save()
  ctx.strokeStyle = 'rgba(78, 116, 170, .16)'
  ctx.lineWidth = Math.max(1, 1.2 * scale)
  if (page.template === 'lined') {
    for (let y = height * 0.09; y < height * 0.94; y += 44 * scale) {
      ctx.beginPath(); ctx.moveTo(width * 0.075, y); ctx.lineTo(width * 0.925, y); ctx.stroke()
    }
  } else if (page.template === 'grid') {
    for (let x = width * 0.06; x < width * 0.95; x += 44 * scale) {
      ctx.beginPath(); ctx.moveTo(x, height * 0.06); ctx.lineTo(x, height * 0.95); ctx.stroke()
    }
    for (let y = height * 0.06; y < height * 0.95; y += 44 * scale) {
      ctx.beginPath(); ctx.moveTo(width * 0.06, y); ctx.lineTo(width * 0.95, y); ctx.stroke()
    }
  } else if (page.template === 'dot') {
    ctx.fillStyle = 'rgba(78, 116, 170, .28)'
    for (let x = width * 0.08; x < width * 0.95; x += 34 * scale) {
      for (let y = height * 0.08; y < height * 0.95; y += 34 * scale) {
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, 1.1 * scale), 0, Math.PI * 2); ctx.fill()
      }
    }
  }
  ctx.restore()

  for (const t of page.texts ?? []) {
    ctx.save()
    ctx.fillStyle = t.color
    ctx.font = `600 ${t.size * scale}px "Noto Sans SC Variable", "PingFang SC", sans-serif`
    ctx.textBaseline = 'top'
    const lines = t.text.split('\n')
    lines.forEach((line, i) => ctx.fillText(line, t.x * width, t.y * height + i * t.size * 1.28 * scale))
    ctx.restore()
  }

  for (const stroke of page.strokes) {
    drawStroke(ctx, stroke, width, height, scale)
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number, scale: number) {
  if (!stroke.points.length) return
  const pts = stroke.points.map((p) => ({ x: p.x * width, y: p.y * height, p: p.p }))
  const base = stroke.width * 2.15 * scale
  const avgP = pts.reduce((n, p) => n + p.p, 0) / pts.length
  const lineWidth = Math.max(0.8, base * (0.6 + avgP * 0.8))
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = lineWidth
  ctx.globalAlpha = stroke.tool === 'marker' ? 0.3 : 1
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0].x, pts[0].y, lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }
  const mid = (a: typeof pts[number], b: typeof pts[number]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  ctx.beginPath()
  if (pts.length === 2) {
    ctx.moveTo(pts[0].x, pts[0].y)
    ctx.lineTo(pts[1].x, pts[1].y)
  } else {
    // Quadratic midpoint interpolation. Every raw point controls a smooth
    // segment; round caps hide the seams. This removes the polyline look of
    // the previous per-segment renderer without adding latency.
    ctx.moveTo(pts[0].x, pts[0].y)
    const firstMid = mid(pts[0], pts[1])
    ctx.lineTo(firstMid.x, firstMid.y)
    for (let i = 1; i < pts.length - 1; i++) {
      const a = mid(pts[i - 1], pts[i])
      const b = mid(pts[i], pts[i + 1])
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, b.x, b.y)
    }
    const lastMid = mid(pts[pts.length - 2], pts[pts.length - 1])
    ctx.moveTo(lastMid.x, lastMid.y)
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
  }
  ctx.stroke()
  ctx.restore()
}

function pageHeight(page: NotePage) { return MAX_H }

export default function NotesApp({ params, winId }: AppProps) {
  const notebooks = useSystem((s) => s.notebooks)
  const addNotebook = useSystem((s) => s.addNotebook)
  const updateNotebook = useSystem((s) => s.updateNotebook)
  const addNotePage = useSystem((s) => s.addNotePage)
  const updateNotePage = useSystem((s) => s.updateNotePage)
  const deleteNotebook = useSystem((s) => s.deleteNotebook)
  const toast = useSystem((s) => s.toast)
  const [activeId, setActiveId] = useState<string>((params.notebookId as string) || notebooks[0]?.id || '')
  const [pageIndex, setPageIndex] = useState(0)
  const [tool, setTool] = useState<'pen' | 'marker' | 'eraser' | 'text'>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [width, setWidth] = useState(WIDTHS[1])
  const [zoom, setZoom] = useState(1)
  const [textBox, setTextBox] = useState<{ x: number; y: number; left: number; top: number; value: string } | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [fontTick, setFontTick] = useState(0)
  const [ocrOpen, setOcrOpen] = useState(false)
  const [ocrImage, setOcrImage] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const tailCanvasRef = useRef<HTMLCanvasElement>(null)
  const liveStroke = useRef<Stroke | null>(null)
  const drawing = useRef(false)
  const rawSeen = useRef(false)
  const skipBaseRedraw = useRef(false)
  const moveHandlerRef = useRef<(native: PointerEvent) => void>(() => {})
  const undoStack = useRef<Array<{ strokes: Stroke[]; texts: NoteText[] }>>([])
  const redoStack = useRef<Array<{ strokes: Stroke[]; texts: NoteText[] }>>([])
  const notebook = notebooks.find((n) => n.id === activeId) ?? notebooks[0]
  const page = notebook?.pages[Math.min(pageIndex, Math.max(0, notebook.pages.length - 1))]

  useEffect(() => {
    if (params.notebookId && params.notebookId !== activeId) {
      setActiveId(String(params.notebookId))
      setPageIndex(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.notebookId])

  useEffect(() => {
    document.fonts?.ready?.then(() => setFontTick((t) => t + 1)).catch(() => {})
  }, [])

  useEffect(() => {
    undoStack.current = []
    redoStack.current = []
    liveStroke.current = null
    skipBaseRedraw.current = false
    setTextBox(null)
    clearLive()
  }, [activeId, pageIndex])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !page) return
    if (skipBaseRedraw.current) {
      skipBaseRedraw.current = false
      clearLive()
      return
    }
    const ctx = canvas.getContext('2d', { desynchronized: true })!
    drawPage(ctx, page, MAX_W, MAX_H)
    clearLive()
  }, [page, fontTick])

  const savePage = (next: { strokes?: Stroke[]; texts?: NoteText[]; template?: NotePage['template'] }) => {
    if (!notebook || !page) return
    updateNotePage(notebook.id, page.id, next)
    setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
  }

  const snapshot = () => ({ strokes: page?.strokes ?? [], texts: page?.texts ?? [] })

  const commit = (next: { strokes?: Stroke[]; texts?: NoteText[]; template?: NotePage['template'] }) => {
    if (!page) return
    undoStack.current.push(snapshot())
    if (undoStack.current.length > 60) undoStack.current.shift()
    redoStack.current = []
    savePage(next)
  }

  const undo = () => {
    if (!page || !undoStack.current.length) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(snapshot())
    savePage(prev)
  }

  const redo = () => {
    if (!page || !redoStack.current.length) return
    const next = redoStack.current.pop()!
    undoStack.current.push(snapshot())
    savePage(next)
  }

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      p: e.pressure > 0 ? e.pressure : 0.5,
    }
  }

  const clearLive = () => {
    for (const c of [liveCanvasRef.current, tailCanvasRef.current]) {
      if (c) c.getContext('2d', { desynchronized: true })!.clearRect(0, 0, c.width, c.height)
    }
  }

  const styleLive = (ctx: CanvasRenderingContext2D) => {
    const s = liveStroke.current
    if (!s) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = Math.max(0.8, s.width * 2.15)
    ctx.globalAlpha = s.tool === 'marker' ? 0.3 : 1
  }

  const drawLiveBatch = (fromIndex: number) => {
    const s = liveStroke.current
    const canvas = liveCanvasRef.current
    if (!s || !canvas || !s.points.length) return
    const ctx = canvas.getContext('2d', { desynchronized: true })!
    const n = s.points.length
    ctx.save()
    styleLive(ctx)
    if (n === 1) {
      ctx.beginPath()
      ctx.arc(s.points[0].x * MAX_W, s.points[0].y * MAX_H, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }
    ctx.beginPath()
    const px = (p: Point) => p.x * MAX_W
    const py = (p: Point) => p.y * MAX_H
    for (let i = Math.max(1, fromIndex); i < n; i++) {
      if (i === 1) {
        const a = s.points[0]
        const b = s.points[1]
        ctx.moveTo(px(a), py(a))
        ctx.lineTo((px(a) + px(b)) / 2, (py(a) + py(b)) / 2)
      } else {
        const a = s.points[i - 2]
        const b = s.points[i - 1]
        const c = s.points[i]
        ctx.moveTo((px(a) + px(b)) / 2, (py(a) + py(b)) / 2)
        ctx.quadraticCurveTo(px(b), py(b), (px(b) + px(c)) / 2, (py(b) + py(c)) / 2)
      }
    }
    ctx.stroke()
    ctx.restore()
  }

  const drawTail = () => {
    const s = liveStroke.current
    const canvas = tailCanvasRef.current
    if (!s || !canvas || s.points.length < 2) return
    const ctx = canvas.getContext('2d', { desynchronized: true })!
    const a = s.points[s.points.length - 2]
    const b = s.points[s.points.length - 1]
    const mx = ((a.x + b.x) / 2) * MAX_W
    const my = ((a.y + b.y) / 2) * MAX_H
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    styleLive(ctx)
    ctx.beginPath()
    ctx.moveTo(mx, my)
    ctx.lineTo(b.x * MAX_W, b.y * MAX_H)
    ctx.stroke()
    ctx.restore()
  }

  const addLivePoints = (incoming: Point[]) => {
    const s = liveStroke.current
    if (!s || !incoming.length) return
    const oldLength = s.points.length
    for (const pt of incoming) {
      const last = s.points[s.points.length - 1]
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.0006) continue
      s.points.push(pt)
    }
    if (s.points.length > oldLength) {
      drawLiveBatch(oldLength)
      drawTail()
    }
  }

  const handleNativeMove = (native: PointerEvent) => {
    if (!drawing.current || !liveStroke.current) return
    const canvas = liveCanvasRef.current
    if (!canvas) return
    native.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    const events = coalesced.length ? coalesced : [native]
    const points: Point[] = []
    for (const ev of events) {
      points.push({
        x: Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height)),
        p: ev.pressure > 0 ? ev.pressure : 0.5,
      })
    }
    addLivePoints(points)
  }
  moveHandlerRef.current = handleNativeMove

  useEffect(() => {
    const canvas = liveCanvasRef.current
    if (!canvas) return
    const handler = (e: Event) => {
      rawSeen.current = true
      moveHandlerRef.current(e as PointerEvent)
    }
    canvas.addEventListener('pointerrawupdate', handler, { passive: false })
    return () => canvas.removeEventListener('pointerrawupdate', handler)
  }, [page?.id])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!page) return
    const pt = pointFromEvent(e)
    if (tool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect()
      setTextBox({ x: pt.x, y: pt.y, left: e.clientX - rect.left, top: e.clientY - rect.top, value: '' })
      return
    }
    if (tool === 'eraser') {
      const threshold = 0.018
      const removed = page.strokes.filter((s) => s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold))
      if (removed.length) {
        const ids = new Set(removed.map((s) => s.id))
        commit({ strokes: page.strokes.filter((s) => !ids.has(s.id)) })
      }
      return
    }
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    rawSeen.current = false
    clearLive()
    drawing.current = true
    liveStroke.current = { id: uid('stroke'), tool, color, width, points: [] }
    addLivePoints([pt])
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !liveStroke.current) return
    if (rawSeen.current) return
    handleNativeMove(e.nativeEvent as PointerEvent)
  }

  const finishStroke = (cancel = false) => {
    if (!drawing.current) return
    drawing.current = false
    const s = liveStroke.current
    if (!cancel && s && s.points.length && page) {
      // Paint the committed stroke straight onto the base canvas. The state
      // effect skips its full-page redraw once, so ending a stroke never
      // re-renders every previous stroke.
      const base = canvasRef.current
      if (base) {
        drawStroke(base.getContext('2d', { desynchronized: true })!, s, MAX_W, MAX_H, 1)
        skipBaseRedraw.current = true
        clearLive()
        commit({ strokes: [...page.strokes, s] })
      }
    } else {
      clearLive()
    }
    liveStroke.current = null
  }

  const addText = () => {
    if (!textBox || !page || !textBox.value.trim()) { setTextBox(null); return }
    const text: NoteText = { id: uid('text'), x: textBox.x, y: textBox.y, text: textBox.value.trim(), color, size: Math.round(20 + width * 4) }
    commit({ texts: [...(page.texts ?? []), text] })
    setTextBox(null)
  }

  const clearPage = () => {
    if (!page) return
    commit({ strokes: [], texts: [] })
    toast('已清空当前页', '可以使用撤销恢复。', 'info')
  }

  const exportPng = async (share = false) => {
    if (!page) return
    const c = document.createElement('canvas')
    c.width = MAX_W
    c.height = MAX_H
    const ctx = c.getContext('2d')!
    drawPage(ctx, page, MAX_W, MAX_H)
    c.toBlob(async (blob) => {
      if (!blob) return
      if (share) {
        ecosystem.share({ title: `${notebook?.title ?? '手写笔记'}-第${pageIndex + 1}页.png`, image: c.toDataURL('image/png'), text: '来自墨记的手写笔记', sourceApp: 'notes' })
        return
      }
      downloadBlob(blob, `${notebook?.title ?? '笔记'}-第${pageIndex + 1}页.png`)
      toast('已导出 PNG', '也可以保存到云巢作为长期归档。', 'success')
    }, 'image/png')
  }

  const exportPdf = async (save = false) => {
    if (!notebook) return
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    for (let i = 0; i < notebook.pages.length; i++) {
      const c = document.createElement('canvas')
      c.width = MAX_W
      c.height = MAX_H
      drawPage(c.getContext('2d')!, notebook.pages[i], MAX_W, MAX_H)
      if (i > 0) doc.addPage()
      doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
    }
    const blob = doc.output('blob')
    if (save) {
      const saved = await ecosystem.saveFile({ name: `${notebook.title}-${new Date().toISOString().slice(0, 10)}.pdf`, mime: 'application/pdf', blob, folderName: '文档', sourceApp: 'notes', tags: ['手写', '笔记'] })
      toast('已保存到云巢', saved.name, 'success')
    } else {
      downloadBlob(blob, `${notebook.title}.pdf`)
      toast('已导出 PDF', `${notebook.pages.length} 页`, 'success')
    }
  }

  const openOcr = () => {
    if (!page) return
    const c = document.createElement('canvas')
    c.width = MAX_W
    c.height = MAX_H
    drawPage(c.getContext('2d')!, page, MAX_W, MAX_H)
    setOcrImage(c.toDataURL('image/jpeg', 0.92))
    setOcrOpen(true)
  }

  const insertOcrText = (text: string) => {
    if (!notebook || !text.trim()) return
    const lines: string[] = []
    for (const raw of text.split('\n')) {
      if (!raw.trim()) { lines.push(''); continue }
      let line = ''
      for (const ch of raw) {
        line += ch
        if (line.length >= 26) { lines.push(line); line = '' }
      }
      if (line) lines.push(line)
    }
    const chunks: string[][] = []
    for (let i = 0; i < lines.length; i += 32) chunks.push(lines.slice(i, i + 32))
    if (!chunks.length) chunks.push([text])
    const start = notebook.pages.length
    for (const chunk of chunks) {
      const id = addNotePage(notebook.id)
      updateNotePage(notebook.id, id, {
        template: 'lined',
        texts: [{ id: uid('text'), x: 0.08, y: 0.09, text: chunk.join('\n'), color: '#202636', size: 32 }],
      })
    }
    setPageIndex(start)
    setOcrOpen(false)
    toast('已生成文字页', `${chunks.length} 页，可在页面上继续批注。`, 'success')
  }

  const newNotebook = () => {
    const id = addNotebook({ title: '未命名笔记' })
    setActiveId(id)
    setPageIndex(0)
    toast('已创建笔记本', '开始写下你的想法。', 'success')
  }

  const newPage = () => {
    if (!notebook) return
    addNotePage(notebook.id)
    setPageIndex(notebook.pages.length)
  }

  const removePage = () => {
    if (!notebook || notebook.pages.length <= 1) return
    const pages = notebook.pages.filter((_, i) => i !== pageIndex)
    updateNotebook(notebook.id, { pages })
    setPageIndex(Math.max(0, pageIndex - 1))
  }

  const pageList = notebook?.pages ?? []

  return (
    <div className="notes">
      <aside className="notes-side">
        <header><div><span className="sheet-eyebrow">INK NOTES</span><h2>墨记</h2></div><button className="icon-btn sm" onClick={newNotebook}><Plus size={15} /></button></header>
        <div className="notes-list">
          {notebooks.map((n) => (
            <button key={n.id} className={cn('notebook-item', n.id === notebook?.id && 'active')} onClick={() => { setActiveId(n.id); setPageIndex(0) }}>
              <span className="notebook-cover" style={{ background: `linear-gradient(145deg, hsl(${n.coverHue} 60% 55%), hsl(${n.coverHue + 35} 55% 34%))` }}><BookOpen size={14} /></span>
              <span className="grow"><strong>{n.title}</strong><small>{n.pages.length} 页 · {n.updatedAt.slice(5, 10).replace('-', '/')}</small></span>
            </button>
          ))}
        </div>
        <div className="notes-pages-head"><span className="section-title">页面</span><div><button className="icon-btn sm" onClick={newPage}><Plus size={13} /></button><button className="icon-btn sm" onClick={removePage} disabled={pageList.length <= 1}><Trash2 size={12} /></button></div></div>
        <div className="notes-pages scroll-y">
          {pageList.map((p, i) => (
            <button key={p.id} className={cn('page-thumb', i === pageIndex && 'active')} onClick={() => setPageIndex(i)}>
              <PageThumb page={p} />
              <span>{String(i + 1).padStart(2, '0')}</span>
            </button>
          ))}
          <button className="page-add" onClick={newPage}><Plus size={14} /><span>新页</span></button>
        </div>
        <button className="notes-delete" onClick={() => { if (notebook && notebooks.length > 1) { deleteNotebook(notebook.id); setActiveId(notebooks.find((n) => n.id !== notebook.id)?.id ?? ''); setPageIndex(0) } }}><Trash2 size={12} /> 删除笔记本</button>
      </aside>

      <main className="notes-main">
        <header className="notes-head">
          <div className="notes-title-row">
            <input className="notes-title" value={notebook?.title ?? ''} onChange={(e) => notebook && updateNotebook(notebook.id, { title: e.target.value })} />
            <span className="notes-page-indicator">{pageList.length ? `${pageIndex + 1} / ${pageList.length}` : '0 / 0'}</span>
          </div>
          <div className="notes-head-actions">
            <button className="btn sm" onClick={openOcr} disabled={!page}><ScanText size={12} /> 识别</button>
            <button className="btn sm" onClick={() => exportPng(true)}><Share2 size={12} /> 分享</button>
            <button className="btn sm" onClick={() => exportPng(false)}><Download size={12} /> PNG</button>
            <button className="btn primary sm" onClick={() => exportPdf(true)}><Download size={12} /> 保存 PDF</button>
          </div>
        </header>

        <div className="notes-toolbar">
          <div className="notes-tools">
            <button className={cn('notes-tool', tool === 'pen' && 'active')} onClick={() => setTool('pen')} title="钢笔"><PenLine size={16} /></button>
            <button className={cn('notes-tool', tool === 'marker' && 'active')} onClick={() => setTool('marker')} title="荧光笔"><Highlighter size={16} /></button>
            <button className={cn('notes-tool', tool === 'eraser' && 'active')} onClick={() => setTool('eraser')} title="橡皮（点击笔画）"><Eraser size={16} /></button>
            <button className={cn('notes-tool', tool === 'text' && 'active')} onClick={() => setTool('text')} title="文字"><Type size={16} /></button>
            <button className="notes-tool" onClick={openOcr} disabled={!page} title="识别文字"><ScanText size={16} /></button>
          </div>
          <div className="notes-divider" />
          <div className="notes-colors">
            {COLORS.map((c) => <button key={c} className={cn('color-dot', color === c && 'active')} style={{ background: c }} onClick={() => setColor(c)} aria-label={`颜色 ${c}`} />)}
          </div>
          <div className="notes-divider" />
          <div className="notes-widths">
            {WIDTHS.map((w) => <button key={w} className={cn('width-btn', width === w && 'active')} onClick={() => setWidth(w)}><span style={{ width: 4 + w * 2, height: 4 + w * 2 }} /></button>)}
          </div>
          <div className="notes-divider" />
          <div className="notes-undo">
            <button className="icon-btn sm" onClick={undo} title="撤销"><Undo2 size={14} /></button>
            <button className="icon-btn sm" onClick={redo} title="重做"><Redo2 size={14} /></button>
            <button className="icon-btn sm" onClick={clearPage} title="清空当前页"><Trash2 size={13} /></button>
          </div>
          <span className="grow" />
          <div className="notes-zoom"><button className="icon-btn sm" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}><ZoomOut size={13} /></button><span>{Math.round(zoom * 100)}%</span><button className="icon-btn sm" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}><ZoomIn size={13} /></button></div>
          <select className="notes-template" value={page?.template ?? 'dot'} onChange={(e) => commit({ template: e.target.value as NotePage['template'] })}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="notes-stage">
          <div className="notes-canvas-wrap" style={{ transform: `scale(${zoom})` }}>
            <div className="notes-canvas-stack">
              <canvas ref={canvasRef} width={MAX_W} height={MAX_H} className="notes-canvas" />
              <canvas
                ref={tailCanvasRef}
                width={MAX_W}
                height={MAX_H}
                className="notes-canvas-tail"
              />
              <canvas
                ref={liveCanvasRef}
                width={MAX_W}
                height={MAX_H}
                className={cn('notes-canvas-live', tool === 'text' && 'text-tool', tool === 'eraser' && 'eraser-tool')}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => finishStroke(false)}
                onPointerCancel={() => finishStroke(true)}
              />
              {textBox && (
              <div className="notes-text-input" style={{ left: textBox.left, top: textBox.top }}>
                <input
                  autoFocus
                  value={textBox.value}
                  onChange={(e) => setTextBox({ ...textBox, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') addText(); if (e.key === 'Escape') setTextBox(null) }}
                  placeholder="输入文字，Enter 确认"
                />
                <button onClick={addText}><Plus size={12} /></button>
                <button onClick={() => setTextBox(null)}><X size={12} /></button>
                </div>
              )}
            </div>
          </div>
          {!page && <div className="empty-state"><BookOpen size={26} /><strong>选择或新建一个笔记本</strong></div>}
        </div>
        <footer className="notes-foot">
          <span><span className="dot" /> 已保存到本机 {savedAt && `· ${savedAt}`}</span>
          <span>支持 Apple Pencil / 触控笔压感 · {pageList.length} 页</span>
          <span>{tool === 'eraser' ? '点击笔画即可擦除' : tool === 'text' ? '点击纸面输入文字' : '直接书写'}</span>
          <span className="grow" />
          <button className="text-btn" onClick={() => ecosystem.askAI({ prompt: `帮我基于「${notebook?.title}」这本手写笔记（${pageList.length} 页）整理一份结构化提纲。`, origin: 'notes' })}><Sparkles size={11} /> AI 整理</button>
        </footer>
      </main>
      {ocrOpen && page && ocrImage && (
        <NotesOcrModal page={page} image={ocrImage} title={notebook?.title ?? '笔记'} onClose={() => setOcrOpen(false)} onInsert={insertOcrText} />
      )}
    </div>
  )
}

function PageThumb({ page }: { page: NotePage }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    drawPage(ctx, page, 120, 170)
  }, [page])
  return <canvas ref={ref} width={120} height={170} className="page-thumb-canvas" />
}

function NotesOcrModal({ page, image, title, onClose, onInsert }: {
  page: NotePage
  image: string
  title: string
  onClose: () => void
  onInsert: (text: string) => void
}) {
  const providers = useSystem((s) => s.providers)
  const selectedProviderId = useSystem((s) => s.selectedProviderId)
  const toast = useSystem((s) => s.toast)
  const [engine, setEngine] = useState<'local' | 'ai'>('local')
  const looksVision = (p: { model: string }) => /gpt-4o|gpt-4\.1|gpt-4v|gemini|claude|vision|qwen.*vl|glm-4v|llava/i.test(p.model)
  const initialProvider = providers.find((p) => p.id === selectedProviderId && p.kind !== 'demo' && looksVision(p))?.id
    ?? providers.find((p) => p.kind !== 'demo' && p.apiKey && looksVision(p))?.id
    ?? providers.find((p) => p.id === selectedProviderId && p.kind !== 'demo')?.id
    ?? providers.find((p) => p.kind !== 'demo')?.id ?? ''
  const [providerId, setProviderId] = useState(initialProvider)
  const [status, setStatus] = useState<'idle' | 'loading' | 'working' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const workerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const provider = providers.find((p) => p.id === providerId)
  const providerReady = Boolean(provider && (provider.kind === 'ollama' || provider.apiKey))

  useEffect(() => () => {
    workerRef.current?.terminate().catch(() => {})
    abortRef.current?.abort()
  }, [])

  const resetForEngine = (next: 'local' | 'ai') => {
    abortRef.current?.abort()
    setEngine(next)
    setStatus('idle')
    setProgress(0)
    setText('')
    setError('')
  }

  const clean = (raw: string) => raw.replace(/^```[a-z-]*\s*/i, '').replace(/```\s*$/, '').trim()

  const run = async () => {
    setStatus('loading')
    setProgress(0.02)
    setError('')
    try {
      if (engine === 'local') {
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('chi_sim+eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') { setStatus('working'); setProgress(m.progress) }
          },
        })
        workerRef.current = worker
        setStatus('working')
        const result = await worker.recognize(image)
        setText(clean(result.data.text).replace(/([\u3400-\u9fff]) +(?=[\u3400-\u9fff])/g, '$1'))
        setStatus('done')
        await worker.terminate()
        workerRef.current = null
      } else {
        if (!provider) throw new Error('请选择 AI 视觉模型')
        if (!providerReady) throw new Error('该模型还没有配置 API Key，请先到控制台 → AI 模型 配置。')
        setStatus('working')
        const controller = new AbortController()
        abortRef.current = controller
        const prompt = '你是 OCR 引擎。逐字转录图片中的手写和印刷文字，保留原有换行、编号、列表层级和标题。只输出转录文本，不要解释、不要总结、不要使用 Markdown 代码块。无法辨认的字用「□」。'
        const result = await visionCompletion(provider, image, prompt, controller.signal)
        setText(clean(result))
        setStatus('done')
        abortRef.current = null
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') { setStatus('idle'); return }
      setStatus('error')
      setError(e instanceof Error ? e.message : '识别失败')
    }
  }

  const saveMarkdown = async () => {
    if (!text.trim()) return
    await ecosystem.saveText({
      name: `OCR-${title}-${new Date().toISOString().slice(0, 10)}.md`,
      text: `# ${title} · OCR\n\n> 来源：墨记第 ${page.id} 页\n\n${text}`,
      mime: 'text/markdown',
      folderName: '笔记',
      sourceApp: 'notes',
      tags: ['OCR', '笔记'],
    })
    toast('已保存到云巢', 'Markdown 文件已归档。', 'success')
  }

  return (
    <div className="notes-ocr-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="notes-ocr-modal">
        <header>
          <div><span className="sheet-eyebrow">OCR · INK TO TEXT</span><h3>识别文字</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="notes-ocr-source">
          <img src={image} alt="" />
          <div><strong>{title}</strong><span>当前页面 · 本地识别不上传</span></div>
        </div>
        <div className="notes-ocr-tabs">
          <button className={cn(engine === 'local' && 'active')} onClick={() => resetForEngine('local')}><ScanText size={13} /><span><strong>本地 OCR</strong><small>印刷体 · 离线</small></span></button>
          <button className={cn(engine === 'ai' && 'active')} onClick={() => resetForEngine('ai')}><Sparkles size={13} /><span><strong>AI 视觉</strong><small>手写优先 · 云端</small></span></button>
        </div>
        {engine === 'ai' && (
          <div className="notes-ocr-provider">
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {providers.filter((p) => p.kind !== 'demo').map((p) => <option key={p.id} value={p.id}>{p.label} · {p.model}</option>)}
            </select>
            <span className="hint">{providerReady ? '请选支持图片输入的视觉模型（gpt-4o / Gemini / Claude 等）；图片会发送给所选服务商。' : '该模型未配置 API Key。'}</span>
          </div>
        )}
        {status === 'idle' && (
          <div className="notes-ocr-idle">
            <strong>{engine === 'local' ? '识别印刷体或工整文字' : '识别手写内容'}</strong>
            <p>{engine === 'local' ? '本地 Tesseract 中英文混合识别；首次运行需下载约 10–15 MB 语言包，页面图片不会上传。' : '调用你配置的视觉模型，适合手写、复杂版式和表格；图片会发送到对应服务商。'}</p>
            <button className="btn primary" onClick={run} disabled={engine === 'ai' && !providerReady}><ScanText size={14} /> 开始识别</button>
          </div>
        )}
        {(status === 'loading' || status === 'working') && (
          <div className="notes-ocr-progress">
            <span className="spinner" />
            <strong>{status === 'loading' ? '正在准备识别引擎…' : engine === 'ai' ? '正在请视觉模型识别…' : '正在识别文字…'}</strong>
            {engine === 'local' && <><div className="ocr-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div><span>{Math.round(progress * 100)}%</span></>}
          </div>
        )}
        {status === 'error' && <div className="notes-ocr-idle error"><strong>识别失败</strong><p>{error}</p><button className="btn sm" onClick={run}>重试</button></div>}
        {status === 'done' && (
          <>
            <textarea className="textarea notes-ocr-text" value={text} onChange={(e) => setText(e.target.value)} rows={11} placeholder="没有识别到文字，或结果为空。" />
            <div className="notes-ocr-actions">
              <span className="hint">{text.length} 字符 · 可编辑</span>
              <span className="grow" />
              <button className="btn sm" onClick={async () => { await copyText(text); toast('已复制识别文字', undefined, 'success') }}><Copy size={12} /> 复制</button>
              <button className="btn sm" onClick={saveMarkdown}><Download size={12} /> 存为 Markdown</button>
              <button className="btn primary sm" onClick={() => onInsert(text)} disabled={!text.trim()}><Check size={12} /> 生成文字页</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
