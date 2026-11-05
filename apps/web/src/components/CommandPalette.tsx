import { ArrowRight, Bot, Cloud, Command, CornerDownLeft, FileText, MessageSquare, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { APP_DEFINITIONS, APP_MAP } from '../core/registry'
import { useSystem } from '../core/store'
import type { AppId, SearchHit } from '../core/types'
import { relativeTime } from '../core/utils'
import { AppIcon } from './AppIcon'

const ACTIONS: SearchHit[] = [
  { id: 'a-scan', kind: 'action', title: '扫描一份文档', subtitle: '打开扫描师 · 文档模式', appId: 'scanner', params: { mode: 'document' } },
  { id: 'a-exam', kind: 'action', title: '试卷去手写', subtitle: '扫描师 · 试卷模式', appId: 'scanner', params: { mode: 'exam' } },
  { id: 'a-meet', kind: 'action', title: '发起会议', subtitle: '会客厅 · WebRTC 房间', appId: 'meeting', params: { create: true } },
  { id: 'a-ai', kind: 'action', title: '问智核一个问题', subtitle: '多模型 AI 工作台', appId: 'ai' },
  { id: 'a-note', kind: 'action', title: '新建手写笔记', subtitle: '墨记 · 压感画布', appId: 'notes' },
  { id: 'a-remote', kind: 'action', title: '远程协助一台设备', subtitle: '远界 · 共享屏幕', appId: 'remote' },
]

const KIND_LABEL: Record<SearchHit['kind'], string> = {
  action: '快捷操作',
  app: '应用',
  file: '云巢文件',
  chat: '星讯会话',
  note: '手写笔记',
  bookmark: '浏览器书签',
}

export function CommandPalette() {
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const openApp = useSystem((s) => s.openApp)
  const closeOverlay = useSystem((s) => s.closeOverlay)
  const files = useSystem((s) => s.files)
  const chats = useSystem((s) => s.chats)
  const notebooks = useSystem((s) => s.notebooks)
  const bookmarks = useSystem((s) => s.bookmarks)
  const openShare = useSystem((s) => s.openShare)
  const openOverlay = useSystem((s) => s.openOverlay)

  useEffect(() => {
    setIndex(0)
  }, [q])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    const appHits: SearchHit[] = APP_DEFINITIONS.map((a) => ({
      id: `app-${a.id}`,
      kind: 'app',
      title: a.name,
      subtitle: `${a.en} · ${a.tagline}`,
      appId: a.id,
    }))
    if (!query) {
      return [
        ...ACTIONS,
        ...appHits.filter((a) => ['im', 'drive', 'scanner', 'ai'].includes(a.appId!)),
        ...files.filter((f) => f.starred && !f.trashed).slice(0, 3).map(fileHit),
        ...chats.filter((c) => c.pinned).slice(0, 2).map(chatHit),
      ]
    }
    const hits: SearchHit[] = []
    for (const a of appHits) if ((a.title + a.subtitle).toLowerCase().includes(query)) hits.push(a)
    for (const a of ACTIONS) if ((a.title + a.subtitle).toLowerCase().includes(query)) hits.push(a)
    for (const f of files) {
      if (f.trashed) continue
      if (f.name.toLowerCase().includes(query) || f.tags?.some((t) => t.toLowerCase().includes(query)))
        hits.push(fileHit(f))
    }
    for (const c of chats) {
      if (c.name.toLowerCase().includes(query) || c.messages.some((m) => m.text?.toLowerCase().includes(query))) hits.push(chatHit(c))
    }
    for (const n of notebooks) if (n.title.toLowerCase().includes(query)) hits.push({ id: `note-${n.id}`, kind: 'note', title: n.title, subtitle: `${n.pages.length} 页 · 更新于 ${relativeTime(n.updatedAt)}`, appId: 'notes', params: { notebookId: n.id } })
    for (const b of bookmarks) if ((b.title + b.url).toLowerCase().includes(query)) hits.push({ id: `bm-${b.id}`, kind: 'bookmark', title: b.title, subtitle: b.url, appId: 'browser', params: { url: b.url } })
    return hits.slice(0, 30)
  }, [q, files, chats, notebooks, bookmarks])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const run = (hit: SearchHit) => {
    closeOverlay()
    if (hit.action) return hit.action()
    if (hit.appId) openApp(hit.appId, hit.params)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[index]) run(results[index])
    } else if (e.key === 'Escape') {
      closeOverlay()
    }
  }

  const grouped = results.reduce<Record<string, SearchHit[]>>((acc, r) => {
    ;(acc[r.kind] ??= []).push(r)
    return acc
  }, {})
  let flatIndex = -1

  return (
    <div className="overlay-backdrop palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className="palette" role="dialog" aria-modal>
        <div className="palette-input">
          <Search size={19} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索应用、文件、消息，或输入指令…"
            autoComplete="off"
          />
          <span className="palette-esc">ESC</span>
        </div>
        <div className="palette-results" ref={listRef}>
          {results.length === 0 && (
            <div className="palette-empty">
              <span className="empty-orb"><Search size={20} /></span>
              <strong>没有找到「{q}」</strong>
              <span>试试文件名、联系人、应用名，或者直接问小环。</span>
              <button className="btn sm" onClick={() => { closeOverlay(); openShare({ title: q, text: q, sourceApp: 'settings' }) }}>把问题交给 AI <ArrowRight size={12} /></button>
            </div>
          )}
          {Object.entries(grouped).map(([kind, hits]) => (
            <div className="palette-group" key={kind}>
              <div className="palette-group-label">{KIND_LABEL[kind as SearchHit['kind']]}</div>
              {hits.map((hit) => {
                flatIndex++
                const active = flatIndex === index
                return (
                  <button
                    key={hit.id}
                    data-index={flatIndex}
                    className={`palette-row ${active ? 'active' : ''}`}
                    onMouseEnter={() => setIndex(results.indexOf(hit))}
                    onClick={() => run(hit)}
                  >
                    <span className="palette-row-icon">
                      {hit.kind === 'app' && hit.appId ? <AppIcon id={hit.appId} size={30} /> : hit.kind === 'file' ? <Cloud size={17} /> : hit.kind === 'chat' ? <MessageSquare size={17} /> : hit.kind === 'note' ? <FileText size={17} /> : hit.kind === 'bookmark' ? <Search size={17} /> : <Sparkles size={17} />}
                    </span>
                    <span className="grow">
                      <strong>{hit.title}</strong>
                      {hit.subtitle && <small>{hit.subtitle}</small>}
                    </span>
                    {hit.kind === 'app' && <span className="palette-app-cat">{APP_MAP[hit.appId!].category}</span>}
                    {active && <CornerDownLeft size={14} className="faint" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="palette-foot">
          <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> 选择</span>
          <span><kbd className="kbd">↵</kbd> 打开</span>
          <span><kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd> 切换</span>
          <span className="grow" />
          <span className="palette-brand"><Bot size={12} /> 星环指令中心</span>
        </div>
      </div>
    </div>
  )
}

function fileHit(f: { id: string; name: string; mime: string; updatedAt: string }): SearchHit {
  return { id: `file-${f.id}`, kind: 'file', title: f.name, subtitle: `${f.mime} · ${relativeTime(f.updatedAt)}`, appId: 'drive', params: { previewId: f.id } }
}
function chatHit(c: { id: string; name: string; unread: number }): SearchHit {
  return { id: `chat-${c.id}`, kind: 'chat', title: c.name, subtitle: c.unread ? `${c.unread} 条未读消息` : '打开会话', appId: 'im', params: { chatId: c.id } }
}
