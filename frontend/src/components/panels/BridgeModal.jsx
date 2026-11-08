import { useGame, useUI } from '../../game/GameContext.jsx'
import { ISLANDS, ROUTE_MAP, BRIDGE_TYPES, REPAIR_COST } from '../../game/data.js'
import { bridgeCost, canAfford, hasAnchor, isUnlocked, otherEnd, unlockLevel, bridgeStatus } from '../../game/engine.js'
import { Modal, CostChips, YieldChips, Progress } from './Panel.jsx'
import { Lock } from '../icons.jsx'
import IslandArt from '../IslandArt.jsx'
import { RemoveButton } from './Removal.jsx'

function Stat({ label, value, max = 100, suffix = '%', color }) {
  return (
    <div className="stat">
      <div className="stat-top"><span>{label}</span><strong>{value}{suffix}</strong></div>
      <Progress value={value} max={max} color={color} />
    </div>
  )
}

export default function BridgeModal() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const route = ROUTE_MAP[ui.bridgeRoute]
  if (!route) return null
  const close = () => ui.setBridgeRoute(null)
  const existing = state.bridges.find((b) => b.route === route.id)

  if (existing) {
    const t = BRIDGE_TYPES[existing.type]
    const st = bridgeStatus(existing)
    const full = bridgeCost(route, 'reinforced')
    const upCost = { wood: Math.ceil(full.wood / 2), coins: full.coins, stone: full.stone }
    return (
      <Modal title={`${ISLANDS[route.a].name} ↔ ${ISLANDS[route.b].name}`} kicker={`${t.name} bridge · built at level ${existing.builtLevel}`} onClose={close}>
        <RemoveButton routeId={route.id} />
        <Stat label="Condition" value={existing.condition} color={st === 'good' ? 'linear-gradient(90deg,#5fb24f,#a8e08a)' : 'linear-gradient(90deg,#ff7a4b,#ffb38f)'} />
        <Stat label="Stability in storms" value={t.stability} color="linear-gradient(90deg,#7fb8ff,#cfe4ff)" />
        <Stat label="Capacity" value={t.capacity} max={8} suffix=" carts" color="linear-gradient(90deg,#e3b84f,#ffe28a)" />
        <p className="muted small">
          {st === 'closed' ? 'Closed — the island beyond produces nothing until repaired.' : st === 'strained' ? 'Strained — islands beyond produce at half strength.' : 'Holding steady.'}
        </p>
        <div className="row-btns">
          <button className="btn-gold" disabled={existing.condition >= 100 || !canAfford(state.resources, REPAIR_COST)} onClick={() => { dispatch({ type: 'REPAIR_BRIDGE', routeId: route.id }); close() }}>
            Repair <CostChips cost={REPAIR_COST} resources={state.resources} />
          </button>
          {existing.type === 'rope' && (
            <button
              className="btn-ghost"
              disabled={!isUnlocked(state, 'reinforced') || !canAfford(state.resources, upCost)}
              onClick={() => { dispatch({ type: 'UPGRADE_BRIDGE', routeId: route.id }); close() }}
            >
              {isUnlocked(state, 'reinforced') ? <>Reinforce <CostChips cost={upCost} resources={state.resources} /></> : <><Lock size={14} /> Reinforce at level {unlockLevel('reinforced')}</>}
            </button>
          )}
        </div>
      </Modal>
    )
  }

  const dest = otherEnd(route, state.connected)
  const from = dest === route.a ? route.b : route.a
  const anchor = hasAnchor(state)

  return (
    <Modal title={`Bridge to ${ISLANDS[dest].name}`} kicker={`From ${ISLANDS[from].name}`} onClose={close} size="lg" crest={false}>
      <div className="bridge-hero"><IslandArt id={dest} /></div>
      <p className="lead">{route.note} <span className="muted">{ISLANDS[dest].kind} — produces</span> <YieldChips yields={ISLANDS[dest].yields} />{ISLANDS[dest].special === 'forecast' && <span className="muted"> + forecasts</span>}</p>
      {!anchor && <p className="warn-text">You need a Bridge Anchor on New Haven before any bridge can be built. Open Build to place one.</p>}
      <div className="bridge-options">
        {Object.entries(BRIDGE_TYPES).map(([key, t]) => {
          const cost = bridgeCost(route, key)
          const unlocked = isUnlocked(state, key)
          const affordable = canAfford(state.resources, cost)
          const disabled = !anchor || !unlocked || !affordable
          const why = !anchor ? 'Needs anchor' : !unlocked ? `Level ${unlockLevel(key)}` : !affordable ? 'Not enough resources' : null
          return (
            <div key={key} className={`bridge-option card${!unlocked ? ' is-locked' : ''}`}>
              <h3>{t.name}</h3>
              <p className="muted small">{t.desc}</p>
              <div className="kv"><span>Cost</span><CostChips cost={cost} resources={state.resources} /></div>
              <Stat label="Stability" value={t.stability} color="linear-gradient(90deg,#7fb8ff,#cfe4ff)" />
              <Stat label="Capacity" value={t.capacity} max={8} suffix=" carts" color="linear-gradient(90deg,#e3b84f,#ffe28a)" />
              <div className="small muted">Island output {Math.round(t.yieldMult * 100)}%</div>
              <button
                className="btn-gold full"
                disabled={disabled}
                onClick={() => { dispatch({ type: 'BUILD_BRIDGE', routeId: route.id, bridgeType: key }); close() }}
              >
                {why ? <>{!unlocked && <Lock size={14} />} {why}</> : 'Build bridge'}
              </button>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
