import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { APP_DEFINITIONS } from '../core/registry'
import { useSystem } from '../core/store'
import { AppIcon } from './AppIcon'

const CATEGORIES = ['全部', '沟通', '存储', '媒体', '创作', '智能', '协作', '系统']

export function Launcher() {
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const closeOverlay = useSystem((s) => s.closeOverlay)
  const openApp = useSystem((s) => s.openApp)
  const list = useMemo(
    () =>
      APP_DEFINITIONS.filter((a) => (cat === '全部' || a.category === cat) && (!q.trim() || (a.name + a.en + a.tagline + a.description).toLowerCase().includes(q.toLowerCase()))),
    [cat, q],
  )

  return (
    <div className="overlay-backdrop launcher-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <div className="launcher" role="dialog" aria-modal>
        <header className="launcher-head">
          <div>
            <span className="sheet-eyebrow">STELLAR LAUNCHPAD</span>
            <h2>启动台</h2>
            <p>十二个应用，一个生态。任意应用都可以把内容交给另一个应用。</p>
          </div>
          <button className="icon-btn" onClick={closeOverlay}><X size={19} /></button>
        </header>
        <div className="launcher-tools">
          <div className="field launcher-search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="筛选应用…" autoFocus />
          </div>
          <div className="segmented launcher-cats">
            {CATEGORIES.map((c) => <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        </div>
        <div className="launcher-grid scroll-y">
          {list.map((a) => (
            <button key={a.id} className="launcher-app" onClick={() => { closeOverlay(); openApp(a.id) }}>
              <AppIcon id={a.id} size={54} />
              <span className="launcher-app-copy">
                <strong>{a.name} <em>{a.en}</em></strong>
                <span>{a.tagline}</span>
                <small>{a.description}</small>
              </span>
            </button>
          ))}
          {list.length === 0 && <div className="empty-state"><strong>没有匹配的应用</strong><p>换个关键词试试。</p></div>}
        </div>
        <footer className="launcher-foot">
          <span><span className="dot pulse" /> 所有应用共享同一套文件与事件总线</span>
          <span>v0.1 · Apache-2.0</span>
        </footer>
      </div>
    </div>
  )
}
