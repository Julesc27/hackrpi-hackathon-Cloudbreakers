import { useGame, useUI } from '../../game/GameContext.jsx'
import { activeMissions, getLevelInfo } from '../../game/engine.js'
import { BUILDINGS } from '../../game/data.js'
import { HouseIcon, Star, ArtIcon } from '../icons.jsx'

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

export function ProgressionCard() {
  const { state } = useGame()
  const level = getLevelInfo(state.xp)
  const ui = useUI()
  return (
    <button className="progression-card panel" onClick={() => ui.setPanel('quests')}>
      <Star size={24} />
      <div>
        <div className="progression-label">{level.next ? `Next: Level ${level.next.level}` : 'Maximum level'}</div>
        <strong>{level.next ? `${level.next.xp - state.xp} XP to level up` : level.title}</strong>
        <div className="small muted">Build, gather & complete quests · +10 XP per action</div>
      </div>
    </button>
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
