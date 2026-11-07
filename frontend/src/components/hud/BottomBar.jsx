import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { activeMissions } from '../../game/engine.js'
import { ACTIONS_PER_TURN, BUILDINGS } from '../../game/data.js'
import { HouseIcon, Hourglass, Star, ArtIcon } from '../icons.jsx'

export function BottomNav() {
  const { state } = useGame()
  const ui = useUI()
  const tabs = [
    { id: null, label: 'Town', Icon: HouseIcon },
    { id: 'map', label: 'Map', Icon: (p) => <ArtIcon name="map" {...p} /> },
    { id: 'journal', label: 'Journal', Icon: (p) => <ArtIcon name="journal" {...p} />, badge: state.journalUnread > 0 },
    { id: 'storage', label: 'Storage', Icon: (p) => <ArtIcon name="storage" {...p} /> },
  ]
  const isActive = (id) => (id === null ? !['map', 'journal', 'storage'].includes(ui.panel) : ui.panel === id)
  return (
    <nav className="bottom-nav" aria-label="Views">
      {tabs.map(({ id, label, Icon, badge }, i) => (
        <span key={label} className="nav-wrap">
          {i > 0 && <Star size={14} className="nav-sep" />}
          <button
            className={`nav-btn panel${isActive(id) ? ' is-active' : ''}`}
            onClick={() => (id === null ? ui.closeAll() : ui.toggle(id))}
          >
            {badge && <span className="badge">!</span>}
            <Icon size={44} />
            <span>{label}</span>
          </button>
        </span>
      ))}
    </nav>
  )
}

export function TurnControls() {
  const { state, dispatch } = useGame()
  return (
    <div className="turn-controls panel">
      <div className="turn-info">
        <div className="turn-label">Turn</div>
        <div className="turn-num">{state.turn}</div>
      </div>
      <div className="actions-left" title={`${state.actionsLeft} of ${ACTIONS_PER_TURN} actions left this turn`}>
        <div className="turn-label">Actions</div>
        <div className="pips">
          {Array.from({ length: ACTIONS_PER_TURN }, (_, i) => (
            <span key={i} className={`pip${i < state.actionsLeft ? ' on' : ''}`} />
          ))}
        </div>
      </div>
      <button className={`btn-gold end-turn${state.actionsLeft === 0 ? ' nudge' : ''}`} onClick={() => dispatch({ type: 'END_TURN', roll: Math.random() })}>
        <Hourglass size={20} /> End Turn
      </button>
    </div>
  )
}

export function SettingsButton() {
  const ui = useUI()
  return (
    <button className="gear-btn panel" aria-label="Settings" onClick={() => ui.toggle('settings')}>
      <ArtIcon name="gear" size={38} />
    </button>
  )
}

export function ObjectiveRibbon() {
  const { state } = useGame()
  const ui = useUI()
  const m = activeMissions(state)[0]
  if (!m) return null
  const [v, g] = m.progress(state)
  return (
    <button className="objective" onClick={() => ui.setPanel('quests')}>
      <span className="obj-kicker">✦ {m.name}</span>
      <span className="obj-text">{m.objective}</span>
      <span className="obj-prog">{v}/{g}</span>
    </button>
  )
}

export function PlacingHint() {
  const ui = useUI()
  if (!ui.placing) return null
  return (
    <div className="placing-hint panel">
      Choose a glowing plot for your <strong>{BUILDINGS[ui.placing].name}</strong>
      <button className="btn-ghost" onClick={() => ui.setPlacing(null)}>Cancel (Esc)</button>
    </div>
  )
}

// Zoom / recentre buttons for the map camera
export function CameraControls() {
  const ui = useUI()
  const cam = () => ui.camera.current
  return (
    <div className="cam-controls" aria-label="Map view">
      <button className="cam-btn panel" onClick={() => cam()?.zoomIn()} aria-label="Zoom in" title="Zoom in (+)">+</button>
      <button className="cam-btn panel" onClick={() => cam()?.zoomOut()} aria-label="Zoom out" title="Zoom out (−)">−</button>
      <button className="cam-btn panel" onClick={() => cam()?.home()} aria-label="Back to New Haven" title="Back to New Haven (0)">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.6" fill="currentColor" /><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}

// One-time coach mark: disappears after the first drag or zoom
export function CameraHint() {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem('cb-cam-hint') } catch { return true }
  })
  useEffect(() => {
    if (!show) return
    const done = () => {
      setShow(false)
      try { localStorage.setItem('cb-cam-hint', '1') } catch { /* ignore */ }
    }
    const onMove = () => { if (document.querySelector('.camera.is-moving')) done() }
    const id = setInterval(onMove, 400)
    const t = setTimeout(done, 14000)
    return () => { clearInterval(id); clearTimeout(t) }
  }, [show])
  if (!show) return null
  return (
    <div className="cam-hint" aria-live="polite">
      <span className="hand-icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.8-2.4L4.6 14.4a1.5 1.5 0 0 1 2.3-1.9L9 14.5" fill="#fff6d6" stroke="#1f2a5a" strokeWidth="1.3" strokeLinejoin="round" /></svg>
      </span>
      Drag to explore · scroll or pinch to zoom · tap an island
    </div>
  )
}
