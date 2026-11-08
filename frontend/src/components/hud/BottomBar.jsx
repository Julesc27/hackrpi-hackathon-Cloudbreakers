import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { activeMissions, getLevelInfo, storageUsed, islandAccess } from '../../game/engine.js'
import { STORAGE_CAP } from '../../game/data.js'
import { BUILDINGS, ISLANDS } from '../../game/data.js'
import { HouseIcon, Star, ArtIcon } from '../icons.jsx'
import '../../styles/storage.css'

export function BottomNav() {
  const { state } = useGame()
  const ui = useUI()
  const stored = storageUsed(state.resources)
  const storageFull = stored >= STORAGE_CAP
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
            data-tutorial={id ? `nav-${id}` : 'nav-town'}
            aria-label={id === 'storage' ? `Storage, ${stored} of ${STORAGE_CAP}${storageFull ? ', full' : ''}` : badge ? `${label}, new entries` : undefined}
          >
            {badge && <span className="badge" aria-hidden="true">!</span>}
            <Icon size={44} />
            <span>{label}</span>
            {id === 'storage' && <span className={`storage-badge${storageFull ? ' is-full' : ''}`} aria-hidden="true">{stored}/{STORAGE_CAP}</span>}
          </button>
        </span>
      ))}
    </nav>
  )
}

export function ProgressionCard() {
  const { state } = useGame()
  const level = getLevelInfo(state.xp)
  const ui = useUI()
  const pct = Math.round(level.progress * 100)
  return (
    <button
      className="progression-card panel"
      onClick={() => ui.setPanel('quests')}
      aria-label={level.next ? `Level ${level.level}: ${level.next.xp - state.xp} XP to level ${level.next.level}. Open quests` : `${level.title}. Open quests`}
    >
      <Star size={20} />
      <div className="progression-text">
        <div className="progression-label">{level.next ? `Next: Level ${level.next.level}` : 'Maximum level'}</div>
        <strong>{level.next ? `${level.next.xp - state.xp} XP to level up` : level.title}</strong>
        {level.next && (
          <div className="progression-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        )}
        <div className="small muted">Build, gather & complete quests · +10 XP per action</div>
      </div>
    </button>
  )
}

export function SettingsButton() {
  const ui = useUI()
  return (
    <button
      className="gear-btn panel"
      aria-label="Settings"
      onClick={() => ui.toggle('settings')}
      data-tutorial="settings-btn"
    >
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
  const ui = useUI(), { state, dispatch } = useGame()
  const [location, setLocation] = useState('')
  const access = islandAccess(state), def = BUILDINGS[ui.placing]
  const islands = state.connected.filter(id => access[id] && (!def?.homeOnly || id === 'newHaven'))
  if (ui.placeFocus) islands.sort((a,b) => Number(b === ui.placeFocus)-Number(a === ui.placeFocus))
  const plots = islands.flatMap(id => ISLANDS[id].plots.map((_,slot) => ({ id,slot,value:`${id}:${slot}` })).filter(plot => !state.buildings.some(b => b.island === id && b.slot === plot.slot && !BUILDINGS[b.type].infrastructure)))
  const selected = plots.some(plot => plot.value === location) ? location : plots[0]?.value || ''
  if (!ui.placing) return null
  return (
    <form className="placing-hint panel" aria-label="Choose a building plot" onSubmit={event => {
      event.preventDefault()
      if (!selected) return
      const [island,slot] = selected.split(':')
      dispatch({ type:'BUILD',buildingType:ui.placing,island,slot:Number(slot) }); ui.setPlacing(null)
    }}>
      <span>Place your <strong>{BUILDINGS[ui.placing].name}</strong> on the map or choose a plot below.</span>
      <label>Build location<select aria-label="Build location" value={selected} onChange={event => setLocation(event.target.value)} disabled={!plots.length}>{plots.map(plot => <option key={plot.value} value={plot.value}>{ISLANDS[plot.id].name}, plot {plot.slot+1}</option>)}</select></label>
      <button type="submit" className="btn-gold" disabled={!plots.length}>Build here</button>
      {!plots.length && <span role="status">No free reachable plots.</span>}
      <button type="button" className="btn-ghost" onClick={() => ui.setPlacing(null)}>Cancel (Esc)</button>
    </form>
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
