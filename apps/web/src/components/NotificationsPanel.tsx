import { BellOff, CheckCheck, Trash2, X } from 'lucide-react'
import { APP_MAP } from '../core/registry'
import { useSystem } from '../core/store'
import { relativeTime } from '../core/utils'
import { AppIcon } from './AppIcon'

export function NotificationsPanel() {
  const notifications = useSystem((s) => s.notifications)
  const closeOverlay = useSystem((s) => s.closeOverlay)
  const markAll = useSystem((s) => s.markAllNotificationsRead)
  const markOne = useSystem((s) => s.markNotificationRead)
  const dismiss = useSystem((s) => s.dismissNotification)
  const openApp = useSystem((s) => s.openApp)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="notif-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeOverlay()}>
      <aside className="notif-panel" aria-label="通知中心">
        <header className="notif-head">
          <div>
            <span className="sheet-eyebrow">SIGNAL CENTER</span>
            <h2>通知中心 {unread > 0 && <span className="notif-count">{unread}</span>}</h2>
          </div>
          <button className="icon-btn" onClick={closeOverlay}><X size={18} /></button>
        </header>
        <div className="notif-toolbar">
          <span className="hint">来自生态内 12 个应用</span>
          <button className="text-btn" onClick={markAll}><CheckCheck size={13} /> 全部已读</button>
        </div>
        <div className="notif-list scroll-y">
          {notifications.length === 0 && (
            <div className="empty-state">
              <span className="emoji"><BellOff size={26} /></span>
              <strong>暂时没有新动静</strong>
              <p>扫描、会议、云盘同步与协作消息会出现在这里。</p>
            </div>
          )}
          {notifications.map((n) => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
              <button
                className="notif-main"
                onClick={() => {
                  markOne(n.id)
                  if (n.action) {
                    closeOverlay()
                    openApp(n.action.appId, n.action.params)
                  }
                }}
              >
                <AppIcon id={n.appId} size={34} />
                <span className="grow">
                  <span className="notif-top"><strong>{n.title}</strong><small>{relativeTime(n.time)}</small></span>
                  <span className="notif-body">{n.body}</span>
                  <span className="notif-app">{APP_MAP[n.appId]?.name ?? n.appId}</span>
                </span>
                {!n.read && <span className="notif-dot" />}
              </button>
              <button className="notif-del" onClick={() => dismiss(n.id)} aria-label="删除通知"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <footer className="notif-foot">
          <span className="dot pulse" /> 信令节点在线 · 本地通知
        </footer>
      </aside>
    </div>
  )
}
