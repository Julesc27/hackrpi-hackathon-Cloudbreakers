import { useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { BUILDINGS, ISLANDS, ROUTE_MAP } from '../../game/data.js'
import { bridgeLabel, islandAccess } from '../../game/engine.js'
import { SiteActions } from '../map/InteractionSites.jsx'
import { Modal } from './Panel.jsx'

export default function GameActions() {
  const { state, player } = useGame(), ui = useUI()
  const [island, setIsland] = useState(player.current.avatar.isl || 'newHaven')
  const access = islandAccess(state), available = Boolean(access[island])
  const buildings = state.buildings.filter(b => b.island === island && BUILDINGS[b.type].buildable !== false)
  return <Modal title="Game actions" kicker="Play without navigating the picture" onClose={() => ui.setPanel(null)}>
    <p>Choose an island and an action. Your captain walks to each job automatically. Supplies are spent when work finishes.</p>
    <label className="actions-island-label">Island<select aria-label="Island" value={island} onChange={event => setIsland(event.target.value)}>{state.discovered.map(id => <option key={id} value={id}>{ISLANDS[id].name}{access[id] ? '' : ' — not reachable'}</option>)}</select></label>
    <p role="status">{available ? `${ISLANDS[island].name} is reachable.` : 'Connect or repair a bridge to reach this island.'}</p>
    <div className="action-stack">
      {player.current.pending && <button className="btn-gold" onClick={() => { player.current.cancel(); ui.setPanel(null) }}>Cancel current task</button>}
      <button className="btn-ghost" onClick={() => ui.openIsland(island)}>Explore {ISLANDS[island].name}</button>
      {available && <><button className="btn-gold" onClick={() => { ui.setPlaceFocus(island); ui.setPanel('build') }}>Build on {ISLANDS[island].name}</button><SiteActions island={island} compact /></>}
    </div>
    {!!buildings.length && <><h3 className="section">Your buildings</h3><div className="action-stack">{buildings.map(b => <button className="btn-ghost" key={b.id} onClick={() => { ui.setSelected(b.id); ui.setPanel(b.type === 'bridgeAnchor' ? 'bridges' : b.type === 'storageHouse' ? 'storageHouse' : 'building') }}>{BUILDINGS[b.type].name}{b.slot >= 0 ? ` · plot ${b.slot+1}` : ' · workshop upgrade'}</button>)}</div></>}
    <h3 className="section">Bridges and supplies</h3>
    <div className="action-stack">
      <button className="btn-ghost" onClick={() => ui.setPanel('bridges')}>Plan island connections</button>
      {state.bridges.filter(b => [ROUTE_MAP[b.route].a,ROUTE_MAP[b.route].b].includes(island)).map(b => <button className="btn-ghost" key={b.route} onClick={() => { ui.setPanel(null); ui.setBridgeRoute(b.route) }}>Manage {bridgeLabel(b.route)} bridge · condition {b.condition}%</button>)}
      <button className="btn-ghost" onClick={() => ui.setPanel('weather')}>Weather and shelter readiness</button>
      <button className="btn-ghost" onClick={() => ui.setPanel('backpack')}>Backpack and depositing</button>
      <button className="btn-ghost" onClick={() => ui.setPanel('storage')}>Town Storage and resource amounts</button>
    </div>
    <p className="muted small">Keyboard: Tab moves between controls, Enter activates them, and Escape closes menus or cancels work. WASD or arrows move the captain when the map has focus; E interacts nearby.</p>
  </Modal>
}
