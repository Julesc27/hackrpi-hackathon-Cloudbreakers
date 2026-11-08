import { useGame, useUI } from '../../game/GameContext.jsx'
import { removalInfo } from '../../game/engine.js'
import { BUILDINGS, ISLANDS, RESOURCES } from '../../game/data.js'
import { Modal, YieldChips } from './Panel.jsx'
import { ShelterCare } from './Weather.jsx'
import { shelterCondition } from '../../game/engine.js'

export function RemoveButton({ buildingId, routeId }) {
  const { state } = useGame(), ui = useUI()
  const info = removalInfo(state,{ buildingId, routeId })
  if (!info || info.reason === 'Starter scenery cannot be removed.') return null
  return <button className="btn-ghost" onClick={() => {
    ui.setRemoving({ buildingId, routeId, previousPanel: ui.panel, previousRoute: ui.bridgeRoute })
    ui.setBridgeRoute(null); ui.setPanel('remove')
  }}>Remove {info.name}</button>
}

export function RemovalModal() {
  const { state, dispatch } = useGame(), ui = useUI()
  const target = ui.removing, info = removalInfo(state,target)
  const cancel = () => { ui.setPanel(target?.previousPanel || null); ui.setBridgeRoute(target?.previousRoute || null); ui.setRemoving(null) }
  if (!info) return <Modal title="Item already removed" onClose={cancel}><p>This item is no longer on the map.</p><button className="btn-gold" onClick={cancel}>Close</button></Modal>
  return <Modal title={`Remove ${info.name}?`} kicker="Recover construction supplies" onClose={cancel}>
    <p>Recover <strong>50% of each construction resource</strong>, rounded down, into Town Storage.</p>
    <h3 className="section">You will receive</h3>
    <div className="chips">{Object.entries(info.refund).map(([key,value]) => <span key={key} className="chip chip-yield">+{value} {RESOURCES[key].label}</span>)}{!Object.keys(info.refund).length && <span className="muted">No supplies recoverable.</span>}</div>
    {info.bedLoss > 0 && <p className="warn-text">Removes {info.bedLoss} beds. Residents remain in your town.</p>}
    {Object.keys(info.overflow).length > 0 && <p className="warn-text">The lower capacity will discard: {Object.entries(info.overflow).map(([key,value]) => `${value} ${RESOURCES[key].label.toLowerCase()}`).join(', ')}.</p>}
    {info.lostIslands.length > 0 && <p className="warn-text">Disconnects {info.lostIslands.map(id => ISLANDS[id].name).join(', ')}. Their buildings remain, and you can rebuild the bridge later. Your captain returns to New Haven before dismantling.</p>}
    <p className="muted small">Removing an item frees its space. You can cancel the work before it finishes. Repairs and upkeep are not refunded.</p>
    {info.reason && <p className="warn-text" role="status">{info.reason}</p>}
    <div className="row-btns"><button className="btn-ghost" onClick={cancel}>Keep it</button><button className="btn-gold" disabled={Boolean(info.reason)} onClick={() => dispatch(target.buildingId ? { type: 'REMOVE_BUILDING', buildingId: target.buildingId } : { type: 'REMOVE_BRIDGE', routeId: target.routeId })}>Remove and recover supplies</button></div>
  </Modal>
}

export function BuildingModal() {
  const { state } = useGame(), ui = useUI()
  const building = state.buildings.find(b => b.id === ui.selected)
  if (!building) return null
  const def = BUILDINGS[building.type]
  return <Modal title={def.name} kicker={ISLANDS[building.island].name} onClose={() => ui.setPanel(null)}>
    <p>{def.desc}</p>
    {def.prod && <p>Production <YieldChips yields={def.prod} /></p>}
    {def.housing && <p>Provides {building.type === 'shelter' && shelterCondition(building) === 0 ? 0 : def.housing} beds.</p>}
    {building.type === 'shelter' && <ShelterCare building={building} />}
    <RemoveButton buildingId={building.id} />
  </Modal>
}
