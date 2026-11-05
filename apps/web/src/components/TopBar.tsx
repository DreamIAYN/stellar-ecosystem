import { Bell, ChevronDown, CircleHelp, Command, LogOut, Search, Settings2, Sparkles, Wifi } from 'lucide-react'
import { useRef, useState } from 'react'
import { useClock, useClickOutside } from '../core/hooks'
import { useSystem } from '../core/store'
import { Avatar } from './Avatar'
import { BrandMark } from './BrandMark'

export function TopBar() {
  const now = useClock(10000)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useClickOutside<HTMLDivElement>(() => setMenu(false), menu)
  const notifications = useSystem((s) => s.notifications)
  const chats = useSystem((s) => s.chats)
  const profile = useSystem((s) => s.profile)
  const openOverlay = useSystem((s) => s.openOverlay)
  const openApp = useSystem((s) => s.openApp)
  const unreadNotifs = notifications.filter((n) => !n.read).length
  const unreadChats = chats.reduce((n, c) => n + (c.muted ? 0 : c.unread), 0)
  const unread = unreadNotifs + unreadChats

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="brand" onClick={() => openOverlay('launcher')} title="打开启动台">
          <BrandMark size={29} />
          <span className="brand-text">
            <span className="brand-name">星环</span>
            <span className="brand-en">STELLAR</span>
          </span>
        </button>
        <div className="node-pill tooltip-host">
          <span className="dot pulse" />
          <Wifi size={11} />
          <span>本地节点</span>
          <span className="tooltip">数据保存在本设备 · 可自托管</span>
        </div>
      </div>

      <button className="command-trigger" onClick={() => openOverlay('palette')}>
        <Search size={15} />
        <span className="command-placeholder">搜索应用、文件、消息，或输入指令…</span>
        <span className="kbd-group"><kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd></span>
      </button>

      <div className="topbar-right">
        <div className="topbar-clock">
          <span>{now.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
          <strong>{now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
        </div>
        <button className="icon-btn tooltip-host" onClick={() => openApp('assistant')} aria-label="语音助手">
          <Sparkles size={17} />
          <span className="tooltip">小环 · 语音助手</span>
        </button>
        <button className="icon-btn notification-btn tooltip-host" onClick={() => openOverlay('notifications')} aria-label="通知">
          <Bell size={17} />
          {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
          <span className="tooltip">通知中心</span>
        </button>
        <div className="profile-wrap" ref={menuRef}>
          <button className="profile-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
            <Avatar name={profile.name} hue={profile.hue} size={30} />
            <span className="profile-meta">
              <strong>{profile.name}</strong>
              <span>@{profile.handle}</span>
            </span>
            <ChevronDown size={13} className={menu ? 'rot' : ''} />
          </button>
          {menu && (
            <div className="profile-menu">
              <div className="profile-menu-head">
                <Avatar name={profile.name} hue={profile.hue} size={38} />
                <div>
                  <strong>{profile.name}</strong>
                  <span>{profile.bio}</span>
                </div>
              </div>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => { openApp('settings', { tab: 'appearance' }); setMenu(false) }}><Settings2 size={15} />控制台</button>
              <button className="menu-item" onClick={() => { openApp('assistant'); setMenu(false) }}><Sparkles size={15} />唤醒小环</button>
              <button className="menu-item" onClick={() => { openOverlay('shortcuts'); setMenu(false) }}><Command size={15} />键盘快捷键</button>
              <button className="menu-item" onClick={() => { openApp('settings', { tab: 'about' }); setMenu(false) }}><CircleHelp size={15} />关于与开源</button>
              <div className="menu-sep" />
              <button className="menu-item" onClick={() => { openApp('settings', { tab: 'data' }); setMenu(false) }}><LogOut size={15} />数据与迁移</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
