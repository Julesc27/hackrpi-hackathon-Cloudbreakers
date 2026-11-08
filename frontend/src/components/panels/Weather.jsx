import { useGame, useUI } from '../../game/GameContext.jsx'
import { shelterLevel, shelterCondition, shelterWork, weatherReadiness, constructionResources } from '../../game/engine.js'
import { SHELTER_LEVELS, WEATHER, ISLANDS } from '../../game/data.js'
import { Modal, CostChips, Progress } from './Panel.jsx'
import { WeatherIcon } from '../icons.jsx'

const jobs = count => `${count} job${count === 1 ? '' : 's'}`

export function ShelterCare({ building }) {
  const { state, dispatch } = useGame()
  const level = shelterLevel(building), condition = shelterCondition(building)
  const upgrade = shelterWork(state,building.id), repair = shelterWork(state,building.id,true)
  return <div className="shelter-care">
    <strong>Level {level} · {SHELTER_LEVELS[level].name}</strong>
    <p>{level === 1 ? 'Upgrade to level 2 for rain, heat, crosswinds and drought.' : level === 2 ? 'Protected from ordinary weather. Level 3 protects against solar storms.' : 'Protected against every known weather event.'}</p>
    <label>Condition: {condition}%{condition === 0 && ' · Uninhabitable: 4 beds unavailable'}<Progress value={condition} color={condition ? 'linear-gradient(90deg,#5d9d81,#a8d6ba)' : '#a35440'} /></label>
    <div className="action-stack">
      {upgrade?.next && <button className="btn-gold" disabled={Boolean(upgrade.reason)} title={upgrade.reason || 'Also restores the shelter to full condition'} onClick={() => dispatch({ type:'UPGRADE_SHELTER', buildingId:building.id })}>Upgrade to level {level+1} · {upgrade.next.name} <CostChips cost={upgrade.cost} resources={constructionResources(state)} /></button>}
      {upgrade?.next && upgrade.reason && <small className="muted">{upgrade.reason}</small>}
      {condition < 100 && <><button className="btn-ghost" disabled={Boolean(repair?.reason)} onClick={() => dispatch({ type:'REPAIR_SHELTER', buildingId:building.id })}>Repair shelter <CostChips cost={repair.cost} resources={constructionResources(state)} /></button>{repair?.reason && <small className="muted">{repair.reason}</small>}</>}
    </div>
  </div>
}

export function WeatherWatch() {
  const { state } = useGame(), ui = useUI()
  const cycle = state.weatherCycle, readiness = weatherReadiness(state), w = WEATHER[readiness.key]
  const warning = cycle.phase === 'warning', active = cycle.phase === 'active'
  return <button className={`weather-watch panel weather-${cycle.phase}`} onClick={() => ui.setPanel('weather')} aria-label="Weather and shelter readiness" data-tutorial="weather-watch">
    <WeatherIcon kind={w.icon} size={23} />
    <span><strong>{warning ? `${w.name} in ${jobs(cycle.remaining)}` : active ? `${w.name} · ${jobs(cycle.remaining)} left` : 'Clear skies · preparation time'}</strong>
      <small>{warning || active ? `Level ${readiness.required} shelters needed · ${readiness.ready}/${readiness.total} ready` : `${cycle.remaining} calm jobs before the next warning`}</small></span>
    <span aria-hidden="true">›</span>
  </button>
}

export function WeatherModal() {
  const { state } = useGame(), ui = useUI()
  const { key, required, ready, total } = weatherReadiness(state), cycle = state.weatherCycle
  const shelters = state.buildings.filter(b => b.type === 'shelter')
  return <Modal title="Weather readiness" kicker="Prepare your town" onClose={() => ui.setPanel(null)} size="lg">
    <div className={`weather-summary weather-${cycle.phase}`} role="status">
      <h3>{WEATHER[key].name}</h3>
      <p>{cycle.phase === 'warning' ? `Arrives after ${jobs(cycle.remaining)}. ${ready} of ${total} shelters meet level ${required} protection.` : cycle.phase === 'active' ? `${jobs(cycle.remaining)} until clear skies. ${ready} of ${total} shelters meet level ${required} protection.` : `${cycle.remaining} calm jobs before the next warning. Use this time to upgrade homes and rebuild supplies.`}</p>
      <p>{WEATHER[key].text}</p>
    </div>
    <h3 className="section">Your shelters</h3>
    {!shelters.length && <p>Build your first shelter from the Build menu.</p>}
    {shelters.map(b => <section className="weather-home" key={b.id}><h4>{ISLANDS[b.island].name} · plot {b.slot+1}</h4><ShelterCare building={b} /></section>)}
    <details className="weather-rules"><summary>Weather rules and preparation</summary>
      <p>Weather advances only when gathering, building, upgrading or repairing finishes. Walking, menus, depositing and being offline do not advance it.</p>
      <p>Warnings last 6 jobs; events last 5 jobs. After an event, there are 12–20 calm jobs before another warning. New towns get 24 calm jobs.</p>
      <p>Level 2 homes withstand ordinary weather; level 3 homes also withstand solar storms. Solar storms begin only after two events, at player level 5 with Prism Shelf connected.</p>
      <p className="warn-text">Underprepared homes lose 20 condition per job (25 during solar storms), and residents lose happiness. At 0%, a home loses its 4 beds until repaired or upgraded. Upgrading also restores full condition. Repairs do not raise protection, so weather can damage an unprepared home again.</p>
      <p>Keep food, water and energy in reserve, and check bridge condition. The older homes already painted into the islands are weather-ready.</p>
    </details>
  </Modal>
}
