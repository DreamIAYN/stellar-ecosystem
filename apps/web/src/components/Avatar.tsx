import type { ReactNode } from 'react'
import { hueStyle, initials } from '../core/utils'

export function Avatar({
  name,
  hue,
  size = 40,
  round = false,
  online,
  children,
  className = '',
}: {
  name: string
  hue: number
  size?: number
  round?: boolean
  online?: boolean
  children?: ReactNode
  className?: string
}) {
  return (
    <span className={`avatar-wrap ${className}`} style={{ width: size, height: size }}>
      <span
        className={`avatar ${round ? 'round' : ''}`}
        style={{ ...hueStyle(hue), width: size, height: size, fontSize: Math.round(size * 0.38) }}
      >
        {children ?? initials(name)}
      </span>
      {online !== undefined && <span className={`avatar-presence ${online ? 'online' : ''}`} />}
    </span>
  )
}
