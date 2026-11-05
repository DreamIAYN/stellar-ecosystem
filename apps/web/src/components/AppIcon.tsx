import { APP_ICONS, APP_MAP } from '../core/registry'
import type { AppId } from '../core/types'

export function AppIcon({ id, size = 44, className = '', muted = false }: { id: AppId; size?: number; className?: string; muted?: boolean }) {
  const Icon = APP_ICONS[id]
  const app = APP_MAP[id]
  return (
    <span
      className={`app-icon ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: muted ? 'rgba(255,255,255,.06)' : `linear-gradient(145deg, ${app.hue}, ${app.hue2})`,
        color: muted ? 'var(--muted)' : '#06111d',
      }}
      aria-hidden
    >
      <span className="app-icon-sheen" />
      <Icon size={Math.round(size * 0.48)} strokeWidth={1.9} />
    </span>
  )
}
