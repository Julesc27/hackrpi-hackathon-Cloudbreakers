import { useGame, useUI } from '../../game/GameContext.jsx'
import { caps, projectProduction } from '../../game/engine.js'
import { RES_ICON } from '../icons.jsx'

function Delta({ v }) {
  if (!v) return <span className="delta zero">±0</span>
  return <span className={`delta ${v > 0 ? 'up' : 'down'}`}>{v > 0 ? `+${v}` : v}</span>
}

function Meter({ k, label, value, max, net, color }) {
  const Icon = RES_ICON[k]
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const low = pct < 20
  return (
    <div className={`res res-meter${low ? ' is-low' : ''}`} title={`${label}: ${value}/${max}${net != null ? ` (${net >= 0 ? '+' : ''}${net} next action)` : ''}`}>
      <Icon size={30} className="res-icon" />
      <div className="res-body">
        <div className="res-label">{label}{net != null && <Delta v={net} />}</div>
        <div className="bar"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
        <div className="res-num">{value} / {max}</div>
      </div>
    </div>
  )
}

function Count({ k, label, value, net }) {
  const Icon = RES_ICON[k]
  return (
    <div className="res res-count" title={`${label}: ${value}`}>
      <Icon size={32} className="res-icon" />
      <div className="res-body">
        <div className="res-label">{label}{net ? <Delta v={net} /> : null}</div>
        <div className="res-big">{value.toLocaleString()}</div>
      </div>
    </div>
  )
}

export default function TopBar() {
  const { state } = useGame()
  const ui = useUI()
  const cap = caps(state)
  const { net } = projectProduction(state)
  const r = state.resources
  return (
    <div
      className="topbar panel"
      onClick={() => ui.setPanel('storage')}
      role="button"
      tabIndex={0}
      aria-label="Resources — open storage"
      data-tutorial="topbar-resources"
    >
      <Meter k="energy" label="Energy" value={r.energy} max={cap.energy} net={net.energy} color="linear-gradient(90deg,#f0c53c,#ffe28a)" />
      <Meter k="water" label="Water" value={r.water} max={cap.water} net={net.water} color="linear-gradient(90deg,#3aa2f0,#8fd3ff)" />
      <Meter k="food" label="Food" value={r.food} max={cap.food} net={net.food} color="linear-gradient(90deg,#5fb24f,#a8e08a)" />
      <Meter k="happiness" label="Happiness" value={state.happiness} max={100} color="linear-gradient(90deg,#b796f0,#e6d4ff)" />
      <Count k="wood" label="Wood" value={r.wood} net={net.wood} />
      <Count k="coins" label="Coins" value={r.coins} net={net.coins} />
    </div>
  )
}
