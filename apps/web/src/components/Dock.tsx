import { LayoutGrid } from 'lucide-react'
import { APP_DEFINITIONS } from '../core/registry'
import { useSystem } from '../core/store'
import { AppIcon } from './AppIcon'

const MOBILE_PRIMARY = new Set(['im', 'drive', 'scanner', 'ai', 'notes'])

export function Dock() {
  const windows = useSystem((s) => s.windows)
  const openApp = useSystem((s) => s.openApp)
  const openOverlay = useSystem((s) => s.openOverlay)
  const running = new Set(windows.map((w) => w.appId))
  const top = [...windows].sort((a, b) => b.z - a.z)[0]

  return (
    <nav className="dock" aria-label="应用坞">
      <div className="dock-inner">
        {APP_DEFINITIONS.map((app) => (
          <button
            key={app.id}
            className={`dock-app tooltip-host ${top?.appId === app.id ? 'active' : ''} ${MOBILE_PRIMARY.has(app.id) ? 'mobile-primary' : ''} ${app.id === 'settings' ? 'dock-settings' : ''}`}
            onClick={() => openApp(app.id)}
            aria-label={app.name}
          >
            <AppIcon id={app.id} size={43} className="dock-icon" />
            {running.has(app.id) && <span className="dock-running" />}
            <span className="dock-tooltip">
              <strong>{app.name}</strong>
              <span>{app.tagline}</span>
            </span>
          </button>
        ))}
        <div className="dock-sep" />
        <button className="dock-more tooltip-host" onClick={() => openOverlay('launcher')} aria-label="全部应用">
          <LayoutGrid size={18} />
          <span className="dock-tooltip"><strong>启动台</strong><span>全部应用与操作</span></span>
        </button>
      </div>
    </nav>
  )
}
