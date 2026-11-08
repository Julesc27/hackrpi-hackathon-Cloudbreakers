// What the player can actually do right now, judged by the real game rules.
//
// Consult the Gods sends this list with the town, and the gods may only advise one of these
// moves (backend/app/oracle.py checks their answer). Each candidate is tried with the reducer on a
// copy of the town after paying for the consultation, so the advice is still affordable once the
// gods have been paid. Nothing here changes the player's town.
//
// The names match the gods' "focus" words: a building key (build one), an island id (bridge to
// it), or "gather", "beacon", "repair" and "balance" (keep things steady: always possible).
import { BUILDINGS, CONSULT_COST, GATHER_SITES, ISLANDS, ROUTE_MAP } from './data.js'
import { backpackUsed, canAfford, gameReducer, gatherAvailability, islandAccess, openRoutes } from './engine.js'

const pay = (resources, cost) => {
  const out = { ...resources }
  for (const [key, value] of Object.entries(cost)) out[key] = (out[key] || 0) - value
  return out
}

function canBuild(state, type) {
  const def = BUILDINGS[type]
  if (!def || def.buildable === false) return false
  if (def.infrastructure) {
    return gameReducer(state, { type: 'BUILD', buildingType: type, island: 'newHaven' }).buildings.length > state.buildings.length
  }
  const access = islandAccess(state)
  for (const [island, isl] of Object.entries(ISLANDS)) {
    if (!state.connected.includes(island) || !access[island]) continue
    for (let slot = 0; slot < (isl.plots || []).length; slot++) {
      if (gameReducer(state, { type: 'BUILD', buildingType: type, island, slot }).buildings.length > state.buildings.length) return true
    }
  }
  return false
}

export function possibleMoves(state, now = Date.now()) {
  // judge the town as it will be once the gods are paid
  const after = canAfford(state.resources, CONSULT_COST) ? { ...state, resources: pay(state.resources, CONSULT_COST) } : state
  const moves = []
  for (const type of Object.keys(BUILDINGS)) if (canBuild(after, type)) moves.push(type)
  for (const route of openRoutes(after)) {
    const built = gameReducer(after, { type: 'BUILD_BRIDGE', routeId: route.id, bridgeType: 'rope' })
    const r = ROUTE_MAP[route.id]
    if (built.bridges.length > after.bridges.length) moves.push(after.connected.includes(r.a) ? r.b : r.a)
  }
  if (Object.keys(GATHER_SITES).some((id) => !gatherAvailability(after, id, now)) || backpackUsed(after) > 0) moves.push('gather')
  if (gameReducer(after, { type: 'RESTORE_BEACON' }).beaconRestored && !after.beaconRestored) moves.push('beacon')
  if (after.bridges.some((b) => b.condition < 100 && gameReducer(after, { type: 'REPAIR_BRIDGE', routeId: b.route }).bridges
    .find((x) => x.route === b.route).condition > b.condition)) moves.push('repair')
  moves.push('balance')
  return [...new Set(moves)]
}
