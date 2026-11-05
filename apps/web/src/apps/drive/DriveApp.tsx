import DOMPurify from 'dompurify'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Cloud,
  Download,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileMusic,
  FileText,
  Film,
  Folder,
  FolderPlus,
  Grid2x2,
  HardDrive,
  List,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { useBlobUrl } from '../../core/hooks'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import type { DriveFile } from '../../core/types'
import { estimateUsage } from '../../core/db'
import { cn, downloadBlob, fileKindLabel, formatBytes, isAudioMime, isImageMime, isVideoMime, makeThumbnail, relativeTime, sanitizeFilename } from '../../core/utils'

type Scope = 'folder' | 'recent' | 'starred' | 'trash'

const SORTS = [
  { id: 'updated', label: '最近修改' },
  { id: 'name', label: '名称' },
  { id: 'size', label: '大小' },
] as const

export default function DriveApp({ params, winId }: AppProps) {
  const files = useSystem((s) => s.files)
  const addFile = useSystem((s) => s.addFile)
  const updateFile = useSystem((s) => s.updateFile)
  const trashFile = useSystem((s) => s.trashFile)
  const restoreFile = useSystem((s) => s.restoreFile)
  const deleteForever = useSystem((s) => s.deleteFileForever)
  const toast = useSystem((s) => s.toast)
  const setWindowParams = useSystem((s) => s.setWindowParams)
  const [scope, setScope] = useState<Scope>('folder')
  const [folderId, setFolderId] = useState<string | null>((params.folderId as string) ?? null)
  const [previewId, setPreviewId] = useState<string | null>((params.previewId as string) ?? null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState<(typeof SORTS)[number]['id']>('updated')
  const [selected, setSelected] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [newFolder, setNewFolder] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [storage, setStorage] = useState({ usage: 0, quota: 0 })
  const fileInput = useRef<HTMLInputElement>(null)
  const preview = previewId ? files.find((f) => f.id === previewId) ?? null : null

  useEffect(() => {
    if (params.folderId) {
      setFolderId(String(params.folderId))
      setScope('folder')
    }
    if (params.previewId) setPreviewId(String(params.previewId))
    if (params.trash) setScope('trash')
    if (params.starred) setScope('starred')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.folderId, params.previewId, params.trash, params.starred])

  useEffect(() => {
    estimateUsage().then(setStorage).catch(() => {})
  }, [files.length])

  useEffect(() => {
    if (!params.previewId && !params.folderId) return
    if (params.previewId) setSelected(String(params.previewId))
  }, [params.previewId, params.folderId])

  const folders = files.filter((f) => f.kind === 'folder' && !f.trashed)
  const rootFolders = folders.filter((f) => f.parentId === null)
  const currentFolder = folderId ? files.find((f) => f.id === folderId) : null

  const path = useMemo(() => {
    const chain: DriveFile[] = []
    let cur = currentFolder
    let guard = 0
    while (cur && guard++ < 20) {
      chain.unshift(cur)
      cur = files.find((f) => f.id === cur!.parentId) ?? null
    }
    return chain
  }, [currentFolder, files])

  const displayed = useMemo(() => {
    let list: DriveFile[]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = files.filter((f) => !f.trashed && (f.name.toLowerCase().includes(q) || f.tags?.some((t) => t.includes(q))))
    } else if (scope === 'trash') {
      list = files.filter((f) => f.trashed)
    } else if (scope === 'starred') {
      list = files.filter((f) => f.starred && !f.trashed)
    } else if (scope === 'recent') {
      list = files.filter((f) => f.kind === 'file' && !f.trashed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 24)
    } else {
      list = files.filter((f) => f.parentId === folderId && !f.trashed)
    }
    return [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      if (sort === 'name') return a.name.localeCompare(b.name, 'zh-CN')
      if (sort === 'size') return b.size - a.size
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [files, folderId, query, scope, sort])

  const used = useMemo(() => files.filter((f) => f.kind === 'file' && !f.trashed).reduce((n, f) => n + f.size, 0), [files])
  const totalFiles = files.filter((f) => f.kind === 'file' && !f.trashed).length
  const selectedFile = selected ? files.find((f) => f.id === selected) : null

  const openFolder = (id: string | null) => {
    setScope('folder')
    setFolderId(id)
    setQuery('')
    setSelected(null)
    setWindowParams(winId, { folderId: id, previewId: undefined })
  }

  const upload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setUploading(fileList.length)
    let count = 0
    for (const file of Array.from(fileList)) {
      try {
        const thumb = isImageMime(file.type) ? await makeThumbnail(file, 640).catch(() => undefined) : undefined
        await ecosystem.saveFile({
          name: sanitizeFilename(file.name),
          mime: file.type || 'application/octet-stream',
          blob: file,
          parentId: folderId,
          sourceApp: 'drive',
          thumb,
        })
        count++
      } catch (e) {
        toast('上传失败', `${file.name}：${e instanceof Error ? e.message : '未知错误'}`, 'error')
      } finally {
        setUploading((n) => Math.max(0, n - 1))
      }
    }
    if (count) {
      toast('已上传到云巢', `${count} 个文件 · ${currentFolder?.name ?? '根目录'}`, 'success')
      useSystem.getState().notify({ appId: 'drive', title: '云巢已同步', body: `${count} 个文件已保存到本地存储。` })
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const remove = (file: DriveFile) => {
    if (scope === 'trash') {
      deleteForever(file.id)
      toast('已永久删除', file.name, 'info')
    } else {
      trashFile(file.id)
      toast('已移到回收站', file.name, 'info')
    }
    setMenuId(null)
    if (previewId === file.id) setPreviewId(null)
  }

  const makeFolder = (name: string) => {
    if (!name.trim()) return
    const folder = addFile({ name: sanitizeFilename(name.trim()), kind: 'folder', parentId: folderId, mime: 'application/x-folder', size: 0, sourceApp: 'drive' })
    setNewFolder(false)
    toast('文件夹已创建', folder.name, 'success')
  }

  const download = async (file: DriveFile) => {
    const blob = await ecosystem.getFileBlob(file)
    if (!blob) return toast('无法下载', '文件内容不可用。', 'error')
    downloadBlob(blob, file.name)
  }

  const title = query ? '搜索结果' : scope === 'trash' ? '回收站' : scope === 'starred' ? '星标文件' : scope === 'recent' ? '最近使用' : currentFolder?.name ?? '全部文件'

  return (
    <div className="drive" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files) }}>
      <aside className="drive-side">
        <div className="drive-brand"><span className="drive-brand-icon"><Cloud size={17} /></span><div><strong>云巢</strong><span>NEST DRIVE</span></div></div>
        <button className="drive-new" onClick={() => fileInput.current?.click()}><Plus size={15} /> 上传文件</button>
        <nav className="drive-nav">
          <button className={cn(scope === 'folder' && !folderId && 'active')} onClick={() => openFolder(null)}><HardDrive size={15} /> 全部文件<span>{totalFiles}</span></button>
          <button className={cn(scope === 'recent' && 'active')} onClick={() => { setScope('recent'); setQuery(''); setSelected(null) }}><RotateCcw size={15} /> 最近使用</button>
          <button className={cn(scope === 'starred' && 'active')} onClick={() => { setScope('starred'); setQuery(''); setSelected(null) }}><Star size={15} /> 星标文件</button>
          <button className={cn(scope === 'trash' && 'active')} onClick={() => { setScope('trash'); setQuery(''); setSelected(null) }}><Trash2 size={15} /> 回收站</button>
        </nav>
        <div className="drive-side-section">
          <div className="drive-side-label"><span>文件夹</span><button onClick={() => setNewFolder(true)}><FolderPlus size={13} /></button></div>
          <div className="drive-folder-nav">
            {rootFolders.map((f) => (
              <button key={f.id} className={cn(folderId === f.id && 'active')} onClick={() => openFolder(f.id)}>
                <Folder size={14} /> <span>{f.name}</span>
                <small>{files.filter((x) => x.parentId === f.id && !x.trashed).length}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="drive-storage">
          <div className="drive-storage-top"><span><HardDrive size={12} /> 本地存储</span><strong>{formatBytes(used)}</strong></div>
          <div className="drive-meter"><i style={{ width: `${Math.min(100, (used / (storage.quota || 100 * 1024 * 1024 * 8)) * 100)}%` }} /></div>
          <span className="hint">浏览器配额 {storage.quota ? formatBytes(storage.quota) : '本地优先'} · 可导出</span>
        </div>
        <div className="drive-side-foot"><span className="dot pulse" /> 已同步到本设备</div>
      </aside>

      <main className="drive-main">
        <header className="drive-toolbar">
          <div className="drive-crumb">
            {scope === 'folder' && currentFolder && <button className="icon-btn sm" onClick={() => openFolder(path.length > 1 ? path[path.length - 2].id : null)}><ArrowLeft size={15} /></button>}
            <button onClick={() => openFolder(null)} className={!currentFolder ? 'current' : ''}>云巢</button>
            {path.map((p) => (
              <span key={p.id} className="drive-crumb-item"><ChevronRight size={11} /><button onClick={() => openFolder(p.id)} className={p.id === folderId ? 'current' : ''}>{p.name}</button></span>
            ))}
            {query && <span className="drive-crumb-item"><ChevronRight size={11} /><span className="current">搜索「{query}」</span></span>}
          </div>
          <div className="drive-tools">
            <div className="field drive-search"><Search size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索云巢" /></div>
            <select className="drive-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="排序">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <div className="segmented drive-view"><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><Grid2x2 size={13} /></button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={14} /></button></div>
            <button className="btn sm" onClick={() => setNewFolder(true)}><FolderPlus size={13} /> 新建</button>
            <button className="btn primary sm" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>{uploading > 0 ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Upload size={13} />}{uploading > 0 ? `${uploading} 个上传中` : '上传'}</button>
          </div>
        </header>

        <div className="drive-content-head">
          <div><h2>{title}</h2><span>{displayed.length} 项{scope === 'trash' ? ' · 永久删除前请确认' : ''}</span></div>
          <span className="chip"><Cloud size={11} /> 本地优先</span>
        </div>

        <div className={cn('drive-content scroll-y', view === 'grid' ? 'grid-view' : 'list-view')}>
          {displayed.length === 0 ? (
            <div className="drive-empty">
              <span className="drive-empty-orb"><Folder size={26} /></span>
              <strong>{query ? '没有找到匹配的文件' : scope === 'trash' ? '回收站是空的' : '这里还没有文件'}</strong>
              <p>{query ? '换个关键词，或者从其他应用把内容分享到云巢。' : '拖拽文件到这里，或点击右上角上传。'}</p>
              {!query && scope !== 'trash' && <button className="btn primary sm" onClick={() => fileInput.current?.click()}><Upload size={13} /> 上传第一个文件</button>}
            </div>
          ) : view === 'grid' ? (
            displayed.map((f) => (
              <div
                key={f.id}
                className={cn('drive-card', selected === f.id && 'selected')}
                onClick={() => {
                  if (f.kind === 'folder') openFolder(f.id)
                  else { setSelected(f.id); setPreviewId(f.id); if (scope === 'trash') setSelected(f.id) }
                }}
                onContextMenu={(e) => { e.preventDefault(); setMenuId(f.id) }}
              >
                <FileTile file={f} />
                <div className="drive-card-info">
                  <strong>{f.name}</strong>
                  <span>{f.kind === 'folder' ? `${files.filter((x) => x.parentId === f.id && !x.trashed).length} 项` : `${formatBytes(f.size)} · ${relativeTime(f.updatedAt)}`}</span>
                </div>
                {f.starred && <Star size={11} className="drive-star" fill="currentColor" />}
                <button className="drive-card-menu" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id) }}><MoreHorizontal size={14} /></button>
                {menuId === f.id && (
                  <div className="drive-menu" onClick={(e) => e.stopPropagation()}>
                    {f.kind === 'file' && <button onClick={() => { setMenuId(null); ecosystem.openFile(f.id) }}><ArrowUpRight size={13} /> 打开</button>}
                    {f.kind === 'file' && <button onClick={() => { setMenuId(null); ecosystem.share(ecosystem.makeShareFromFile(f)) }}><Share2 size={13} /> 分享</button>}
                    {f.kind === 'file' && <button onClick={() => { setMenuId(null); download(f) }}><Download size={13} /> 下载</button>}
                    <button onClick={() => { updateFile(f.id, { starred: !f.starred }); setMenuId(null) }}><Star size={13} /> {f.starred ? '取消星标' : '加星标'}</button>
                    {scope === 'trash' ? <button onClick={() => { restoreFile(f.id); setMenuId(null) }}><RotateCcw size={13} /> 恢复</button> : null}
                    <button className="danger" onClick={() => remove(f)}>{scope === 'trash' ? <X size={13} /> : <Trash2 size={13} />}{scope === 'trash' ? '永久删除' : '移到回收站'}</button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="drive-list">
              <div className="drive-list-head"><span /><span>名称</span><span>修改时间</span><span>大小</span><span /></div>
              {displayed.map((f) => (
                <div key={f.id} className={cn('drive-row', selected === f.id && 'selected')} onClick={() => { if (f.kind === 'folder') openFolder(f.id); else { setSelected(f.id); setPreviewId(f.id) } }} onContextMenu={(e) => { e.preventDefault(); setMenuId(f.id) }}>
                  <FileIcon file={f} size={30} />
                  <span className="drive-row-name"><strong>{f.name}</strong>{f.starred && <Star size={10} fill="currentColor" />}</span>
                  <span className="faint">{relativeTime(f.updatedAt)}</span>
                  <span className="faint">{f.kind === 'folder' ? '—' : formatBytes(f.size)}</span>
                  <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id) }}><MoreHorizontal size={14} /></button>
                  {menuId === f.id && (
                    <div className="drive-menu" onClick={(e) => e.stopPropagation()}>
                      {f.kind === 'file' && <button onClick={() => { setMenuId(null); ecosystem.openFile(f.id) }}><ArrowUpRight size={13} /> 打开</button>}
                      <button onClick={() => { setMenuId(null); ecosystem.share(ecosystem.makeShareFromFile(f)) }}><Share2 size={13} /> 分享</button>
                      <button className="danger" onClick={() => remove(f)}><Trash2 size={13} /> 移到回收站</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedFile && selectedFile.kind === 'file' && !preview && (
          <div className="drive-inspector">
            <button className="icon-btn sm" onClick={() => setSelected(null)}><X size={12} /></button>
            <FileIcon file={selectedFile} size={38} />
            <strong>{selectedFile.name}</strong>
            <span>{selectedFile.mime}</span>
            <div className="divider" />
            <div className="drive-meta-row"><span>大小</span><strong>{formatBytes(selectedFile.size)}</strong></div>
            <div className="drive-meta-row"><span>修改</span><strong>{relativeTime(selectedFile.updatedAt)}</strong></div>
            <div className="drive-meta-row"><span>来源</span><strong>{selectedFile.sourceApp ?? 'drive'}</strong></div>
            <button className="btn sm primary" onClick={() => setPreviewId(selectedFile.id)}>预览</button>
          </div>
        )}
      </main>

      {preview && <FilePreview file={preview} onClose={() => { setPreviewId(null); setWindowParams(winId, { previewId: undefined }) }} />}
      {newFolder && <NewFolderModal onClose={() => setNewFolder(false)} onCreate={makeFolder} />}
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
    </div>
  )
}

function FileTile({ file }: { file: DriveFile }) {
  if (file.kind === 'folder') {
    return <div className="file-tile folder-tile"><Folder size={30} fill="currentColor" /></div>
  }
  if (file.thumb) {
    return <div className="file-tile image-tile"><img src={file.thumb} alt="" /><span className="file-tile-badge">{fileKindLabel(file.name)}</span></div>
  }
  if (file.mime === 'image/svg+xml' && file.text) {
    return <div className="file-tile image-tile"><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.text)}`} alt="" /><span className="file-tile-badge">SVG</span></div>
  }
  return <div className={cn('file-tile', `tile-${tileColor(file)}`)}><FileIcon file={file} size={34} /><span className="file-tile-badge">{fileKindLabel(file.name)}</span></div>
}

function FileIcon({ file, size = 34 }: { file: DriveFile; size?: number }) {
  const s = Math.round(size * 0.5)
  if (file.kind === 'folder') return <span className="drive-ficon folder" style={{ width: size, height: size }}><Folder size={s} fill="currentColor" /></span>
  if (isImageMime(file.mime)) return <span className="drive-ficon image" style={{ width: size, height: size }}><FileImage size={s} /></span>
  if (isVideoMime(file.mime)) return <span className="drive-ficon video" style={{ width: size, height: size }}><Film size={s} /></span>
  if (isAudioMime(file.mime)) return <span className="drive-ficon audio" style={{ width: size, height: size }}><FileMusic size={s} /></span>
  if (file.mime.includes('pdf') || file.mime.includes('zip') || file.mime.includes('archive')) return <span className="drive-ficon archive" style={{ width: size, height: size }}><FileArchive size={s} /></span>
  if (file.mime.startsWith('text/') || /\.(ts|tsx|js|jsx|json|css|html|py|md)$/.test(file.name)) return <span className="drive-ficon code" style={{ width: size, height: size }}><FileCode2 size={s} /></span>
  return <span className="drive-ficon doc" style={{ width: size, height: size }}><FileText size={s} /></span>
}

function tileColor(file: DriveFile) {
  if (file.mime.includes('pdf')) return 'red'
  if (isVideoMime(file.mime)) return 'violet'
  if (isAudioMime(file.mime)) return 'green'
  if (file.mime.startsWith('text/')) return 'amber'
  return 'blue'
}

function FilePreview({ file, onClose }: { file: DriveFile; onClose: () => void }) {
  const { url } = useBlobUrl(file.blobId)
  const updateFile = useSystem((s) => s.updateFile)
  const trashFile = useSystem((s) => s.trashFile)
  const toast = useSystem((s) => s.toast)
  const [text, setText] = useState<string | null>(null)
  const imageUrl = file.text && file.mime === 'image/svg+xml' ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(file.text)}` : url ?? file.externalUrl ?? file.thumb
  const isText = file.mime.startsWith('text/') || /\.(md|txt|json|ts|tsx|js|jsx|css|html|py)$/.test(file.name)
  const isPdf = file.mime === 'application/pdf' || file.name.endsWith('.pdf')

  useEffect(() => {
    if (isText) ecosystem.getFileText(file).then(setText).catch(() => setText(''))
  }, [file.id, isText])

  const html = isText && text !== null && (file.name.endsWith('.md') || file.mime === 'text/markdown')
    ? DOMPurify.sanitize(marked.parse(text) as string)
    : ''

  return (
    <div className="drive-preview-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drive-preview">
        <header>
          <FileIcon file={file} size={32} />
          <div className="grow"><strong>{file.name}</strong><span>{file.mime} · {formatBytes(file.size)} · {relativeTime(file.updatedAt)}</span></div>
          <button className={`icon-btn ${file.starred ? 'active' : ''}`} onClick={() => updateFile(file.id, { starred: !file.starred })}><Star size={16} /></button>
          <button className="icon-btn" onClick={() => ecosystem.share(ecosystem.makeShareFromFile(file))}><Share2 size={16} /></button>
          <button className="icon-btn" onClick={async () => { const blob = await ecosystem.getFileBlob(file); if (blob) downloadBlob(blob, file.name) }}><Download size={16} /></button>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="drive-preview-body">
          {isPdf ? (
            <iframe title={file.name} src={url ?? undefined} className="preview-pdf" />
          ) : isImageMime(file.mime) ? (
            <div className="preview-image"><img src={imageUrl ?? ''} alt={file.name} /></div>
          ) : isVideoMime(file.mime) || isAudioMime(file.mime) ? (
            <div className="preview-media">
              <span className="preview-media-icon">{isVideoMime(file.mime) ? <Film size={40} /> : <FileMusic size={40} />}</span>
              <h3>{file.name}</h3>
              <p>在「声影」播放器中打开，享受播放列表与画面增强。</p>
              <button className="btn primary" onClick={() => { onClose(); ecosystem.openFile(file.id) }}><Film size={14} /> 用声影打开</button>
            </div>
          ) : isText ? (
            html ? <div className="preview-markdown markdown" dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="preview-text">{text ?? '正在读取…'}</pre>
          ) : (
            <div className="preview-media"><File size={40} /><h3>暂不支持预览</h3><p>可以把文件交给 AI 分析，或在代码工坊中以文本打开。</p></div>
          )}
        </div>
        <footer>
          <div className="drive-preview-meta"><span>创建 {relativeTime(file.createdAt)}</span><span>修改 {relativeTime(file.updatedAt)}</span><span>来源 {file.sourceApp ?? 'drive'}</span>{file.tags?.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
          <div className="row gap-6">
            {isText && <button className="btn sm" onClick={() => { onClose(); ecosystem.open('editor', { fileId: file.id }) }}><FileCode2 size={13} /> 在代码工坊打开</button>}
            <button className="btn sm" onClick={async () => { const t = isText ? await ecosystem.getFileText(file) : ''; ecosystem.askAI({ prompt: `请分析云巢文件「${file.name}」，概括内容并列出可执行事项。`, context: t.slice(0, 12000), origin: 'drive', autoSend: Boolean(t) }); onClose() }}><Sparkles size={13} /> 用 AI 分析</button>
            <button className="btn sm danger" onClick={() => { trashFile(file.id); toast('已移到回收站', file.name, 'info'); onClose() }}><Trash2 size={13} /> 删除</button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function NewFolderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="drive-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drive-modal">
        <header><div><span className="sheet-eyebrow">NEW FOLDER</span><h3>新建文件夹</h3></div><button className="icon-btn" onClick={onClose}><X size={16} /></button></header>
        <div className="field"><FolderPlus size={14} /><input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onCreate(name)} placeholder="文件夹名称" /></div>
        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={onClose}>取消</button><button className="btn primary sm" onClick={() => onCreate(name)} disabled={!name.trim()}>创建</button></div>
      </div>
    </div>
  )
}
