import type { JSX } from 'react'
import logoUrl from '../assets/raven-hub-logo.png'

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 38, className }: LogoProps): JSX.Element {
  return (
    <span
      className={className ? `raven-logo ${className}` : 'raven-logo'}
      style={{ width: size, height: size }}
    >
      <img src={logoUrl} alt="" aria-hidden="true" draggable={false} />
    </span>
  )
}
