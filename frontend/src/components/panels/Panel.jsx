import { useRef } from 'react'
import { Close, RES_ICON, Compass } from '../icons.jsx'
import { eventShouldDismissOverlay } from '../../game/travelInput.js'
import useDialogAccessibility from '../useDialogAccessibility.js'
import { RESOURCES } from '../../game/data.js'

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
  const ref = useRef(null)
  useDialogAccessibility(ref, { modal: false, onClose })
  return (
    <aside ref={ref} className={`drawer drawer-${side} parchment ${className}`} role="dialog" aria-label={title}>
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
  const ref = useRef(null)
  useDialogAccessibility(ref, { onClose, dismissable })
  return (
    <div className="modal-backdrop" onClick={(e) => dismissable && eventShouldDismissOverlay(e) && onClose?.()}>
      <div ref={ref} className={`modal modal-${size} parchment ${className}`} role="dialog" aria-label={title}>
        <Corners />
        {crest && <div className="crest"><Compass size={52} /></div>}
        {dismissable && <SealClose onClose={onClose} />}
        <header className="p-head">
          <h2 className="p-title"><span className="spark" aria-hidden="true">✦</span>{title}<span className="spark" aria-hidden="true">✦</span></h2>
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
            <span aria-hidden="true">{Icon && <Icon size={16} />}{v}{short && <strong> !</strong>}</span><span className="sr-only">{v} {RESOURCES[k]?.label || k}{short ? ', not enough available' : ''}</span>
          </span>
        )
      })}
    </span>
  )
}

export function YieldChips({ yields = {}, sign = '+', suffix = '/action' }) {
  const entries = Object.entries(yields).filter(([, v]) => v)
  if (!entries.length) return <span className="muted">—</span>
  return (
    <span className="chips">
      {entries.map(([k, v]) => {
        const Icon = RES_ICON[k]
        return (
          <span key={k} className="chip chip-yield">
            <span aria-hidden="true">{Icon && <Icon size={16} />}{sign}{v}<small>{suffix}</small></span><span className="sr-only">{sign}{v} {RESOURCES[k]?.label || k} {suffix === '/action' ? 'per completed job' : suffix}</span>
          </span>
        )
      })}
    </span>
  )
}

export function Progress({ value, max = 100, color = 'linear-gradient(90deg,#e3b84f,#ffe28a)', label }) {
  return (
    <div className="bar" role={label ? 'progressbar' : undefined} aria-label={label} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? max : undefined} aria-valuenow={label ? value : undefined} aria-hidden={label ? undefined : true}><div className="bar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>
  )
}
