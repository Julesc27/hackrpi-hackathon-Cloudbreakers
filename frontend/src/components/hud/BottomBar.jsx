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
            data-tutorial={id ? `nav-${id}` : 'nav-town'}
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
      <button
        className={`btn-gold end-turn${state.actionsLeft === 0 ? ' nudge' : ''}`}
        onClick={() => dispatch({ type: 'END_TURN', roll: Math.random() })}
        data-tutorial="end-turn-btn"
      >
        <Hourglass size={20} /> End Turn
      </button>
    </div>
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
  const ui = useUI()
  if (!ui.placing) return null
  return (
    <div className="placing-hint panel">
      Choose a glowing plot for your <strong>{BUILDINGS[ui.placing].name}</strong>
      <button className="btn-ghost" onClick={() => ui.setPlacing(null)}>Cancel (Esc)</button>
    </div>
  )
}
