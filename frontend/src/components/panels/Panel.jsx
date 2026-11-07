import { useEffect } from 'react'
import { Close, RES_ICON } from '../icons.jsx'

export function Drawer({ side = 'left', title, kicker, onClose, children, className = '' }) {
  return (
    <aside className={`drawer drawer-${side} panel ${className}`} role="dialog" aria-label={title}>
      <header className="drawer-head">
        <div>
          {kicker && <div className="kicker">{kicker}</div>}
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Close size={20} /></button>
      </header>
      <div className="drawer-body">{children}</div>
    </aside>
  )
}

export function Modal({ title, kicker, onClose, children, footer, size = 'md', dismissable = true }) {
  useEffect(() => {
    if (!dismissable) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissable])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal-${size} panel orn`} role="dialog" aria-label={title}>
        <header className="modal-head">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          {dismissable && <button className="icon-btn" onClick={onClose} aria-label="Close"><Close size={20} /></button>}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function CostChips({ cost = {}, resources }) {
  return (
    <span className="chips">
      {Object.entries(cost).map(([k, v]) => {
        const Icon = RES_ICON[k]
        const short = resources && (resources[k] ?? 0) < v
        return (
          <span key={k} className={`chip${short ? ' is-short' : ''}`} title={`${v} ${k}`}>
            {Icon && <Icon size={16} />}{v}
          </span>
        )
      })}
    </span>
  )
}

export function YieldChips({ yields = {}, sign = '+', suffix = '/turn' }) {
  const entries = Object.entries(yields).filter(([, v]) => v)
  if (!entries.length) return <span className="muted">—</span>
  return (
    <span className="chips">
      {entries.map(([k, v]) => {
        const Icon = RES_ICON[k]
        return (
          <span key={k} className="chip chip-yield">
            {Icon && <Icon size={16} />}{sign}{v}<small>{suffix}</small>
          </span>
        )
      })}
    </span>
  )
}

export function Progress({ value, max, color = 'linear-gradient(90deg,#e3b84f,#ffe28a)' }) {
  return (
    <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>
  )
}
