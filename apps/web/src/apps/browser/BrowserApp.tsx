import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Globe2,
  Home,
  Lock,
  Plus,
  RotateCw,
  Search,
  Share2,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppProps } from '../../components/AppRenderer'
import { ecosystem } from '../../core/ecosystem'
import { useSystem } from '../../core/store'
import type { BrowserTab } from '../../core/types'
import { cn, uid } from '../../core/utils'

const BLOCKED = ['google.com', 'youtube.com', 'bilibili.com', 'zhihu.com', 'weibo.com', 'weixin.qq.com', 'taobao.com', 'jd.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com']
const QUICK_LINKS = [
  { title: 'Example', url: 'https://example.com', hue: 200, note: '最简 HTML 页面' },
  { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org/export/embed.html?bbox=120.10,30.20,120.25,30.32&layer=mapnik', hue: 140, note: '可嵌入地图' },
  { title: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/', hue: 210, note: 'Web 技术文档' },
  { title: '维基百科', url: 'https://zh.wikipedia.org/', hue: 150, note: '自由的百科全书' },
  { title: 'GitHub', url: 'https://github.com/', hue: 260, note: '开源代码托管' },
  { title: 'Internet Archive', url: 'https://archive.org/', hue: 30, note: '数字图书馆' },
]

export default function BrowserApp({ params }: AppProps) {
  const tabs = useSystem((s) => s.browserTabs)
  const bookmarks = useSystem((s) => s.bookmarks)
  const updateTab = useSystem((s) => s.updateBrowserTab)
  const addTab = useSystem((s) => s.addBrowserTab)
  const closeTab = useSystem((s) => s.closeBrowserTab)
  const addBookmark = useSystem((s) => s.addBookmark)
  const removeBookmark = useSystem((s) => s.removeBookmark)
  const toast = useSystem((s) => s.toast)
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '')
  const [address, setAddress] = useState('stellar://start')
  const [reloadKey, setReloadKey] = useState(0)
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [allowBlocked, setAllowBlocked] = useState(false)
  const addressRef = useRef<HTMLInputElement>(null)
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]
  const url = active?.url ?? 'stellar://start'
  const isStart = url === 'stellar://start'
  const bookmarked = bookmarks.some((b) => b.url === url)
  const host = useMemo(() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '起始页' } }, [url])

  useEffect(() => {
    if (!active && tabs.length) setActiveId(tabs[0].id)
  }, [active, tabs])

  useEffect(() => {
    if (params.url) {
      const target = String(params.url)
      if (active) navigate(target, active.id)
      else {
        const id = addTab(target)
        setActiveId(id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.url])

  useEffect(() => {
    if (active) setAddress(active.url === 'stellar://start' ? '' : active.url)
  }, [active?.id, active?.url])

  const isBlockedHost = (u: string) => {
    try { const h = new URL(u).hostname; return BLOCKED.some((b) => h === b || h.endsWith(`.${b}`)) } catch { return false }
  }

  const normalize = (input: string) => {
    const v = input.trim()
    if (!v) return 'stellar://start'
    if (v.startsWith('stellar://')) return v
    if (/^https?:\/\//i.test(v)) return v
    if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(v)) return `https://${v}`
    return `https://www.bing.com/search?q=${encodeURIComponent(v)}`
  }

  const navigate = (input: string, tabId = activeId) => {
    const next = normalize(input)
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    const history = [...tab.history.slice(0, tab.index + 1), next]
    updateTab(tabId, { url: next, title: titleFor(next), history, index: history.length - 1 })
    setBlocked(isBlockedHost(next) ? next : null)
    setAllowBlocked(false)
    setLoading(next !== 'stellar://start')
  }

  const back = () => {
    if (!active || active.index <= 0) return
    const index = active.index - 1
    const target = active.history[index]
    updateTab(active.id, { index, url: target, title: titleFor(target) })
    setBlocked(isBlockedHost(target) ? target : null)
    setAllowBlocked(false)
  }
  const forward = () => {
    if (!active || active.index >= active.history.length - 1) return
    const index = active.index + 1
    const target = active.history[index]
    updateTab(active.id, { index, url: target, title: titleFor(target) })
    setBlocked(isBlockedHost(target) ? target : null)
    setAllowBlocked(false)
  }
  const reload = () => { setReloadKey((k) => k + 1); setLoading(!isStart) }

  const newTab = () => {
    const id = addTab('stellar://start')
    setActiveId(id)
    setTimeout(() => addressRef.current?.focus(), 30)
  }

  const toggleBookmark = () => {
    if (isStart) return
    if (bookmarked) {
      const b = bookmarks.find((x) => x.url === url)
      if (b) removeBookmark(b.id)
      toast('已取消书签', host, 'info')
    } else {
      addBookmark({ title: active?.title || host, url, hue: 190 })
      toast('已加入书签', active?.title || host, 'success')
    }
  }

  const askAI = () => {
    ecosystem.askAI({
      prompt: `请总结这个网页的主旨，并列出 3 个关键要点：${url}`,
      context: `网页地址：${url}\n标题：${active?.title ?? host}\n\n注意：受浏览器同源策略限制，AI 无法自动读取跨域网页正文。请在回答中说明这一点，并给出基于 URL 与标题的合理推测；或者提示用户粘贴正文。`,
      origin: 'browser',
      autoSend: true,
    })
  }

  return (
    <div className="browser">
      <div className="browser-tabs">
        <div className="browser-tab-scroll">
          {tabs.map((t) => (
            <button key={t.id} className={cn('browser-tab', t.id === active?.id && 'active')} onClick={() => { setActiveId(t.id); setBlocked(isBlockedHost(t.url) ? t.url : null); setAllowBlocked(false) }}>
              <Globe2 size={11} />
              <span>{t.title || titleFor(t.url)}</span>
              <span className="browser-tab-close" onClick={(e) => { e.stopPropagation(); if (tabs.length > 1) { const idx = tabs.findIndex((x) => x.id === t.id); closeTab(t.id); if (activeId === t.id) setActiveId(tabs[idx - 1]?.id ?? tabs[idx + 1]?.id ?? '') } else closeTab(t.id) }}><X size={10} /></span>
            </button>
          ))}
        </div>
        <button className="browser-newtab" onClick={newTab}><Plus size={14} /></button>
      </div>

      <div className="browser-bar">
        <div className="browser-nav">
          <button className="icon-btn sm" onClick={back} disabled={!active || active.index <= 0}><ArrowLeft size={15} /></button>
          <button className="icon-btn sm" onClick={forward} disabled={!active || active.index >= active.history.length - 1}><ArrowRight size={15} /></button>
          <button className="icon-btn sm" onClick={reload}><RotateCw size={13} /></button>
          <button className="icon-btn sm" onClick={() => navigate('stellar://start')}><Home size={14} /></button>
        </div>
        <div className="browser-address">
          <span className="browser-lock">{isStart ? <Sparkles size={12} /> : <Lock size={11} />}</span>
          <input
            ref={addressRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => { if (e.key === 'Enter') { navigate(address); addressRef.current?.blur() } }}
            placeholder="输入网址或搜索…"
            spellCheck={false}
          />
          {address && <button className="icon-btn sm" onClick={() => setAddress('')}><X size={11} /></button>}
        </div>
        <div className="browser-actions">
          <button className={cn('icon-btn sm', bookmarked && 'active')} onClick={toggleBookmark} title="书签">{bookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}</button>
          <button className="icon-btn sm" onClick={askAI} title="用 AI 总结"><Sparkles size={14} /></button>
          <button className="icon-btn sm" onClick={() => { if (!isStart) window.open(url, '_blank', 'noopener,noreferrer') }} title="在系统浏览器打开"><ExternalLink size={14} /></button>
        </div>
      </div>

      <div className="browser-content">
        {isStart ? (
          <BrowserStart onOpen={(u) => navigate(u)} onSearch={(q) => navigate(q)} bookmarks={bookmarks} onRemoveBookmark={removeBookmark} />
        ) : blocked && !allowBlocked ? (
          <div className="browser-embed-block">
            <div className="browser-block-orb"><Globe2 size={30} /></div>
            <span className="sheet-eyebrow">EMBEDDING RESTRICTED</span>
            <h2>{host} 通常禁止被嵌入</h2>
            <p>目标网站通过 <code>X-Frame-Options</code> 或 CSP 禁止在其他应用中显示。这是浏览器安全策略，不是星环的限制。桌面壳会使用原生 WebView 绕过这一限制。</p>
            <div className="row gap-6">
              <button className="btn primary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={14} /> 在系统浏览器打开</button>
              <button className="btn" onClick={() => setAllowBlocked(true)}>仍然尝试嵌入</button>
              <button className="btn" onClick={() => navigate('stellar://start')}><Home size={14} /> 回到起始页</button>
            </div>
          </div>
        ) : (
          <div className="browser-frame-wrap">
            {loading && <div className="browser-loading"><span className="spinner" /><span>正在加载 {host}…</span></div>}
            <iframe
              key={`${active?.id}-${url}-${reloadKey}`}
              src={url}
              title={active?.title ?? host}
              className="browser-frame"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={() => setLoading(false)}
              referrerPolicy="no-referrer"
            />
            <div className="browser-frame-note">
              <span><Lock size={10} /> {host}</span>
              <span>页面由第三方提供 · 星环不注入脚本</span>
              <button onClick={askAI}><Sparkles size={10} /> AI 摘要</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function titleFor(u: string) {
  if (u === 'stellar://start') return '起始页'
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u.slice(0, 30) }
}

function BrowserStart({ onOpen, onSearch, bookmarks, onRemoveBookmark }: { onOpen: (u: string) => void; onSearch: (q: string) => void; bookmarks: { id: string; title: string; url: string; hue: number }[]; onRemoveBookmark: (id: string) => void }) {
  const [q, setQ] = useState('')
  const submit = () => { if (q.trim()) onSearch(q.trim()) }
  return (
    <div className="browser-start scroll-y">
      <div className="browser-start-glow" />
      <div className="browser-start-head">
        <span className="browser-start-logo"><Globe2 size={24} /></span>
        <span className="sheet-eyebrow">DRIFT BROWSER · STELLAR</span>
        <h1>漫游</h1>
        <p>把网页带进生态。书签、标签与跨应用接力，都在同一个浏览器里。</p>
        <div className="browser-start-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="搜索网页，或输入网址…" autoFocus />
          <button onClick={submit}>前往</button>
        </div>
        <div className="browser-start-note"><Lock size={10} /> 默认不追踪、不注入脚本 · 受目标网站嵌入策略限制</div>
      </div>

      <div className="browser-quick-grid">
        {QUICK_LINKS.map((l) => (
          <button key={l.url} className="browser-quick" onClick={() => onOpen(l.url)}>
            <span className="browser-quick-icon" style={{ background: `linear-gradient(145deg, hsl(${l.hue} 70% 62%), hsl(${l.hue + 35} 65% 40%))` }}>{l.title.slice(0, 1)}</span>
            <span className="grow"><strong>{l.title}</strong><small>{l.note}</small></span>
            <ArrowRight size={12} className="faint" />
          </button>
        ))}
      </div>

      <div className="browser-start-section">
        <div className="section-title">我的书签</div>
        <div className="browser-bookmarks">
          {bookmarks.map((b) => (
            <div key={b.id} className="browser-bookmark">
              <button className="browser-bookmark-main" onClick={() => onOpen(b.url)}>
                <span className="browser-bookmark-icon" style={{ background: `linear-gradient(145deg, hsl(${b.hue} 65% 60%), hsl(${b.hue + 30} 60% 38%))` }}>{b.title.slice(0, 1)}</span>
                <span><strong>{b.title}</strong><small>{b.url === 'stellar://start' ? '星环内部页面' : b.url}</small></span>
              </button>
              {b.url !== 'stellar://start' && <button className="browser-bookmark-del" onClick={() => onRemoveBookmark(b.id)}><X size={10} /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="browser-start-section">
        <div className="section-title">从生态继续</div>
        <div className="browser-eco-links">
          <button onClick={() => ecosystem.open('scanner', { mode: 'document' })}><ScanIcon /><span><strong>扫描一份文档</strong><small>扫描师 · 透视与增强</small></span></button>
          <button onClick={() => ecosystem.open('ai')}><Sparkles size={15} /><span><strong>问智核</strong><small>多模型 AI 工作台</small></span></button>
          <button onClick={() => ecosystem.open('drive')}><Globe2 size={15} /><span><strong>打开云巢</strong><small>网页与文件放在一起</small></span></button>
          <button onClick={() => ecosystem.open('meeting')}><Share2 size={15} /><span><strong>发起会议</strong><small>共享这个页面</small></span></button>
        </div>
      </div>
      <div className="browser-start-foot">星环内置浏览器 · 桌面壳使用原生 WebView，Web 端使用 iframe</div>
    </div>
  )
}

function ScanIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></svg>
}
