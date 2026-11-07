import { useGame, useUI } from '../../game/GameContext.jsx'
import { getLevelInfo, housing, activeMissions } from '../../game/engine.js'
import { WEATHER } from '../../game/data.js'
import { CloudIcon, WeatherIcon, People, Leaf, ArtIcon } from '../icons.jsx'

export function TitleBlock() {
  const { state } = useGame()
  return (
    <div className="title-block">
      <CloudIcon size={40} className="title-cloud" />
      <h1 className="game-title"><span className="orn-l">✦</span>Cloudbreakers<span className="orn-r">✦</span></h1>
      <div className="town-ribbon"><span>{state.townName}</span></div>
      <div className="town-stats">
        <span title="Population / housing"><People size={18} /> {state.population}<em>/{housing(state)}</em></span>
        <span title="Sustainability"><Leaf size={18} /> {state.sustainability}%</span>
      </div>
    </div>
  )
}

export function LeftRail() {
  const { state } = useGame()
  const ui = useUI()
  const hasNewMission = activeMissions(state).some((m) => !ui.seenQuests.includes(m.id))
  const items = [
    { id: 'quests', label: 'Quest Book', icon: 'quest', badge: hasNewMission },
    { id: 'build', label: 'Build', icon: 'build' },
    { id: 'advisor', label: 'Cloud', icon: 'cloud' },
  ]
  return (
    <nav className="left-rail" aria-label="Main actions">
      {items.map(({ id, label, icon, badge }, i) => (
        <span key={id} className="rail-item">
          {i > 0 && <span className="rail-sep">✦</span>}
          <button className={`rail-btn panel${ui.panel === id ? ' is-active' : ''}`} onClick={() => ui.toggle(id)}>
            {badge && <span className="badge">!</span>}
            <ArtIcon name={icon} size={50} />
            <span>{label}</span>
          </button>
        </span>
      ))}
    </nav>
  )
}

export function LevelBadge() {
  const { state } = useGame()
  const lvl = getLevelInfo(state.xp)
  return (
    <div className="level-badge" title={lvl.next ? `${state.xp} / ${lvl.next.xp} XP` : `${state.xp} XP`}>
      <div className="level-orb"><CloudIcon size={52} /></div>
      <div className="level-card panel">
        <div className="level-row"><span className="lv">Lv.</span><span className="lv-num">{lvl.level}</span></div>
        <div className="level-title">{lvl.title}</div>
        <div className="bar thin"><div className="bar-fill" style={{ width: `${lvl.progress * 100}%`, background: 'linear-gradient(90deg,#e3b84f,#ffe28a)' }} /></div>
        <div className="xp-num">{lvl.next ? `${state.xp} / ${lvl.next.xp} XP` : `${state.xp} XP · max`}</div>
      </div>
    </div>
  )
}

export function WeatherCard() {
  const { state } = useGame()
  const w = WEATHER[state.weather]
  const canForecast = state.connected.includes('mistral')
  const f = WEATHER[state.forecast]
  return (
    <div className="weather-card panel orn">
      <div className="weather-head">
        {w.icon === 'sun' ? <ArtIcon name="sun" size={52} /> : <WeatherIcon kind={w.icon} size={46} />}
        <div>
          <div className="weather-kicker">Current weather</div>
          <div className="weather-name">{w.name}</div>
        </div>
      </div>
      <p className="weather-text">{w.text}</p>
      <div className="weather-forecast">
        {canForecast ? (
          <><WeatherIcon kind={f.icon} size={18} /> Next level: <strong>{f.name}</strong></>
        ) : (
          <span className="muted">Forecasts need Mistral Heights</span>
        )}
      </div>
    </div>
  )
}
