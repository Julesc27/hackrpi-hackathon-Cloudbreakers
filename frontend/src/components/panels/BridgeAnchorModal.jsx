import { useGame, useUI } from '../../game/GameContext.jsx'
import { BRIDGE_TYPES, ISLANDS } from '../../game/data.js'
import { bridgeCost, bridgeLabel, canAffordConstruction, constructionResources, hasAnchor, openRoutes, otherEnd } from '../../game/engine.js'
import { Modal, CostChips } from './Panel.jsx'
import IslandArt from '../IslandArt.jsx'

export default function BridgeAnchorModal() {
  const { state } = useGame()
  const ui = useUI()
  const active = hasAnchor(state)
  const routes = openRoutes(state)
  const select = (id) => { ui.setPanel(null); ui.setBridgeRoute(id) }
  return (
    <Modal title="Bridge routes" kicker={active ? 'Workshop upgrade active · plan your crossings' : 'Build an anchor to connect islands'} onClose={() => ui.setPanel(null)} size="lg">
      <p className="anchor-explanation">The anchor is a workshop upgrade that unlocks crossings from New Haven. It uses no island plot. Choose a destination, then choose and pay for a bridge to build it.</p>
      {!active ? (
        <button className="btn-gold" onClick={() => { ui.setPlaceFocus('newHaven'); ui.setPanel('build') }}>Unlock bridges in the workshop</button>
      ) : (
        <>
          <h3 className="section">New crossings</h3>
          {routes.length === 0 && <p className="muted">All available islands are connected. You can inspect, reinforce or repair your bridges below.</p>}
          <div className="anchor-route-list">
            {routes.map((route) => {
              const destination = ISLANDS[otherEnd(route, state.connected)]
              const cost = bridgeCost(route, 'rope')
              return (
                <article className="anchor-route card" key={route.id}>
                  <IslandArt id={otherEnd(route, state.connected)} />
                  <h3>{destination.name}</h3>
                  <div className="muted small">{destination.kind}</div>
                  <p>{route.note}</p>
                  <div className="anchor-route-cost"><span>Rope bridge</span><CostChips cost={cost} resources={constructionResources(state)} /></div>
                  {!canAffordConstruction(state, cost) && <p className="small warn-text">Gather more supplies to afford this crossing.</p>}
                  <button className="btn-gold full" onClick={() => select(route.id)}>Plan bridge to {destination.name}</button>
                </article>
              )
            })}
          </div>
          {state.bridges.length > 0 && (
            <>
              <h3 className="section">Your bridges</h3>
              <div className="anchor-built-list">
                {state.bridges.map((bridge) => <button className="btn-action" key={bridge.route} onClick={() => select(bridge.route)}>
                  <span>{bridgeLabel(bridge.route)}</span>
                  <small>{BRIDGE_TYPES[bridge.type].name} · {bridge.condition}% condition · inspect / repair</small>
                </button>)}
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}
