import { useEffect } from 'react'
import { Close, RES_ICON } from '../icons.jsx'

function SealClose({ onClose }) {
  return (
    <button className="seal-close" onClick={onClose} aria-label="Close">
      <Close size={20} />
    </button>
  )
}

// Gold metal corner caps, as on the concept art's parchment panels
export function Corners() {
  return (
    <>
      {['tl', 'tr', 'bl', 'br'].map((c) => (
        <svg key={c} className={`corner corner-${c}`} viewBox="0 0 60 60" aria-hidden="true">
          <defs>
            <linearGradient id={`cg-${c}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff0c0" /><stop offset=".45" stopColor="#d9a94c" /><stop offset="1" stopColor="#8a6424" />
            </linearGradient>
          </defs>
          <path d="M0 0H58L0 58Z" fill={`url(#cg-${c})`} stroke="#6b4a18" strokeWidth="1" />
          <path d="M7 7H40L7 40Z" fill="none" stroke="#fff3cf" strokeOpacity=".7" strokeWidth="1.2" />
          <path d="M14 14l5 -2 2 5 -5 2z" fill="#fff6d8" />
        </svg>
      ))}
    </>
  )
}

export function Drawer({ side = 'left', title, kicker, onClose, children, className = '' }) {
  return (
    <aside className={`drawer drawer-${side} parchment ${className}`} role="dialog" aria-label={title}>
      <Corners />
      <header className="p-head">
        {kicker && <div className="p-kicker">{kicker}</div>}
        <h2 className="p-title">{title}</h2>
      </header>
      <SealClose onClose={onClose} />
      <div className="drawer-body">{children}</div>
    </aside>
  )
}

// Parchment modal, modelled on "The Skyway Chart"
export function Modal({ title, kicker, onClose, children, footer, size = 'md', dismissable = true, crest = true, className = '' }) {
  useEffect(() => {
    if (!dismissable) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, dismissable])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal-${size} parchment ${className}`} role="dialog" aria-label={title}>
        <Corners />
        {crest && <div className="crest"><img src="/art/compass.webp" alt="" /></div>}
        {dismissable && <SealClose onClose={onClose} />}
        <header className="p-head">
          <h2 className="p-title"><span className="spark">✦</span>{title}<span className="spark">✦</span></h2>
          {kicker && <div className="p-sub">{kicker}</div>}
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
