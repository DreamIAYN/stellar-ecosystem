import { useEffect } from 'react'
import { useSystem } from '../core/store'
import { AppRenderer } from './AppRenderer'
import { CommandPalette } from './CommandPalette'
import { Dock } from './Dock'
import { Home } from './Home'
import { Launcher } from './Launcher'
import { NotificationsPanel } from './NotificationsPanel'
import { ShareSheet } from './ShareSheet'
import { Shortcuts } from './Shortcuts'
import { Toasts } from './Toasts'
import { TopBar } from './TopBar'
import { WindowFrame } from './WindowFrame'

export function Shell() {
  const overlay = useSystem((s) => s.overlay)
  const windows = useSystem((s) => s.windows)
  const preferences = useSystem((s) => s.preferences)
  const openApp = useSystem((s) => s.openApp)
  const closeOverlay = useSystem((s) => s.closeOverlay)
  const openOverlay = useSystem((s) => s.openOverlay)

  useEffect(() => {
    document.documentElement.dataset.accent = preferences.accent
    document.documentElement.dataset.motion = preferences.reduceMotion ? 'reduce' : 'full'
  }, [preferences.accent, preferences.reduceMotion])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useSystem.getState().overlay === 'palette' ? closeOverlay() : openOverlay('palette')
        return
      }
      if (mod && e.key === '/') {
        e.preventDefault()
        openOverlay('shortcuts')
        return
      }
      if (mod && e.shiftKey && e.code === 'Space') {
        e.preventDefault()
        openApp('assistant')
        return
      }
      if (e.key === 'Escape' && useSystem.getState().overlay) {
        closeOverlay()
        return
      }
      if (mod && e.key.toLowerCase() === 'w') {
        const top = [...useSystem.getState().windows].sort((a, b) => b.z - a.z).find((w) => !w.minimized)
        if (top) {
          e.preventDefault()
          useSystem.getState().closeWindow(top.id)
        }
        return
      }
      if (mod && e.key.toLowerCase() === 'm') {
        const top = [...useSystem.getState().windows].sort((a, b) => b.z - a.z).find((w) => !w.minimized)
        if (top) {
          e.preventDefault()
          useSystem.getState().minimizeWindow(top.id)
        }
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('stellar:save'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeOverlay, openApp, openOverlay])

  useEffect(() => {
    const raw = decodeURIComponent(location.hash.replace('#', ''))
    if (!raw) return
    const [app, query] = raw.split('?')
    const valid = ['im', 'drive', 'media', 'scanner', 'ai', 'meeting', 'editor', 'remote', 'notes', 'browser', 'assistant', 'settings']
    if (valid.includes(app)) {
      const params: Record<string, string> = {}
      new URLSearchParams(query || '').forEach((value, key) => { params[key] = value })
      const appId = app as (typeof valid)[number] as Parameters<typeof openApp>[0]
      setTimeout(() => openApp(appId, params), 250)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleWindow = windows.some((w) => !w.minimized)

  return (
    <div className={`shell wallpaper-${preferences.wallpaper} ${visibleWindow ? 'has-windows' : ''}`}>
      <div className="wallpaper" aria-hidden>
        <div className="wp-glow glow-1" />
        <div className="wp-glow glow-2" />
        <div className="wp-grid" />
        <div className="wp-stars" />
        <div className="wp-orbit orbit-1" />
        <div className="wp-orbit orbit-2" />
        <div className="wp-noise" />
      </div>
      <TopBar />
      <div className={`home-wrap ${visibleWindow ? 'dimmed' : ''}`}><Home /></div>
      {[...windows].sort((a, b) => a.z - b.z).map((win) => (
        <WindowFrame key={win.id} win={win}>
          <AppRenderer appId={win.appId} params={win.params} winId={win.id} />
        </WindowFrame>
      ))}
      <Dock />
      {overlay === 'palette' && <CommandPalette />}
      {overlay === 'share' && <ShareSheet />}
      {overlay === 'notifications' && <NotificationsPanel />}
      {overlay === 'launcher' && <Launcher />}
      {overlay === 'shortcuts' && <Shortcuts />}
      <Toasts />
    </div>
  )
}
