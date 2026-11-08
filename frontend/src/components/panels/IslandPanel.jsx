import { useGame, useUI } from '../../game/GameContext.jsx'
import { ISLANDS, BUILDINGS, ROUTES, BEACON_COST, GATHER_AMOUNT, HARVEST } from '../../game/data.js'
import { islandAccess, openRoutes, otherEnd, canAfford, hasAnchor } from '../../game/engine.js'
import { Drawer, CostChips, YieldChips } from './Panel.jsx'
import { SiteActions } from '../map/InteractionSites.jsx'
import IslandArt from '../IslandArt.jsx'
import { RemoveButton } from './Removal.jsx'

export default function IslandPanel() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const id = ui.selected

  if (!id) return null

  const def = ISLANDS[id]
  const status = state.connected.includes(id)
    ? 'connected'
    : state.discovered.includes(id)
      ? 'discovered'
      : 'hidden'

  const access = islandAccess(state)
  const close = () => {
    ui.setPanel(null)
    ui.setSelected(null)
  }

  if (status === 'hidden') {
    return (
      <Drawer side="right" title="Uncharted island" kicker="Beyond the clouds" onClose={close}>
        <p>
          Something drifts out there, too far to make out. Connect a neighbouring island
          — or restore the beacon — to chart it.
        </p>
      </Drawer>
    )
  }

  const buildings = state.buildings.filter((b) => b.island === id)
  const freeSlots = def.plots.length - buildings.filter((b) => b.slot >= 0 && !BUILDINGS[b.type].infrastructure).length
  const route = openRoutes(state).find((r) => otherEnd(r, state.connected) === id)

  const statusText =
    status === 'discovered'
      ? 'Not connected'
      : access[id] === 1
        ? 'Connected'
        : access[id]
          ? 'Bridge strained — half output'
          : 'Cut off — repair the bridge'

  return (
    <Drawer side="right" title={def.name} kicker={def.kind} onClose={close}>
      <IslandArt id={id} className="island-art" />
      <div className={`status-chip status-${status === 'connected' ? (access[id] === 1 ? 'ok' : 'warn') : 'locked'}`}>{statusText}</div>
      <p>{def.desc}</p>
      <blockquote className="question">{def.question}</blockquote>

      {id !== 'newHaven' && (
        <div className="kv">
          <span>Produces</span>
          <YieldChips yields={def.yields} />
          {def.special === 'forecast' && (
            <span className="muted small">+ weather forecasts</span>
          )}
        </div>
      )}

      {status === 'connected' && (
        <>
          <div className="action-stack" style={{ marginTop: '10px' }}>
            <SiteActions island={id} />
          </div>

          <h3 className="section">
            Buildings <span className="muted">· {freeSlots} free plot{freeSlots === 1 ? '' : 's'}</span>
          </h3>

          {buildings.length === 0 && (
            <p className="muted">Nothing built here yet.</p>
          )}

          <ul className="building-list">
            {buildings.map((b) => (
              <li key={b.id}>
                {b.type === 'bridgeAnchor' ? <button className="link" onClick={() => ui.setPanel('bridges')}>Bridge Anchor · manage crossings</button> : b.type === 'storageHouse' ? <button className="link" onClick={() => { ui.setSelected(b.id); ui.setPanel('storageHouse') }}>Storage House · capacity and unloading</button> : <span>{BUILDINGS[b.type].name}</span>}
                {BUILDINGS[b.type].prod && <YieldChips yields={BUILDINGS[b.type].prod} />}
                <RemoveButton buildingId={b.id} />
              </li>
            ))}
          </ul>

          <div className="action-stack">
            {id === 'newHaven' && !state.beaconRestored && (
              <button
                className="btn-action"
                disabled={!canAfford(state.resources, BEACON_COST)}
                onClick={() => dispatch({ type: 'RESTORE_BEACON' })}
              >
                <span>Restore the beacon</span>
                <small>
                  <CostChips cost={BEACON_COST} resources={state.resources} />
                </small>
              </button>
            )}

            {freeSlots > 0 && (
              <button className="btn-action" onClick={() => { ui.setPlaceFocus(id); ui.setPanel('build') }}>
                <span>Build on {def.name}</span><small>{freeSlots} open plot{freeSlots === 1 ? '' : 's'} on this island</small>
              </button>
            )}
          </div>
        </>
      )}

      {status === 'discovered' && (
        <>
          <h3 className="section">Getting there</h3>

          {route ? (
            <>
              <p>
                A bridge from <strong>{ISLANDS[otherEnd(route, [id])].name}</strong> would reach it. {route.note}
              </p>

              {!hasAnchor(state) && (
                <p className="warn-text">
                  Choose Unlock bridges in the workshop first.
                </p>
              )}

              <button
                className="btn-gold"
                onClick={() => ui.setBridgeRoute(route.id)}
              >
                Plan a bridge
              </button>
            </>
          ) : (
            <p className="muted">
              No route yet. Connect a neighbouring island first.
            </p>
          )}

          <p className="muted small">
            Routes: {ROUTES
              .filter((r) => r.a === id || r.b === id)
              .map((r) => ISLANDS[r.a === id ? r.b : r.a].name)
              .join(', ')}
          </p>
        </>
      )}
    </Drawer>
  )
}
