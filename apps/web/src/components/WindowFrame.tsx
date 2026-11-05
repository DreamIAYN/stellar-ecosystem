import { Maximize2, Minus, Minimize2, X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { APP_MAP } from '../core/registry'
import { useSystem } from '../core/store'
import type { WindowState } from '../core/types'
import { clamp } from '../core/utils'
import { AppIcon } from './AppIcon'

export function WindowFrame({ win, children }: { win: WindowState; children: ReactNode }) {
  const app = APP_MAP[win.appId]
  const focusWindow = useSystem((s) => s.focusWindow)
  const closeWindow = useSystem((s) => s.closeWindow)
  const minimizeWindow = useSystem((s) => s.minimizeWindow)
  const toggleMaximize = useSystem((s) => s.toggleMaximize)
  const updateWindow = useSystem((s) => s.updateWindow)
  const dragging = useRef(false)

  if (win.minimized) return null

  const startDrag = (e: React.PointerEvent) => {
    if (win.maximized) return
    if ((e.target as HTMLElement).closest('button,input,textarea,select,a')) return
    if (e.button !== 0) return
    e.preventDefault()
    focusWindow(win.id)
    const startX = e.clientX
    const startY = e.clientY
    const ox = win.x
    const oy = win.y
    const vw = window.innerWidth
    const vh = window.innerHeight
    dragging.current = true
    document.body.classList.add('is-dragging')
    const move = (ev: PointerEvent) => {
      const nx = clamp(ox + ev.clientX - startX, -win.w + 120, vw - 120)
      const ny = clamp(oy + ev.clientY - startY, 54, vh - 60)
      updateWindow(win.id, { x: nx, y: ny })
    }
    const up = () => {
      dragging.current = false
      document.body.classList.remove('is-dragging')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startResize = (e: React.PointerEvent, dir: 'se' | 'e' | 's' | 'sw') => {
    if (win.maximized) return
    e.preventDefault()
    e.stopPropagation()
    focusWindow(win.id)
    const startX = e.clientX
    const startY = e.clientY
    const ow = win.w
    const oh = win.h
    const ox = win.x
    const vw = window.innerWidth
    const vh = window.innerHeight
    document.body.classList.add('is-resizing')
    const move = (ev: PointerEvent) => {
      let w = ow
      let h = oh
      let x = ox
      if (dir === 'e' || dir === 'se') w = clamp(ow + ev.clientX - startX, 460, vw - ox - 12)
      if (dir === 's' || dir === 'se') h = clamp(oh + ev.clientY - startY, 340, vh - win.y - 92)
      if (dir === 'sw') {
        w = clamp(ow - (ev.clientX - startX), 460, ox + ow - 12)
        x = ox + ow - w
        h = clamp(oh + ev.clientY - startY, 340, vh - win.y - 92)
      }
      updateWindow(win.id, { w, h, x })
    }
    const up = () => {
      document.body.classList.remove('is-resizing')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const style = win.maximized
    ? { zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }

  return (
    <section
      className={`window ${win.maximized ? 'maximized' : ''} win-app-${win.appId}`}
      style={style}
      onPointerDown={() => focusWindow(win.id)}
      aria-label={`${app.name}窗口`}
    >
      <header className="win-bar" onPointerDown={startDrag} onDoubleClick={() => toggleMaximize(win.id)}>
        <div className="win-identity">
          <AppIcon id={win.appId} size={21} />
          <span className="win-title">{app.name}</span>
          <span className="win-subtitle">{app.en}</span>
        </div>
        <div className="win-controls" onPointerDown={(e) => e.stopPropagation()}>
          <button className="win-ctrl" onClick={() => minimizeWindow(win.id)} aria-label="最小化"><Minus size={14} /></button>
          <button className="win-ctrl" onClick={() => toggleMaximize(win.id)} aria-label={win.maximized ? '还原' : '最大化'}>
            {win.maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button className="win-ctrl close" onClick={() => closeWindow(win.id)} aria-label="关闭"><X size={14} /></button>
        </div>
      </header>
      <div className={`win-body app-${win.appId}`}>{children}</div>
      {!win.maximized && (
        <>
          <div className="resize-handle se" onPointerDown={(e) => startResize(e, 'se')} />
          <div className="resize-handle e" onPointerDown={(e) => startResize(e, 'e')} />
          <div className="resize-handle s" onPointerDown={(e) => startResize(e, 's')} />
          <div className="resize-handle sw" onPointerDown={(e) => startResize(e, 'sw')} />
        </>
      )}
    </section>
  )
}
