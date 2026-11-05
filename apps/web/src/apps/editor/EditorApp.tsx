import {
  Braces,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  Eye,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Search,
  Sparkles,
  SplitSquareHorizontal,
  X,
} from 'lucide-react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { putBlob } from '../../core/db'
import { useSystem } from '../../core/store'
import type { DriveFile } from '../../core/types'
import { cn, downloadText, nowIso, relativeTime, sanitizeFilename } from '../../core/utils'
import { CodeEditor } from './CodeEditor'

const TEXT_RE = /\.(md|markdown|txt|json|ts|tsx|js|jsx|mjs|css|html|htm|py|yml|yaml|sql|sh|xml)$/i

export default function EditorApp({ params }: AppProps) {
  const files = useSystem((s) => s.files)
  const addFile = useSystem((s) => s.addFile)
  const updateFile = useSystem((s) => s.updateFile)
  const toast = useSystem((s) => s.toast)
  const [tabs, setTabs] = useState<string[]>([])
  const [activeId, setActiveId] = useState('')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [sidebar, setSidebar] = useState(true)
  const [treeQuery, setTreeQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['folder-stellar', 'folder-code', 'folder-docs']))
  const [preview, setPreview] = useState<'none' | 'split' | 'only'>('none')
  const [newFile, setNewFile] = useState(false)
  const [position, setPosition] = useState({ line: 1, col: 1 })
  const [saving, setSaving] = useState(false)
  const loadedParams = useRef('')

  const textFiles = useMemo(() => files.filter((f) => f.kind === 'file' && !f.trashed && (TEXT_RE.test(f.name) || f.mime.startsWith('text/'))), [files])
  const active = files.find((f) => f.id === activeId)
  const activeContent = contents[activeId] ?? ''
  const isMarkdown = Boolean(active && /\.(md|markdown)$/i.test(active.name))
  const isHtml = Boolean(active && /\.(html|htm)$/i.test(active.name))

  useEffect(() => {
    if (params.fileId && params.fileId !== loadedParams.current) {
      loadedParams.current = String(params.fileId)
      openFile(String(params.fileId))
    } else if (!tabs.length && textFiles.length) {
      openFile(textFiles.find((f) => f.id === 'file-readme')?.id ?? textFiles[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.fileId, textFiles.length])

  useEffect(() => {
    const handler = () => save()
    window.addEventListener('stellar:save', handler)
    return () => window.removeEventListener('stellar:save', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeContent])

  const openFile = async (id: string) => {
    const file = files.find((f) => f.id === id)
    if (!file) return
    setTabs((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveId(id)
    setPreview('none')
    if (contents[id] === undefined) {
      const text = await ecosystem.getFileText(file)
      setContents((prev) => ({ ...prev, [id]: text }))
    }
  }

  const closeTab = (id: string) => {
    if (dirty[id]) {
      toast('有新修改未保存', '请先按 ⌘S 保存，再关闭这个标签。', 'error')
      return
    }
    const next = tabs.filter((t) => t !== id)
    setTabs(next)
    if (activeId === id) setActiveId(next[next.length - 1] ?? '')
    setContents((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const change = (value: string) => {
    setContents((prev) => ({ ...prev, [activeId]: value }))
    setDirty((prev) => ({ ...prev, [activeId]: true }))
  }

  const save = async () => {
    if (!active || !dirty[active.id] || saving) return
    setSaving(true)
    try {
      let blobId = active.blobId
      if (blobId) blobId = await putBlob(new Blob([activeContent], { type: active.mime || 'text/plain' }))
      updateFile(active.id, { text: activeContent, size: activeContent.length, blobId, updatedAt: nowIso() })
      setDirty((prev) => ({ ...prev, [active.id]: false }))
      toast('已保存', `${active.name} · ${activeContent.length} 字符`, 'success')
    } catch (e) {
      toast('保存失败', e instanceof Error ? e.message : '无法写入本地存储', 'error')
    } finally {
      setSaving(false)
    }
  }

  const createFile = async (name: string, folderId: string) => {
    if (!name.trim()) return
    const safe = sanitizeFilename(name.trim())
    const ext = safe.split('.').pop()?.toLowerCase() ?? 'txt'
    const mime = ext === 'md' ? 'text/markdown' : ext === 'html' ? 'text/html' : ext === 'css' ? 'text/css' : ext === 'json' ? 'application/json' : 'text/plain'
    const file = addFile({ name: safe, kind: 'file', parentId: folderId || null, mime, size: 0, text: '', sourceApp: 'editor' })
    setNewFile(false)
    setTabs((prev) => [...prev, file.id])
    setActiveId(file.id)
    setContents((prev) => ({ ...prev, [file.id]: '' }))
    setDirty((prev) => ({ ...prev, [file.id]: true }))
    toast('已创建文件', file.name, 'success')
  }

  const askAI = (mode: 'review' | 'explain' | 'comment') => {
    if (!active) return
    const prompt = mode === 'review' ? `请审阅文件「${active.name}」，指出问题并给出改进建议。` : mode === 'explain' ? `请解释文件「${active.name}」的结构和关键逻辑。` : `给文件「${active.name}」补充必要的中文注释与文档字符串。`
    ecosystem.askAI({ prompt, context: `${active.name}\n\n${activeContent.slice(0, 14000)}`, origin: 'editor', autoSend: true })
  }

  const sourcePanel = (
    <div className="editor-source">
      {isMarkdown ? <div className="markdown" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(activeContent) as string) }} /> : isHtml ? <iframe title="preview" srcDoc={activeContent} sandbox="allow-scripts" /> : <pre>{activeContent}</pre>}
    </div>
  )

  return (
    <div className={cn('editor', !sidebar && 'sidebar-closed')}>
      {sidebar && (
        <aside className="editor-side">
          <header><span className="section-title">工作区</span><button className="icon-btn sm" onClick={() => setSidebar(false)}><PanelLeftClose size={14} /></button></header>
          <div className="field editor-search"><Search size={13} /><input value={treeQuery} onChange={(e) => setTreeQuery(e.target.value)} placeholder="搜索文件" /></div>
          <div className="editor-tree scroll-y">
            {treeQuery.trim() ? (
              textFiles.filter((f) => f.name.toLowerCase().includes(treeQuery.toLowerCase())).map((f) => <TreeFile key={f.id} file={f} active={f.id === activeId} onOpen={openFile} depth={0} />)
            ) : (
              <>
                {textFiles.filter((f) => f.parentId === null).map((f) => <TreeFile key={f.id} file={f} active={f.id === activeId} onOpen={openFile} depth={0} />)}
                {files.filter((f) => f.kind === 'folder' && !f.trashed && f.parentId === null).map((folder) => (
                  <TreeNode key={folder.id} folder={folder} files={files} textFiles={textFiles} activeId={activeId} expanded={expanded} setExpanded={setExpanded} onOpen={openFile} depth={0} />
                ))}
              </>
            )}
            {textFiles.length === 0 && <div className="empty-state"><FileCode2 size={20} /><strong>没有可编辑文件</strong></div>}
          </div>
          <button className="editor-new" onClick={() => setNewFile(true)}><FilePlus2 size={14} /> 新建文件</button>
          <div className="editor-side-foot"><span className="dot" /> 文件来自云巢 · 自动本机保存</div>
        </aside>
      )}
      <main className="editor-main">
        <div className="editor-tabs">
          {!sidebar && <button className="icon-btn sm" onClick={() => setSidebar(true)}><PanelLeftOpen size={14} /></button>}
          <div className="editor-tab-scroll">
            {tabs.map((id) => {
              const f = files.find((x) => x.id === id)
              if (!f) return null
              return (
                <button key={id} className={cn('editor-tab', id === activeId && 'active')} onClick={() => { setActiveId(id); setPreview('none') }}>
                  <FileTypeIcon name={f.name} />
                  <span>{f.name}</span>
                  {dirty[id] ? <span className="dirty-dot" /> : <span className="tab-x" onClick={(e) => { e.stopPropagation(); closeTab(id) }}><X size={11} /></span>}
                </button>
              )
            })}
          </div>
          <button className="icon-btn sm" onClick={() => setNewFile(true)}><FilePlus2 size={14} /></button>
        </div>

        {active ? (
          <>
            <div className="editor-toolbar">
              <div className="editor-crumb"><Code2 size={13} /><span>{active.name}</span><span className="faint">·</span><span className="faint">{[...new Set(textFiles.map((f) => files.find((x) => x.id === f.parentId)?.name).filter(Boolean))].length} 个目录</span></div>
              <div className="editor-actions">
                <button className="btn sm" onClick={save} disabled={!dirty[active.id]}>{saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Save size={12} />} 保存</button>
                {(isMarkdown || isHtml) && <button className={cn('btn sm', preview !== 'none' && 'primary')} onClick={() => setPreview((p) => p === 'none' ? 'split' : p === 'split' ? 'only' : 'none')}><SplitSquareHorizontal size={12} /> 预览</button>}
                <button className="btn sm" onClick={() => askAI('review')}><Sparkles size={12} /> AI 审阅</button>
                <button className="icon-btn sm" onClick={() => downloadText(activeContent, active.name)} title="下载"><Download size={14} /></button>
              </div>
            </div>
            <div className={cn('editor-workspace', preview !== 'none' && 'previewing', preview === 'only' && 'preview-only')}>
              <div className="editor-pane" style={{ display: preview === 'only' ? 'none' : undefined }}>
                <CodeEditor key={active.id} value={activeContent} filename={active.name} onChange={change} onStats={(line, col) => setPosition({ line, col })} />
              </div>
              {preview !== 'none' && sourcePanel}
            </div>
            <footer className="editor-status">
              <span><span className={cn('dot', dirty[active.id] ? 'off' : '')} /> {dirty[active.id] ? '未保存' : '已保存'}</span>
              <span>Ln {position.line}, Col {position.col}</span>
              <span>UTF-8</span>
              <span>{active.name.split('.').pop()?.toUpperCase() ?? 'TXT'}</span>
              <span className="grow" />
              <span>{activeContent.length} 字符</span>
              <span>{active.blobId ? '云巢 Blob' : '云巢文本'}</span>
              <span>{relativeTime(active.updatedAt)}</span>
            </footer>
          </>
        ) : (
          <div className="empty-state"><Braces size={28} /><strong>打开一个文件开始编辑</strong><p>从左侧工作区选择文件，或新建一个。</p><button className="btn primary sm" onClick={() => setNewFile(true)}><FilePlus2 size={13} /> 新建文件</button></div>
        )}
      </main>
      {newFile && <NewFileModal files={files} onClose={() => setNewFile(false)} onCreate={createFile} />}
    </div>
  )
}

function TreeNode({ folder, files, textFiles, activeId, expanded, setExpanded, onOpen, depth }: { folder: DriveFile; files: DriveFile[]; textFiles: DriveFile[]; activeId: string; expanded: Set<string>; setExpanded: (s: Set<string>) => void; onOpen: (id: string) => void; depth: number }) {
  const children = files.filter((f) => f.parentId === folder.id && !f.trashed)
  const childFolders = children.filter((f) => f.kind === 'folder')
  const childFiles = children.filter((f) => f.kind === 'file' && textFiles.some((t) => t.id === f.id))
  if (childFiles.length === 0 && childFolders.every((c) => !hasText(c.id, files, textFiles))) return null
  const isOpen = expanded.has(folder.id)
  const toggle = () => {
    const next = new Set(expanded)
    isOpen ? next.delete(folder.id) : next.add(folder.id)
    setExpanded(next)
  }
  return (
    <div className="tree-node">
      <button className="tree-folder" style={{ paddingLeft: 7 + depth * 13 }} onClick={toggle}>
        {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {isOpen ? <FolderOpen size={13} /> : <Folder size={13} />}
        <span>{folder.name}</span>
        <small>{childFiles.length}</small>
      </button>
      {isOpen && (
        <>
          {childFolders.map((f) => <TreeNode key={f.id} folder={f} files={files} textFiles={textFiles} activeId={activeId} expanded={expanded} setExpanded={setExpanded} onOpen={onOpen} depth={depth + 1} />)}
          {childFiles.map((f) => <TreeFile key={f.id} file={f} active={f.id === activeId} onOpen={onOpen} depth={depth + 1} />)}
        </>
      )}
    </div>
  )
}

function hasText(folderId: string, files: DriveFile[], textFiles: DriveFile[]): boolean {
  const direct = files.some((f) => f.parentId === folderId && textFiles.some((t) => t.id === f.id))
  if (direct) return true
  return files.filter((f) => f.parentId === folderId && f.kind === 'folder').some((f) => hasText(f.id, files, textFiles))
}

function TreeFile({ file, active, onOpen, depth }: { file: DriveFile; active: boolean; onOpen: (id: string) => void; depth: number }) {
  return (
    <button className={cn('tree-file', active && 'active')} style={{ paddingLeft: 12 + depth * 13 }} onClick={() => onOpen(file.id)}>
      <FileTypeIcon name={file.name} />
      <span>{file.name}</span>
    </button>
  )
}

function FileTypeIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'md' || ext === 'markdown') return <span className="ft md">M↓</span>
  if (ext === 'ts' || ext === 'tsx') return <span className="ft ts">TS</span>
  if (ext === 'js' || ext === 'jsx') return <span className="ft js">JS</span>
  if (ext === 'html') return <span className="ft html">&lt;&gt;</span>
  if (ext === 'css') return <span className="ft css">#</span>
  if (ext === 'json') return <span className="ft json">{'{}'}</span>
  if (ext === 'py') return <span className="ft py">Py</span>
  return <FileCode2 size={12} className="faint" />
}

function NewFileModal({ files, onClose, onCreate }: { files: DriveFile[]; onClose: () => void; onCreate: (name: string, folderId: string) => void }) {
  const [name, setName] = useState('untitled.md')
  const [folderId, setFolderId] = useState('folder-code')
  const folders = files.filter((f) => f.kind === 'folder' && !f.trashed)
  return (
    <div className="editor-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="editor-modal">
        <header><div><span className="sheet-eyebrow">NEW FILE</span><h3>新建文本 / 代码文件</h3></div><button className="icon-btn" onClick={onClose}><X size={16} /></button></header>
        <label className="label">文件名</label>
        <div className="field"><FilePlus2 size={14} /><input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onCreate(name, folderId)} /></div>
        <label className="label">保存到</label>
        <select className="editor-select" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
          <option value="">云巢根目录</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <p className="hint">支持 Markdown、TypeScript、JavaScript、Python、HTML、CSS、JSON 等。</p>
        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}><button className="btn sm" onClick={onClose}>取消</button><button className="btn primary sm" onClick={() => onCreate(name, folderId)} disabled={!name.trim()}>创建并打开</button></div>
      </div>
    </div>
  )
}
