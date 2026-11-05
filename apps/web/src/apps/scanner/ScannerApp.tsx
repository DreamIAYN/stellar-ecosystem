import {
  ArrowLeft,
  Camera,
  ClipboardPaste,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileScan,
  FileText,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RotateCw,
  ScanLine,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Zap,
  UserRound,
  Wand2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import { cn, copyText, downloadBlob, loadImage } from '../../core/utils'
import { autoCrop, fileToDataUrl, FULL_CORNERS, imageSize, makeScan, removeBlackInk, rotateDataUrl, type Corner, type FilterId, type NormRect, FILTERS } from './imageOps'

type Mode = 'document' | 'exam' | 'idcard'

interface Page {
  id: string
  name: string
  original: string
  processed: string
  corners: Corner[]
  width: number
  height: number
  filter: FilterId
  rotation: number
  hd: boolean
  whiteBg: boolean
  blackBoxes: NormRect[]
}

const MODES: { id: Mode; label: string; icon: typeof FileText; note: string }[] = [
  { id: 'document', label: '文档', icon: FileText, note: '合同 / 发票 / 书页' },
  { id: 'exam', label: '试卷', icon: ScanLine, note: '去红蓝笔迹' },
  { id: 'idcard', label: '证件', icon: IdCard, note: '身份证 / 护照' },
]

const MODE_FILTER: Record<Mode, FilterId> = { document: 'magic', exam: 'removeInk', idcard: 'enhance' }

export default function ScannerApp({ params, winId }: AppProps) {
  const files = useSystem((s) => s.files)
  const toast = useSystem((s) => s.toast)
  const [mode, setMode] = useState<Mode>((params.mode as Mode) || 'document')
  const [pages, setPages] = useState<Page[]>([])
  const [activeId, setActiveId] = useState('')
  const [cropMode, setCropMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ocrOpen, setOcrOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [inkStrength, setInkStrength] = useState(72)
  const [inkMode, setInkMode] = useState<'redblue' | 'all'>('redblue')
  const [preserveInk, setPreserveInk] = useState(true)
  const [sharpen, setSharpen] = useState(0)
  const [compare, setCompare] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [blackSelectMode, setBlackSelectMode] = useState(false)
  const [boxDraft, setBoxDraft] = useState<NormRect | null>(null)
  const boxStart = useRef<{ x: number; y: number } | null>(null)
  const boxDraftRef = useRef<NormRect | null>(null)
  const [watermark, setWatermark] = useState('仅供办理业务使用')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [keepOriginal, setKeepOriginal] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const addFromDataUrlRef = useRef<((dataUrl: string, name: string, crop?: boolean) => Promise<void>) | null>(null)
  const autoSample = useRef(false)
  const active = pages.find((p) => p.id === activeId) ?? pages[0]

  useEffect(() => {
    const m = params.mode as Mode | undefined
    if (m && m !== mode) setMode(m)
    if (m === 'exam' && !autoSample.current && pages.length === 0) {
      autoSample.current = true
      setTimeout(() => loadSample('exam'), 280)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.mode])

  // file id passed from cloud-drive "open with scanner"
  useEffect(() => {
    if (!params.fileId) return
    const f = files.find((x) => x.id === params.fileId)
    if (!f) return
    ecosystem.getFileBlob(f).then(async (blob) => {
      if (!blob) return
      const dataUrl = await fileToDataUrl(new File([blob], f.name, { type: f.mime }))
      addFromDataUrl(dataUrl, f.name, true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.fileId])

  const addFromDataUrl = async (dataUrl: string, name: string, crop = true) => {
    setCompare(false)
    setBusy(true)
    try {
      const size = await imageSize(dataUrl)
      const filter = MODE_FILTER[mode]
      const corners = await autoCrop(dataUrl).catch(() => FULL_CORNERS)
      const page: Page = {
        id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        original: dataUrl,
        processed: dataUrl,
        corners,
        width: size.width,
        height: size.height,
        filter,
        rotation: 0,
        hd: false,
        whiteBg: false,
        blackBoxes: [],
      }
      setPages((prev) => [...prev, page])
      setActiveId(page.id)
      setCropMode(crop)
      const result = await makeScan(dataUrl, corners, filter, inkStrength, { mode: inkMode, preserve: preserveInk }, 1700, 0, 1)
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, processed: result.dataUrl, width: result.width, height: result.height } : p)))
    } catch (e) {
      toast('导入失败', e instanceof Error ? e.message : '无法读取图片', 'error')
    } finally {
      setBusy(false)
    }
  }

  addFromDataUrlRef.current = addFromDataUrl

  const loadFromFile = async (fileId: string) => {
    const f = files.find((x) => x.id === fileId)
    if (!f) return
    const blob = await ecosystem.getFileBlob(f)
    if (!blob) return
    const dataUrl = await fileToDataUrl(new File([blob], f.name, { type: f.mime }))
    addFromDataUrl(dataUrl, f.name, true)
  }

  const handleImports = async (list: FileList | null) => {
    if (!list?.length) return
    for (const file of Array.from(list).slice(0, 12)) {
      if (!file.type.startsWith('image/') && !file.name.endsWith('.svg')) continue
      const dataUrl = await fileToDataUrl(file)
      await addFromDataUrl(dataUrl, file.name, true)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const reprocess = async (
    page: Page,
    opts: { filter?: FilterId; corners?: Corner[]; strength?: number; hd?: boolean; sharpen?: number; whiteBg?: boolean; inkMode?: 'redblue' | 'all'; preserveInk?: boolean } = {},
  ) => {
    const filter = opts.filter ?? page.filter
    const corners = opts.corners ?? page.corners
    const strength = opts.strength ?? inkStrength
    const hd = opts.hd ?? page.hd
    const whiteBg = opts.whiteBg ?? page.whiteBg
    const sharp = opts.sharpen ?? sharpen
    const ink = { mode: opts.inkMode ?? inkMode, preserve: opts.preserveInk ?? preserveInk }
    setBusy(true)
    try {
      const result = await makeScan(page.original, corners, filter, strength, ink, hd ? 3200 : 1700, sharp, hd ? 2 : 1, whiteBg)
      const cleaned = filter !== 'original' && page.blackBoxes?.length ? await removeBlackInk(result.dataUrl, page.blackBoxes) : result.dataUrl
      setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, processed: cleaned, width: result.width, height: result.height, filter, corners, hd, whiteBg } : p)))
    } catch (e) {
      toast('处理失败', e instanceof Error ? e.message : '无法处理图片', 'error')
    } finally {
      setBusy(false)
    }
  }

  const changeSharpen = (value: number, commit = false) => {
    setSharpen(value)
    if (commit && active) reprocess(active, { sharpen: value })
  }

  const changeInkMode = (next: 'redblue' | 'all') => {
    setInkMode(next)
    setCompare(false)
    if (active?.filter === 'removeInk') reprocess(active, { filter: 'removeInk', inkMode: next })
  }

  const togglePreserveInk = () => {
    const next = !preserveInk
    setPreserveInk(next)
    setCompare(false)
    if (active?.filter === 'removeInk') reprocess(active, { filter: 'removeInk', preserveInk: next })
  }

  const toggleHd = () => {
    if (!active) return
    const next = !active.hd
    const sharp = next ? Math.max(55, sharpen) : sharpen
    if (next) setSharpen(sharp)
    setCompare(false)
    reprocess(active, { hd: next, sharpen: sharp, whiteBg: next ? true : active.whiteBg })
  }

  const toggleWhiteBg = () => {
    if (!active) return
    setCompare(false)
    reprocess(active, { whiteBg: !active.whiteBg })
  }

  const toggleBlackSelect = () => {
    setCompare(false)
    setCropMode(false)
    setBlackSelectMode((v) => !v)
  }

  const boxPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }
  }

  const startBlackBox = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    e.preventDefault()
    const p = boxPoint(e)
    boxStart.current = p
    const draft = { x: p.x, y: p.y, w: 0, h: 0 }
    boxDraftRef.current = draft
    setBoxDraft(draft)
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }

  const moveBlackBox = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!boxStart.current) return
    const p = boxPoint(e)
    const s0 = boxStart.current
    const draft = { x: Math.min(s0.x, p.x), y: Math.min(s0.y, p.y), w: Math.abs(p.x - s0.x), h: Math.abs(p.y - s0.y) }
    boxDraftRef.current = draft
    setBoxDraft(draft)
  }

  const endBlackBox = () => {
    const draft = boxDraftRef.current
    boxStart.current = null
    boxDraftRef.current = null
    setBoxDraft(null)
    if (draft && draft.w > 0.008 && draft.h > 0.008 && active) {
      setPages((prev) => prev.map((p) => (p.id === active.id ? { ...p, blackBoxes: [...p.blackBoxes, draft] } : p)))
      setBlackSelectMode(false)
      toast('已框选黑笔区域', '点击「清除框内黑笔」执行；框内印刷内容也会被清除。', 'info')
    }
  }

  const applyBlackErase = () => {
    if (!active) return
    if (!active.blackBoxes.length) return toast('还没有框选区域', '先框选要清除的黑色字迹。', 'info')
    setCompare(false)
    void reprocess(active)
  }

  const clearBlackBoxes = () => {
    if (!active) return
    const updated = { ...active, blackBoxes: [] }
    setPages((prev) => prev.map((p) => (p.id === active.id ? updated : p)))
    setBlackSelectMode(false)
    toast('已清空黑笔框选', '处理结果会在下一次重算时恢复。', 'info')
    void reprocess(updated)
  }

  const isScannerTop = () => {
    const top = [...useSystem.getState().windows].filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
    return top?.id === winId
  }

  const pasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('unsupported')
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        const data = await fileToDataUrl(new File([blob], `剪贴板-${Date.now()}.png`, { type }))
        await addFromDataUrlRef.current?.(data, `剪贴板-${new Date().toLocaleTimeString('zh-CN', { hour12: false })}.png`, true)
        toast('已粘贴剪贴板图片', '可以继续拖动四点进行裁剪。', 'success')
        return
      }
      toast('剪贴板里没有图片', '先截图或复制图片，再按 Ctrl/⌘+V。', 'info')
    } catch {
      toast('无法直接读取剪贴板', '点击扫描师窗口后按 Ctrl/⌘+V 粘贴截图。', 'info')
    }
  }

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData || !isScannerTop()) return
      const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      e.preventDefault()
      const data = await fileToDataUrl(file)
      await addFromDataUrlRef.current?.(data, file.name || `剪贴板-${new Date().toLocaleTimeString('zh-CN', { hour12: false })}.png`, true)
      toast('已从剪贴板添加图片', 'Ctrl/⌘+V 可直接粘贴更多截图。', 'success')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winId, toast])

  const chooseFilter = (filter: FilterId) => {
    if (!active) return
    setPages((prev) => prev.map((p) => (p.id === active.id ? { ...p, filter } : p)))
    reprocess(active, { filter })
    setCompare(false)
  }

  const rotate = async () => {
    if (!active) return
    setBusy(true)
    const data = await rotateDataUrl(active.original)
    const size = await imageSize(data)
    const updated = { ...active, original: data, corners: FULL_CORNERS, width: size.width, height: size.height, rotation: (active.rotation + 90) % 360, blackBoxes: [] }
    setPages((prev) => prev.map((p) => (p.id === active.id ? updated : p)))
    setBusy(false)
    reprocess(updated, { filter: updated.filter, corners: FULL_CORNERS })
  }

  const applyCrop = () => {
    if (!active) return
    setCropMode(false)
    reprocess(active, { filter: active.filter, corners: active.corners })
  }

  const autoDetect = async () => {
    if (!active) return
    setBusy(true)
    const corners = await autoCrop(active.original)
    setPages((prev) => prev.map((p) => (p.id === active.id ? { ...p, corners } : p)))
    setBusy(false)
  }

  const deletePage = (id: string) => {
    const rest = pages.filter((p) => p.id !== id)
    setPages(rest)
    if (activeId === id) setActiveId(rest[0]?.id ?? '')
    toast('已移除一页', undefined, 'info')
  }

  const changeMode = (m: Mode) => {
    setMode(m)
    setBlackSelectMode(false)
    if (!active) return
    const filter = MODE_FILTER[m]
    setCropMode(false)
    reprocess(active, { filter })
    setCompare(false)
  }

  const loadSample = async (m: Mode = mode) => {
    setBusy(true)
    try {
      if (m === 'exam') {
        await addFromDataUrl(await examSampleCanvas(), '数学随堂练习.png', false)
      } else if (m === 'idcard') {
        await addFromDataUrl(await idSampleCanvas(), '身份证-正面.png', true)
      } else {
        await addFromDataUrl(await documentSampleCanvas(), '合作协议.png', true)
      }
      setCropMode(false)
    } finally {
      setBusy(false)
    }
  }

  const buildPdf = async (useOriginal: boolean) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    for (let i = 0; i < pages.length; i++) {
      let src = pages[i].processed
      if (useOriginal) {
        const plain = await makeScan(pages[i].original, pages[i].corners, 'original', inkStrength, { mode: inkMode, preserve: true }, 3200, 0, 1)
        src = plain.dataUrl
      }
      if (mode === 'idcard' && watermark.trim()) src = await watermarkDataUrl(src, watermark.trim())
      const img = await loadImage(src)
      const pw = 210
      const ph = 297
      const margin = 12
      const maxW = pw - margin * 2
      const maxH = ph - margin * 2
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio
      if (i > 0) doc.addPage()
      doc.addImage(src, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST')
    }
    const name = `扫描件-${new Date().toISOString().slice(0, 10)}${useOriginal ? '-原图' : ''}.pdf`
    return { blob: doc.output('blob'), name }
  }

  const exportPdf = async (saveToDrive: boolean, useOriginal = false) => {
    if (!pages.length) return
    setPdfBusy(true)
    try {
      const { blob, name } = await buildPdf(useOriginal)
      if (saveToDrive) {
        const saved = await ecosystem.saveFile({ name, mime: 'application/pdf', blob, folderName: '扫描件', sourceApp: 'scanner', tags: useOriginal ? ['扫描', '原图'] : ['扫描'] })
        let extra = ''
        if (!useOriginal && keepOriginal) {
          const original = await buildPdf(true)
          await ecosystem.saveFile({ name: original.name, mime: 'application/pdf', blob: original.blob, folderName: '扫描件', sourceApp: 'scanner', tags: ['扫描', '原图'] })
          extra = ' · 原图已同时归档'
        }
        toast('已保存到云巢', `${saved.name} · ${pages.length} 页${extra}`, 'success')
        useSystem.getState().notify({ appId: 'scanner', title: '扫描件已保存', body: `${saved.name} 已写入云巢「扫描件」${extra}。`, action: { appId: 'drive', params: { folderId: 'folder-scans' } } })
      } else {
        downloadBlob(blob, name)
        toast('PDF 已导出', `${name} · ${pages.length} 页`, 'success')
      }
    } catch (e) {
      toast('导出失败', e instanceof Error ? e.message : 'PDF 生成失败', 'error')
    } finally {
      setPdfBusy(false)
    }
  }

  const sharePage = () => {
    if (!active) return
    ecosystem.share({ title: active.name.replace(/\.[^.]+$/, '') + '-扫描件.jpg', image: active.processed, text: `${active.name} · 由扫描师处理`, sourceApp: 'scanner' })
  }

  const filterInfo = FILTERS.find((f) => f.id === active?.filter)

  return (
    <div
      className={cn('scanner', panelOpen && 'panel-open', dragging && 'dragging')}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleImports(e.dataTransfer.files) }}
    >
      <aside className="scan-rail">
        <button className="scan-tool primary" onClick={() => setCameraOpen(true)} title="拍照扫描"><Camera size={19} /></button>
        <button className="scan-tool" onClick={() => fileInput.current?.click()} title="导入图片"><ImageIcon size={18} /></button>
        <button className="scan-tool" onClick={() => setPickerOpen(true)} title="从云巢导入"><Upload size={18} /></button>
        <button className="scan-tool" onClick={pasteFromClipboard} title="粘贴截图（Ctrl/⌘+V）"><ClipboardPaste size={18} /></button>
        <div className="scan-rail-sep" />
        <button className={cn('scan-tool', cropMode && 'active')} onClick={() => { if (active) { setCropMode((v) => !v); setBlackSelectMode(false) } }} title="裁剪 / 透视校正"><Crop size={18} /></button>
        <button className="scan-tool" onClick={rotate} disabled={!active} title="旋转"><RotateCw size={18} /></button>
        <button className={cn('scan-tool', active?.hd && 'active')} onClick={toggleHd} disabled={!active} title="智能高清 2×"><Zap size={18} /></button>
        <button className={cn('scan-tool', blackSelectMode && 'active')} onClick={toggleBlackSelect} disabled={!active} title="框选黑笔清除"><Eraser size={18} /></button>
        <button className="scan-tool" onClick={() => setOcrOpen(true)} disabled={!active} title="OCR 文字识别"><FileScan size={18} /></button>
        <div className="scan-rail-sep" />
        <button className="scan-tool" onClick={() => exportPdf(false)} disabled={!pages.length || pdfBusy} title="导出 PDF"><Download size={18} /></button>
        <button className="scan-tool" onClick={() => exportPdf(true)} disabled={!pages.length || pdfBusy} title="保存到云巢"><Check size={18} /></button>
        <button className="scan-tool" onClick={sharePage} disabled={!active} title="分享"><Share2 size={18} /></button>
      </aside>

      <main className="scan-main">
        <header className="scan-head">
          <div className="scan-title"><span className="scan-title-icon"><ScanLine size={17} /></span><div><strong>扫描师</strong><span>LENS SCANNER · v0.1</span></div></div>
          <div className="segmented scan-modes">
            {MODES.map((m) => <button key={m.id} className={mode === m.id ? 'active' : ''} onClick={() => changeMode(m.id)}><m.icon size={12} />{m.label}</button>)}
          </div>
          <div className="scan-head-actions">
            <button className="btn sm" onClick={() => setOcrOpen(true)} disabled={!active}><FileScan size={13} /> OCR</button>
            <button className={cn('btn sm scan-black-head', blackSelectMode && 'primary')} onClick={toggleBlackSelect} disabled={!active} title="框选黑笔清除"><Eraser size={13} /> 黑笔</button>
            <button className={cn('btn sm scan-hd-head', active?.hd && 'primary')} onClick={toggleHd} disabled={!active} title="本地 2× 智能高清"><Zap size={13} /> {active?.hd ? 'HD' : '高清'}</button>
            <button className="btn primary sm" onClick={() => exportPdf(true)} disabled={!pages.length || pdfBusy}>{pdfBusy ? <Loader2 size={13} className="spin" /> : <Check size={13} />} 保存到云巢</button>
            <button className="icon-btn scan-mobile-panel" onClick={() => setPanelOpen((v) => !v)} aria-label="处理面板"><SlidersHorizontal size={17} /></button>
          </div>
        </header>

        <div className="scan-work">
          {!active ? (
            <ScanEmpty mode={mode} onCamera={() => setCameraOpen(true)} onImport={() => fileInput.current?.click()} onPaste={pasteFromClipboard} onSample={() => loadSample(mode)} onFiles={() => setPickerOpen(true)} />
          ) : (
            <>
              <div className="scan-view-bar">
                <div><strong>{active.name}</strong><span>{active.width} × {active.height}{active.whiteBg ? ' · 白底' : ''}{active.hd ? ' · HD 2×' : ''} · {mode === 'exam' ? '试卷模式' : mode === 'idcard' ? '证件模式' : '文档模式'}</span></div>
                <div className="scan-zoom">
                  <button className={cn('btn sm scan-compare-btn', compare && 'primary')} onClick={() => { setCompare((v) => !v); setBlackSelectMode(false) }} title="对比未处理原图">{compare ? <EyeOff size={13} /> : <Eye size={13} />} {compare ? '处理结果' : '原图'}</button>
                  <button className="icon-btn sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}><Minus size={13} /></button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button className="icon-btn sm" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}><Plus size={13} /></button>
                  <button className="icon-btn sm" onClick={() => setZoom(1)} title="适应窗口"><Maximize2 size={13} /></button>
                </div>
              </div>
              <div className="scan-viewport">
                {cropMode ? (
                  <CropView page={active} zoom={zoom} onChange={(corners) => setPages((prev) => prev.map((p) => (p.id === active.id ? { ...p, corners } : p)))} />
                ) : compare ? (
                  <div className="scan-page-view" style={{ transform: `scale(${zoom})` }}>
                    <img src={active.original} alt={`${active.name} 原图`} />
                    <span className="scan-watermark-badge compare">原图 · 未处理（再次点击「处理结果」返回）</span>
                  </div>
                ) : (
                  <div className="scan-page-view" style={{ transform: `scale(${zoom})` }}>
                    <img src={active.processed} alt={active.name} />
                    <div
                      className={cn('scan-black-layer', blackSelectMode && 'selecting')}
                      onPointerDown={startBlackBox}
                      onPointerMove={moveBlackBox}
                      onPointerUp={endBlackBox}
                      onPointerCancel={endBlackBox}
                    >
                      {active.blackBoxes.map((box, i) => (
                        <div key={i} className="scan-black-rect" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }} />
                      ))}
                      {boxDraft && <div className="scan-black-rect draft" style={{ left: `${boxDraft.x * 100}%`, top: `${boxDraft.y * 100}%`, width: `${boxDraft.w * 100}%`, height: `${boxDraft.h * 100}%` }} />}
                    </div>
                    {blackSelectMode && <span className="scan-watermark-badge black-select-badge"><Eraser size={10} /> 拖动框选黑色字迹</span>}
                    {active.whiteBg && <span className="scan-watermark-badge white-badge">扫描白底</span>}
                    {active.hd && <span className="scan-watermark-badge hd-badge"><Zap size={10} /> HD 2×</span>}
                    {mode === 'exam' && active.filter === 'removeInk' && <span className="scan-watermark-badge">去手写 · 彩色笔迹已清除</span>}
                  </div>
                )}
                {busy && <div className="scan-busy"><span className="spinner" /><span>正在处理像素…</span></div>}
              </div>
              {cropMode && (
                <div className="scan-crop-bar">
                  <span className="chip accent"><Crop size={11} /> 已自动识别页面边界 · 拖动四角微调</span>
                  <button className="btn sm" onClick={autoDetect}>重新识别</button>
                  <button className="btn sm" onClick={() => setPages((prev) => prev.map((p) => (p.id === active.id ? { ...p, corners: FULL_CORNERS } : p)))}>重置</button>
                  <span className="grow" />
                  <button className="btn sm" onClick={() => setCropMode(false)}>取消</button>
                  <button className="btn primary sm" onClick={applyCrop}><Check size={12} /> 应用透视</button>
                </div>
              )}
            </>
          )}
        </div>
        <footer className="scan-foot">
          <span><span className="dot pulse" /> 本地处理 · 支持 Ctrl/⌘+V 粘贴截图</span>
          <span>{mode === 'exam' ? '去手写对红/蓝笔迹最有效；黑色笔迹与印刷体重叠，无法保证完全分离。' : mode === 'idcard' ? '证件模式会在导出时加上自定义水印。' : '支持 JPG / PNG / SVG / HEIC（由浏览器解码）。'}</span>
          <span>{pages.length} 页</span>
        </footer>
      </main>

      <div className="scan-panel-backdrop" onClick={() => setPanelOpen(false)} />
      <aside className="scan-panel">
        <div className="scan-panel-head"><span className="section-title">处理</span><span className="chip">{filterInfo?.label}</span><button className="icon-btn sm scan-panel-close" onClick={() => setPanelOpen(false)}><X size={14} /></button></div>
        <div className="scan-filter-grid">
          {FILTERS.map((f) => (
            <button key={f.id} className={cn('scan-filter', active?.filter === f.id && 'active')} onClick={() => chooseFilter(f.id)} disabled={!active}>
              <FilterPreview id={f.id} />
              <strong>{f.label}</strong>
              <small>{f.note}</small>
            </button>
          ))}
        </div>

        {mode === 'exam' && (
          <div className="scan-slider-box">
            <div className="scan-slider-label"><span>去手写强度</span><strong>{inkStrength}%</strong></div>
            <input
              type="range" min={20} max={100} value={inkStrength}
              onChange={(e) => setInkStrength(Number(e.target.value))}
              onPointerUp={(e) => active && reprocess(active, { filter: 'removeInk', strength: Number(e.currentTarget.value) })}
              style={{ '--progress': `${inkStrength}%` } as React.CSSProperties}
            />
            <div className="segmented scan-inkmode">
              <button className={inkMode === 'redblue' ? 'active' : ''} onClick={() => changeInkMode('redblue')}>红/蓝笔迹</button>
              <button className={inkMode === 'all' ? 'active' : ''} onClick={() => changeInkMode('all')}>所有彩色</button>
            </div>
            <button className={cn('scan-preserve', preserveInk && 'on')} onClick={togglePreserveInk}>
              <span className={cn('switch', preserveInk && 'on')} />
              <span><strong>仅去除笔迹</strong><small>{preserveInk ? '其他像素保持原样' : '同时轻提纸面亮度'}</small></span>
            </button>
            <p className="hint">默认只处理红/蓝笔迹附近像素；原图始终保留，可点「原图」对比。</p>
          </div>
        )}

        {mode === 'idcard' && (
          <div className="scan-slider-box">
            <label className="label">证件水印</label>
            <div className="field"><UserRound size={13} /><input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="仅供办理业务使用" /></div>
            <p className="hint">导出 PDF 时斜向叠加，避免证件被挪用。</p>
          </div>
        )}

        <div className="scan-slider-box scan-sharp-box">
          <div className="scan-slider-label"><span>锐化</span><strong>{sharpen}%</strong></div>
          <input
            type="range" min={0} max={100} value={sharpen} disabled={!active}
            onChange={(e) => changeSharpen(Number(e.target.value))}
            onPointerUp={(e) => active && reprocess(active, { sharpen: Number(e.currentTarget.value) })}
            style={{ '--progress': `${sharpen}%` } as React.CSSProperties}
          />
          <button className={cn('btn sm scan-hd-btn', active?.hd && 'primary')} onClick={toggleHd} disabled={!active}>
            <Zap size={12} /> {active?.hd ? '智能高清已开启' : '智能高清 · 白底 2×'}
          </button>
          <button className={cn('scan-white-row', active?.whiteBg && 'on')} onClick={toggleWhiteBg} disabled={!active}>
            <span className={cn('switch', active?.whiteBg && 'on')} />
            <span><strong>扫描级白底</strong><small>{active?.whiteBg ? '背景已漂白至扫描效果' : '只漂白背景，不放大'}</small></span>
          </button>
          <p className="hint">白底会按局部纸张光照做归一化；原图始终保留。智能高清同时开启白底 + 2× + 锐化。</p>
        </div>

        <div className="scan-slider-box scan-black-box">
          <div className="scan-slider-label"><span>黑笔清除</span><strong>{active?.blackBoxes.length ?? 0} 区域</strong></div>
          <p className="hint">黑色手写与印刷同色，无法自动区分。请只框选手写区域；框内印刷也会被清除，可清除框选后恢复。</p>
          <div className="row gap-4" style={{ marginTop: 5 }}>
            <button className={cn('btn sm', blackSelectMode && 'primary')} onClick={toggleBlackSelect} disabled={!active}>
              <Eraser size={12} /> {blackSelectMode ? '完成' : '框选'}
            </button>
            <button className="btn sm grow scan-black-run" onClick={applyBlackErase} disabled={!active?.blackBoxes.length || busy}>
              清除框内
            </button>
            <button className="btn sm" onClick={clearBlackBoxes} disabled={!active?.blackBoxes.length} title="清空框选并恢复处理"><Trash2 size={12} /></button>
          </div>
        </div>

        <div className="scan-pages-head"><span className="section-title">页面</span><button className="icon-btn sm" onClick={() => fileInput.current?.click()}><Plus size={14} /></button></div>
        <div className="scan-pages scroll-y">
          {pages.map((p, i) => (
            <div key={p.id} className={cn('scan-thumb', p.id === active?.id && 'active')} onClick={() => { setActiveId(p.id); setCropMode(false); setCompare(false); setBlackSelectMode(false) }}>
              <img src={p.processed} alt="" />
              <span className="scan-thumb-index">{i + 1}</span>
              {p.hd && <span className="scan-thumb-hd">HD</span>}
              <button className="scan-thumb-del" onClick={(e) => { e.stopPropagation(); deletePage(p.id) }}><X size={10} /></button>
            </div>
          ))}
          {pages.length === 0 && <div className="scan-pages-empty">还没有页面</div>}
        </div>

        <div className="scan-export">
          <button className="btn primary" onClick={() => exportPdf(true)} disabled={!pages.length || pdfBusy}><Check size={14} /> 保存 PDF 到云巢</button>
          <button className={cn('scan-keep-original', keepOriginal && 'on')} onClick={() => setKeepOriginal((v) => !v)}>
            <span className={cn('switch', keepOriginal && 'on')} />
            <span><strong>同时归档原图</strong><small>处理只改副本，原图仍可找回</small></span>
          </button>
          <div className="row gap-6">
            <button className="btn sm grow" onClick={() => exportPdf(false)} disabled={!pages.length || pdfBusy}><Download size={13} /> 导出 PDF</button>
            <button className="btn sm grow" onClick={sharePage} disabled={!active}><Share2 size={13} /> 分享</button>
          </div>
          <button className="btn sm" onClick={() => exportPdf(false, true)} disabled={!pages.length || pdfBusy}><Download size={13} /> 导出原图 PDF（不处理）</button>
          <button className="btn sm" onClick={() => active && ecosystem.askAI({ prompt: `请帮我把这份扫描件的要点整理成结构化笔记。文件：${active.name}`, origin: 'scanner', autoSend: true })} disabled={!active}><Sparkles size={13} /> 用 AI 整理扫描件</button>
        </div>
      </aside>

      {dragging && <div className="scan-drop"><Upload size={26} /><strong>松开以导入图片</strong><span>支持截图、照片与云巢 SVG</span></div>}
      {cameraOpen && <CameraModal mode={mode} onClose={() => setCameraOpen(false)} onCapture={async (data) => { setCameraOpen(false); await addFromDataUrl(data, `扫描-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}.jpg`, true) }} onImport={() => { setCameraOpen(false); fileInput.current?.click() }} />}
      {ocrOpen && active && <OcrModal page={active} onClose={() => setOcrOpen(false)} />}
      {pickerOpen && <CloudPicker onClose={() => setPickerOpen(false)} onPick={async (id) => { setPickerOpen(false); await loadFromFile(id) }} />}
      <input ref={fileInput} type="file" accept="image/*,.svg" multiple hidden onChange={(e) => handleImports(e.target.files)} />
    </div>
  )
}

function ScanEmpty({ mode, onCamera, onImport, onPaste, onSample, onFiles }: { mode: Mode; onCamera: () => void; onImport: () => void; onPaste: () => void; onSample: () => void; onFiles: () => void }) {
  return (
    <div className="scan-empty">
      <div className="scan-empty-art">
        <div className="scan-paper p1" /><div className="scan-paper p2" /><div className="scan-paper p3">
          <span className="scan-line l1" /><span className="scan-line l2" /><span className="scan-line l3" /><span className="scan-line l4" />
          <span className="scan-red-mark">✓</span>
          <span className="scan-scanline" />
        </div>
        <span className="scan-corner c1" /><span className="scan-corner c2" /><span className="scan-corner c3" /><span className="scan-corner c4" />
      </div>
      <span className="sheet-eyebrow">LENS SCANNER</span>
      <h2>{mode === 'exam' ? '把写满答案的试卷，还原成一张干净的卷子。' : mode === 'idcard' ? '证件扫描，自动裁边、加水印、双面归档。' : '把纸上的世界，变成可编辑的数字文件。'}</h2>
      <p>四点透视裁剪 · 魔法白增强 · 试卷去手写 · 锐化 · 智能高清 2× · OCR · PDF 导出。所有处理都在你的浏览器里完成。</p>
      <div className="scan-empty-actions">
        <button className="btn primary lg" onClick={onCamera}><Camera size={16} /> 拍照扫描</button>
        <button className="btn lg" onClick={onImport}><Upload size={16} /> 导入图片</button>
        <button className="btn lg" onClick={onPaste}><ClipboardPaste size={16} /> 粘贴截图</button>
        <button className="btn lg" onClick={onSample}><Sparkles size={16} /> 载入示例</button>
      </div>
      <div className="scan-empty-modes">
        {MODES.map((m) => <div key={m.id} className={cn(m.id === mode && 'active')}><m.icon size={15} /><span><strong>{m.label}</strong><small>{m.note}</small></span></div>)}
      </div>
      <button className="scan-cloud-link" onClick={onFiles}><FileText size={12} /> 或从云巢选择一张图片</button>
      <span className="scan-clip-hint">支持 Ctrl/⌘+V 直接粘贴截图 · 拖拽图片到窗口也可以</span>
    </div>
  )
}

function CropView({ page, zoom, onChange }: { page: Page; zoom: number; onChange: (corners: Corner[]) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const corners = page.corners

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current === null || !wrap.current) return
      const r = wrap.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
      const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
      const next = corners.map((c, i) => (i === drag.current ? [x, y] as Corner : c))
      onChange(next)
    }
    const up = () => { drag.current = null }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [corners, onChange])

  const pts = corners.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')
  return (
    <div className="scan-crop-wrap" style={{ transform: `scale(${zoom})` }}>
      <div className="scan-crop" ref={wrap} style={{ aspectRatio: `${page.width}/${page.height}` }}>
        <img src={page.original} alt="待裁剪" draggable={false} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={pts} className="crop-poly" />
          <polygon points={pts} className="crop-poly-line" />
        </svg>
        {corners.map(([x, y], i) => (
          <button key={i} className="crop-handle" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} onPointerDown={(e) => { e.preventDefault(); drag.current = i }} aria-label={`裁剪点 ${i + 1}`}>
            <span />
          </button>
        ))}
      </div>
    </div>
  )
}

function FilterPreview({ id }: { id: FilterId }) {
  return (
    <span className={cn('filter-preview', `fp-${id}`)}>
      <i className="fp-line" /><i className="fp-line" /><i className="fp-line" />
      {id === 'removeInk' && <b className="fp-ink">红</b>}
      {id === 'bw' && <em />}
    </span>
  )
}

function CameraModal({ mode, onClose, onCapture, onImport }: { mode: Mode; onClose: () => void; onCapture: (data: string) => void; onImport: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let active = true
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch((e) => setError(e?.name === 'NotAllowedError' ? '相机权限被拒绝，请在浏览器地址栏中允许访问。' : '没有找到可用的相机。'))
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [facing])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    if (facing === 'user') {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    setFlash(true)
    setTimeout(() => setFlash(false), 180)
    onCapture(c.toDataURL('image/jpeg', 0.94))
  }

  return (
    <div className="scan-camera-back">
      <div className="scan-camera">
        <header><div><span className="sheet-eyebrow">CAMERA</span><h3>{mode === 'exam' ? '拍摄试卷' : mode === 'idcard' ? '拍摄证件' : '拍摄文档'}</h3></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></header>
        <div className={cn('camera-stage', mode)}>
          {error ? (
            <div className="camera-error"><Camera size={30} /><strong>相机不可用</strong><p>{error}</p><button className="btn primary sm" onClick={onImport}><Upload size={13} /> 改为导入图片</button></div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className={facing === 'user' ? 'mirror' : ''} />
              <div className={cn('camera-guide', mode)}>
                <span className="g1" /><span className="g2" /><span className="g3" /><span className="g4" />
                <div className="camera-scanline" />
              </div>
              <div className="camera-tip">{mode === 'idcard' ? '将证件放入框内，保持水平' : mode === 'exam' ? '让整张试卷充满取景框' : '保持纸面平整，避免反光'}</div>
              {flash && <div className="camera-flash" />}
            </>
          )}
        </div>
        <footer className="camera-controls">
          <button className="icon-btn" onClick={onImport} title="导入图片"><ImageIcon size={19} /></button>
          <button className="camera-shutter" onClick={capture} disabled={!ready || Boolean(error)}><span /></button>
          <button className="icon-btn" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} title="切换摄像头"><RotateCw size={19} /></button>
        </footer>
        <p className="camera-note">相机画面仅在本机处理。桌面浏览器需要 HTTPS 或 localhost 才能访问相机。</p>
      </div>
    </div>
  )
}

function OcrModal({ page, onClose }: { page: Page; onClose: () => void }) {
  const toast = useSystem((s) => s.toast)
  const [status, setStatus] = useState<'idle' | 'loading' | 'working' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const workerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null)

  useEffect(() => () => { workerRef.current?.terminate().catch(() => {}) }, [])

  const run = async () => {
    setStatus('loading')
    setProgress(0.02)
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('chi_sim+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') { setStatus('working'); setProgress(m.progress) }
        },
      })
      workerRef.current = worker
      setStatus('working')
      const result = await worker.recognize(page.processed)
      setText(result.data.text.trim())
      setStatus('done')
      await worker.terminate()
      workerRef.current = null
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'OCR 引擎加载失败')
    }
  }

  const save = async () => {
    const name = `OCR-${page.name.replace(/\.[^.]+$/, '')}.md`
    await ecosystem.saveText({ name, text: `# OCR 识别结果\n\n> 来源：${page.name}\n\n${text}`, mime: 'text/markdown', folderName: '扫描件', sourceApp: 'scanner', tags: ['OCR', '扫描'] })
    toast('识别结果已保存', name, 'success')
    onClose()
  }

  return (
    <div className="scan-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scan-ocr-modal">
        <header><div><span className="sheet-eyebrow">OPTICAL CHARACTER RECOGNITION</span><h3>OCR 文字识别</h3></div><button className="icon-btn" onClick={onClose}><X size={17} /></button></header>
        <div className="ocr-source"><img src={page.processed} alt="" /><div><strong>{page.name}</strong><span>本地识别 · 中英文混合 · Tesseract.js</span></div></div>
        {status === 'idle' && <div className="ocr-idle"><FileScan size={26} /><strong>准备识别这一页</strong><p>首次运行会从 CDN 下载中英文语言包（约 10–15 MB）。图片不会离开本机，仅语言包来自网络。</p><button className="btn primary" onClick={run}><FileScan size={14} /> 开始识别</button></div>}
        {(status === 'loading' || status === 'working') && <div className="ocr-progress"><span className="spinner" /><strong>{status === 'loading' ? '正在加载识别引擎…' : '正在识别文字…'}</strong><div className="ocr-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div><span>{Math.round(progress * 100)}%</span></div>}
        {status === 'error' && <div className="ocr-idle error"><strong>识别失败</strong><p>{error}</p><p className="hint">如果网络无法访问 CDN，可把语言包部署到本地，或在控制台配置 AI 视觉模型。</p><button className="btn sm" onClick={run}>重试</button></div>}
        {status === 'done' && (
          <>
            <textarea className="textarea ocr-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} />
            <div className="row gap-6"><span className="hint">{text.length} 字符 · 可编辑后再保存</span><span className="grow" /><button className="btn sm" onClick={async () => { await copyText(text); toast('已复制文本', undefined, 'success') }}><Copy size={12} /> 复制</button><button className="btn primary sm" onClick={save}><Check size={12} /> 保存为 Markdown</button></div>
          </>
        )}
      </div>
    </div>
  )
}

function CloudPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const files = useSystem((s) => s.files)
  const images = files.filter((f) => f.kind === 'file' && !f.trashed && (f.mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|svg)$/i.test(f.name)))
  return (
    <div className="scan-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scan-picker">
        <header><div><span className="sheet-eyebrow">FROM NEST DRIVE</span><h3>从云巢导入</h3></div><button className="icon-btn" onClick={onClose}><X size={17} /></button></header>
        <div className="scan-picker-grid scroll-y">
          {images.map((f) => (
            <button key={f.id} onClick={() => onPick(f.id)}>
              <span className="scan-picker-thumb" style={f.thumb ? { backgroundImage: `url(${f.thumb})` } : undefined}>{!f.thumb && <ImageIcon size={20} />}</span>
              <strong>{f.name}</strong><small>{f.mime}</small>
            </button>
          ))}
          {images.length === 0 && <div className="empty-state"><ImageIcon size={24} /><strong>云巢里还没有图片</strong></div>}
        </div>
      </div>
    </div>
  )
}

async function watermarkDataUrl(src: string, text: string): Promise<string> {
  const img = await loadImage(src)
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const size = Math.max(22, Math.round(c.width / 24))
  ctx.save()
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate(-Math.PI / 7)
  ctx.font = `600 ${size}px "Noto Sans SC", system-ui, sans-serif`
  ctx.fillStyle = 'rgba(30, 64, 175, 0.22)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const step = Math.round(size * 5.2)
  for (let y = -c.height; y < c.height; y += step) {
    ctx.fillText(text, 0, y)
  }
  ctx.restore()
  return c.toDataURL('image/jpeg', 0.9)
}

async function ensureCjkFont() {
  try {
    await document.fonts.load('700 32px "Noto Sans SC Variable"', '星环扫描师试卷协议')
    await document.fonts.ready
  } catch {
    /* fall back to system font */
  }
}

const CJK = '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif'

async function examSampleCanvas(): Promise<string> {
  await ensureCjkFont()
  const c = document.createElement('canvas')
  c.width = 850
  c.height = 1120
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fffdf7'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = '#e7e0d2'
  ctx.lineWidth = 1
  ctx.strokeRect(30, 30, c.width - 60, c.height - 60)
  ctx.fillStyle = '#15161a'
  ctx.textAlign = 'center'
  ctx.font = `700 34px ${CJK}`
  ctx.fillText('数学 · 随堂练习', 425, 96)
  ctx.textAlign = 'left'
  ctx.font = `16px ${CJK}`
  ctx.fillStyle = '#3b3b3f'
  ctx.fillText('姓名：纪辰　　班级：高二（3）班　　得分：______', 92, 142)
  ctx.strokeStyle = '#c9c3b6'
  ctx.beginPath(); ctx.moveTo(90, 170); ctx.lineTo(760, 170); ctx.stroke()
  const questions = [
    ['1. 已知函数 f(x)=x²-4x+3，求其顶点坐标与最小值。', '顶点 (2,-1)，最小值 -1'],
    ['2. 解方程 2x + 5 = 17。', 'x = 6'],
    ['3. 在直角三角形 ABC 中，∠C=90°，AC=3，BC=4，求 AB。', 'AB = 5'],
  ]
  questions.forEach(([q, a], i) => {
    const y = 300 + i * 170
    ctx.fillStyle = '#1b1b1b'
    ctx.font = `19px ${CJK}`
    ctx.fillText(q, 92, y)
    ctx.fillStyle = '#c22b3f'
    ctx.font = `italic 22px ${CJK}`
    ctx.fillText(a, 120, y + 50)
    ctx.strokeStyle = '#d8d2c6'
    ctx.beginPath(); ctx.moveTo(90, y + 72); ctx.lineTo(760, y + 72); ctx.stroke()
  })
  ctx.fillStyle = '#c22b3f'
  ctx.font = `italic 26px ${CJK}`
  ctx.save()
  ctx.translate(610, 700)
  ctx.rotate(-0.12)
  ctx.fillText('✓ 这题再检查一次', 0, 0)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8d877c'
  ctx.font = `14px ${CJK}`
  ctx.fillText('红笔为订正笔迹，扫描时请去除', 425, 1060)
  return c.toDataURL('image/jpeg', 0.95)
}

async function documentSampleCanvas(): Promise<string> {
  await ensureCjkFont()
  const c = document.createElement('canvas')
  c.width = 900
  c.height = 1240
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fbf8f0'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = '#d6cfc0'
  ctx.strokeRect(42, 42, 816, 1156)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#172033'
  ctx.font = `700 32px ${CJK}`
  ctx.fillText('生态合作协议', 450, 118)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#5b6172'
  ctx.font = `14px ${CJK}`
  ctx.fillText('甲方：星环科技有限公司　　乙方：晨光设计工作室', 90, 170)
  ctx.strokeStyle = '#bbb3a5'
  ctx.beginPath(); ctx.moveTo(90, 198); ctx.lineTo(810, 198); ctx.stroke()
  ctx.fillStyle = '#232a3a'
  ctx.font = `16px ${CJK}`
  const sections = [
    ['第一条　合作内容', '双方就星环生态的品牌视觉、产品界面与线下物料展开合作。'],
    ['第二条　交付与验收', '乙方按里程碑交付设计稿，甲方在五个工作日内完成验收。'],
    ['第三条　知识产权', '最终交付物的著作权归甲方所有，乙方保留署名权。'],
    ['第四条　费用与支付', '项目总费用为人民币 80,000 元，分三期支付。'],
  ]
  sections.forEach(([h, body], i) => {
    const y = 250 + i * 76
    ctx.fillStyle = '#232a3a'
    ctx.font = `600 16px ${CJK}`
    ctx.fillText(h, 90, y)
    ctx.fillStyle = '#384052'
    ctx.font = `15px ${CJK}`
    ctx.fillText(body, 90, y + 34)
  })
  ctx.save()
  ctx.translate(450, 590)
  ctx.rotate(-0.08)
  ctx.fillStyle = '#1c4ed8'
  ctx.font = `italic 27px ${CJK}`
  ctx.fillText('已阅，同意按此版本推进。', 20, 0)
  ctx.font = `italic 24px ${CJK}`
  ctx.fillText('纪辰  11/05', 210, 46)
  ctx.restore()
  ctx.fillStyle = '#697080'
  ctx.font = `14px ${CJK}`
  ctx.fillText('甲方（盖章）：', 90, 1010)
  ctx.fillText('乙方（盖章）：', 510, 1010)
  ctx.strokeStyle = '#aaa'
  ctx.beginPath(); ctx.moveTo(90, 1080); ctx.lineTo(360, 1080); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(510, 1080); ctx.lineTo(780, 1080); ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#999'
  ctx.font = `12px ${CJK}`
  ctx.fillText('第 1 页 共 1 页', 450, 1170)
  return c.toDataURL('image/jpeg', 0.95)
}

async function idSampleCanvas(): Promise<string> {
  await ensureCjkFont()
  const c = document.createElement('canvas')
  c.width = 1012
  c.height = 638
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 1012, 638)
  g.addColorStop(0, '#eef5ff')
  g.addColorStop(1, '#dfeaff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'rgba(207,224,255,.55)'
  ctx.beginPath(); ctx.arc(810, 130, 170, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#244a8a'
  ctx.font = `600 26px ${CJK}`
  ctx.fillText('中华人民共和国', 70, 95)
  ctx.fillStyle = '#1b3f7a'
  ctx.font = `800 38px ${CJK}`
  ctx.fillText('居民身份证', 70, 145)
  ctx.fillStyle = '#dbe7fb'
  ctx.strokeStyle = '#a9c1e8'
  ctx.beginPath(); ctx.roundRect(68, 180, 270, 350, 10); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#b9ccec'
  ctx.beginPath(); ctx.arc(203, 290, 62, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(203, 445, 90, 85, 0, Math.PI, 0); ctx.fill()
  ctx.fillStyle = '#1d2939'
  ctx.font = `27px ${CJK}`
  const lines = ['姓名　纪辰', '性别　男　　民族　汉', '出生　1996 年 08 月 18 日', '住址　浙江省杭州市西湖区', '　　　星环路 88 号']
  lines.forEach((line, i) => ctx.fillText(line, 390, 235 + i * 57))
  ctx.font = `600 31px ${CJK}`
  ctx.fillText('公民身份号码', 390, 530)
  ctx.font = `29px ${CJK}`
  ctx.fillText('330106199608180019', 390, 580)
  return c.toDataURL('image/jpeg', 0.95)
}
