import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { getLevelInfo, housing, activeMissions } from '../../game/engine.js'
import { getAdvice } from '../../game/advisor.js'
import { WEATHER } from '../../game/data.js'
import { CloudIcon, WeatherIcon, People, Leaf, ArtIcon } from '../icons.jsx'

export function TitleBlock() {
  const { state } = useGame()
  return (
    <div className="title-block">
      <div className="logo-mark">
        <CloudIcon size={34} className="title-cloud" />
        <h1 className="game-title"><span className="orn-l">✦</span>Cloudbreakers<span className="orn-r">✦</span></h1>
      </div>
      <div className="town-ribbon"><span>{state.townName}</span></div>
      <div className="town-stats" data-tutorial="hud-town">
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
    { id: 'store', label: 'Store', icon: 'store' },
  ]
  return (
    <nav className="left-rail" aria-label="Main actions">
      {items.map(({ id, label, icon, badge }, i) => (
        <span key={id} className="rail-item">
          {i > 0 && <span className="rail-sep">✦</span>}
          <button
            className={`rail-btn panel${ui.panel === id ? ' is-active' : ''}`}
            onClick={() => ui.toggle(id)}
            data-tutorial={`rail-${id}`}
          >
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
    <div className="level-badge" data-tutorial="hud-level" title={lvl.next ? `${state.xp} / ${lvl.next.xp} XP` : `${state.xp} XP`}>
      <div className="level-orb">
        <CloudIcon size={58} className="level-cloud" />
        <span className="level-orb-num">{lvl.level}</span>
      </div>
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
  const ui = useUI()
  const w = WEATHER[state.weather]
  const advice = getAdvice(state)[0]
  // The advisor can fold down to a small cloud so it doesn't cover islands.
  // It starts folded on smaller screens; the player's choice is remembered.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('cb-advisor-collapsed')
      if (saved !== null) return saved === '1'
    } catch { /* storage unavailable */ }
    return window.innerWidth < 1150
  })
  useEffect(() => {
    try { localStorage.setItem('cb-advisor-collapsed', collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed])
  return (
    <aside className={`cloud-advisor panel${collapsed ? ' is-collapsed' : ''}`} aria-label="Cloud, your AI advisor">
      <div className="advisor-kicker">
        <CloudIcon size={23} /> <span className="advisor-kicker-text">AI advisor</span>
        <button
          className="advisor-fold"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Show Cloud’s advice' : 'Fold Cloud away'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Show advice' : 'Fold away'}
        >
          {collapsed ? '+' : '–'}
        </button>
      </div>
      <button className="cloud-portrait" aria-label="Open Cloud’s advice" onClick={() => ui.setPanel('advisor')}>
        <span className="cloud-orbit orbit-one" /><span className="cloud-orbit orbit-two" />
        <svg className="advisor-cloud" viewBox="0 0 240 160" aria-hidden="true">
          <defs><radialGradient id="cloudFace" cx="40%" cy="28%" r="78%"><stop stopColor="#fffefa" /><stop offset=".6" stopColor="#dce8ff" /><stop offset="1" stopColor="#8ca4df" /></radialGradient></defs>
          <path d="M54 132C12 132 8 86 38 77C28 48 55 22 82 36C99 1 145 8 157 40C184 25 213 48 205 76C242 86 229 132 197 132Z" fill="url(#cloudFace)" stroke="#8daedb" strokeWidth="3" />
          <path d="M33 100C25 77 46 64 59 70M77 46C91 20 123 23 134 37" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".6" />
          <ellipse cx="87" cy="104" rx="12" ry="6" fill="#d5b4db" opacity=".65" /><ellipse cx="160" cy="104" rx="12" ry="6" fill="#d5b4db" opacity=".65" />
          <circle cx="96" cy="92" r="4.5" fill="#315681" /><circle cx="151" cy="92" r="4.5" fill="#315681" />
          <path d="M116 106Q125 116 135 106" fill="none" stroke="#315681" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span className="cloud-twinkle">✧</span>
      </button>
      <div className="cloud-speech">
        <strong>{advice?.recommendation || 'A little higher, together.'}</strong>
        <p>{advice?.reason || 'Your sky settlement is growing. Choose an island and plan your next step.'}</p>
      </div>
      <button className="advisor-link" onClick={() => ui.setPanel('advisor')}>Cloud’s notes <span>↗</span></button>
      <div className="advisor-weather" data-tutorial="hud-weather"><WeatherIcon kind={w.icon} size={19} /><span>{w.name}</span></div>
    </aside>
  )
}
