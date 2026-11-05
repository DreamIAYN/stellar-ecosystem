import { ArrowRight, ArrowUpRight, CalendarClock, Cloud, FileText, FolderOpen, ScanLine, Sparkles, Video } from 'lucide-react'
import { useState } from 'react'
import { useClock } from '../core/hooks'
import { APP_DEFINITIONS } from '../core/registry'
import { useSystem } from '../core/store'
import { formatDate, greeting, relativeTime } from '../core/utils'
import { AppIcon } from './AppIcon'
import { Avatar } from './Avatar'

export function Home() {
  const now = useClock(1000)
  const [prompt, setPrompt] = useState('')
  const files = useSystem((s) => s.files)
  const chats = useSystem((s) => s.chats)
  const profile = useSystem((s) => s.profile)
  const notifications = useSystem((s) => s.notifications)
  const openApp = useSystem((s) => s.openApp)
  const addAIRequest = useSystem((s) => s.addAIRequest)
  const openOverlay = useSystem((s) => s.openOverlay)
  const recent = [...files].filter((f) => f.kind === 'file' && !f.trashed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const unread = chats.reduce((n, c) => n + c.unread, 0)
  const quickApps = APP_DEFINITIONS.filter((a) => ['scanner', 'ai', 'meeting', 'notes', 'browser', 'editor'].includes(a.id))

  const send = () => {
    if (!prompt.trim()) return
    addAIRequest({ prompt: prompt.trim(), origin: 'assistant' })
    openApp('ai')
    setPrompt('')
  }

  return (
    <main className="home">
      <div className="home-head">
        <div>
          <div className="home-eyebrow">
            <span className="dot pulse" />
            {formatDate(now).toUpperCase()} · 星环生态 v0.1
          </div>
          <h1 className="home-title">{greeting(now)}，{profile.name}</h1>
          <p className="home-sub">你的数字生活，正在同一个轨道上运行。</p>
        </div>
        <div className="home-clock">
          <strong>{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
          <span>{now.toLocaleDateString('zh-CN', { weekday: 'long' })}</span>
        </div>
      </div>

      <div className="home-grid">
        <div className="home-col main">
          <section className="home-hero card">
            <div className="hero-orbit orbit-a" />
            <div className="hero-orbit orbit-b" />
            <div className="hero-glow" />
            <div className="hero-copy">
              <div className="chip accent"><Sparkles size={12} /> 全生态已就绪</div>
              <h2>一个入口，<br />十二种数字生活。</h2>
              <p>消息、文件、扫描、AI、会议与创作。应用之间不再有墙，分享与接力只需一次点击。</p>
              <div className="hero-actions">
                <button className="btn primary" onClick={() => openApp('scanner', { mode: 'exam' })}><ScanLine size={15} /> 扫描试卷</button>
                <button className="btn" onClick={() => openApp('ai')}><Sparkles size={15} /> 问问智核</button>
              </div>
            </div>
            <div className="hero-badge">
              <span>LOCAL FIRST</span>
              <strong>100%</strong>
              <small>数据留在你的设备</small>
            </div>
          </section>

          <section className="home-ask card">
            <div className="ask-head">
              <span className="ask-orb"><Sparkles size={18} /></span>
              <div><strong>小环在听</strong><span>自然语言调度整个生态</span></div>
              <span className="chip green">在线</span>
            </div>
            <div className="ask-input">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="试试「把评审纪要发给林小满」…"
              />
              <button className="ask-send" onClick={send} aria-label="发送"><ArrowRight size={15} /></button>
            </div>
            <div className="ask-suggestions">
              <button onClick={() => setPrompt('总结云巢里的评审纪要')}>总结纪要</button>
              <button onClick={() => setPrompt('发起一个 8 点开始的评审会')}>发起会议</button>
              <button onClick={() => setPrompt('扫描一份试卷并去除红笔')}>扫描试卷</button>
            </div>
          </section>

          <section className="home-apps card">
            <div className="card-head">
              <span className="section-title">快速启动</span>
              <button className="text-btn" onClick={() => openOverlay('launcher')}>启动台 <ArrowUpRight size={12} /></button>
            </div>
            <div className="quick-grid">
              {quickApps.map((a) => (
                <button key={a.id} className="quick-app" onClick={() => openApp(a.id)}>
                  <AppIcon id={a.id} size={38} />
                  <span><strong>{a.name}</strong><small>{a.tagline}</small></span>
                </button>
              ))}
            </div>
          </section>

          <section className="home-notif card">
            <div className="card-head"><span className="section-title">生态动态</span><button className="text-btn" onClick={() => openOverlay('notifications')}>通知中心 <ArrowUpRight size={12} /></button></div>
            <div className="home-notif-list">
              {notifications.slice(0, 2).map((n) => (
                <button key={n.id} onClick={() => { useSystem.getState().markNotificationRead(n.id); if (n.action) openApp(n.action.appId, n.action.params) }}>
                  <AppIcon id={n.appId} size={28} />
                  <span className="grow"><strong>{n.title}</strong><small>{n.body}</small></span>
                  <span className="faint">{relativeTime(n.time)}</span>
                </button>
              ))}
            </div>
            <button className="home-scan-cta" onClick={() => openApp('scanner', { mode: 'document' })}>
              <span className="scan-cta-icon"><ScanLine size={18} /></span>
              <span><strong>把纸变成数字</strong><small>文档 · 试卷 · 证件，一拍即得</small></span>
              <ArrowRight size={16} />
            </button>
          </section>
        </div>

        <div className="home-col side">
          <section className="home-pulse card">
            <div className="card-head">
              <span className="section-title">生态脉搏</span>
              <span className="live-tag"><span className="dot pulse" /> LIVE</span>
            </div>
            <div className="pulse-grid">
              <button onClick={() => openApp('drive')}><strong>{files.filter((f) => f.kind === 'file' && !f.trashed).length}</strong><span>云巢文件</span></button>
              <button onClick={() => openApp('im')}><strong>{unread || 3}</strong><span>未读消息</span></button>
              <button onClick={() => openApp('meeting', { room: 'STL-2048' })}><strong>1</strong><span>待开始会议</span></button>
              <button onClick={() => openApp('scanner')}><strong>{files.filter((f) => f.tags?.includes('扫描')).length + 3}</strong><span>今日扫描</span></button>
            </div>
            <div className="pulse-foot">
              <div className="pulse-people">
                {['林小满', '陈子航', '阿澈'].map((n, i) => <Avatar key={n} name={n} hue={[188, 258, 332][i]} size={22} round />)}
                <span>3 位协作者在线</span>
              </div>
              <span className="faint">本地存储 · {files.length} 项</span>
            </div>
            <div className="pulse-sparkline" aria-hidden>
              {[18, 26, 22, 38, 32, 52, 44, 68, 56, 78, 64, 88].map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }} />)}
            </div>
          </section>

          <section className="home-recent card">
            <div className="card-head">
              <span className="section-title">最近文件</span>
              <button className="text-btn" onClick={() => openApp('drive')}>全部 <ArrowUpRight size={12} /></button>
            </div>
            <div className="recent-list">
              {recent.map((f) => (
                <button key={f.id} className="recent-item" onClick={() => openApp('drive', { previewId: f.id })}>
                  <span className={`file-badge ${f.mime.includes('image') ? 'img' : f.mime.includes('video') ? 'video' : 'doc'}`}>
                    {f.mime.includes('image') ? <FolderOpen size={16} /> : f.mime.includes('video') ? <Video size={16} /> : <FileText size={16} />}
                  </span>
                  <span className="grow"><strong>{f.name}</strong><small>{relativeTime(f.updatedAt)} · {f.mime.split('/')[1]?.toUpperCase()}</small></span>
                  <ArrowUpRight size={13} className="faint" />
                </button>
              ))}
            </div>
          </section>

          <section className="home-agenda card">
            <div className="agenda-time">
              <span>接下来</span>
              <strong>20:00</strong>
              <small>今天 · 30 分钟</small>
            </div>
            <div className="agenda-info">
              <div className="chip"><CalendarClock size={11} /> 评审会</div>
              <h3>星环 v0.1 生态评审</h3>
              <p>会客厅 · STL-2048 · 林小满、陈子航、阿澈</p>
              <button className="btn primary sm" onClick={() => openApp('meeting', { room: 'STL-2048' })}><Video size={13} /> 进入会客厅</button>
            </div>
            <div className="agenda-stack">
              {['林小满', '陈子航', '阿澈'].map((n, i) => <Avatar key={n} name={n} hue={[188, 258, 332][i]} size={28} round />)}
            </div>
          </section>
        </div>
      </div>

      <footer className="home-foot">
        <span><Cloud size={12} /> 本地优先 · 可导出 · 可自托管</span>
        <span>星环 Stellar · Apache-2.0</span>
        <span className="mono">node/edge · 01</span>
      </footer>
    </main>
  )
}
