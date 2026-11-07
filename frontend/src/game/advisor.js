// Cloud's advice follows the four-island resource loop and never mutates game state.
import { ISLANDS, BUILDINGS, BEACON_COST } from './data.js'
import { projectProduction, actionsOfSupply, hasAnchor, countType, openRoutes, otherEnd, bridgeCost, canAfford, getLevelInfo } from './engine.js'

export function getAdvice(state) {
  const projection = projectProduction(state)
  const situation = `Level ${getLevelInfo(state.xp).level}. ${state.population} residents. Starter timber: ${state.deposits.wood}. Stone deposits: ${state.deposits.stone}.`
  const tips = []
  const add = (recommendation, reason, tradeoff, confidence = 88, extra = {}) => tips.push({ situation, recommendation, reason, tradeoff, confidence, alternative: null, ...extra })
  const connect = (id, reason, confidence) => {
    const route = openRoutes(state).find((r) => otherEnd(r, state.connected) === id)
    if (!route) return
    const cost = bridgeCost(route, 'rope')
    add(`Connect to ${ISLANDS[id].name}`, reason, `The bridge costs ${cost.wood} wood.`, confidence, { routeId: route.id, art: id })
  }
  if (!countType(state, 'shelter')) add('Build a Shelter', 'The first families need a home. Choose an empty stone terrace on New Haven.', 'A shelter uses 10 wood and 2 stone.', 98, { art: 'shelter' })
  if (!hasAnchor(state)) add('Unlock bridges in the workshop', 'The workshop prepares the first crossing. The anchor upgrade opens routes to the resource islands without occupying a plot.', 'Reserve 8 wood and 4 stone for the anchor.', 96, { art: 'bridgeAnchor' })
  if (!state.connected.includes('verdant')) connect('verdant', `New Haven has only ${state.deposits.wood} timber left. Verdant Reach supplies renewable wood, food, seeds and building materials.`, 94)
  if (actionsOfSupply(state, 'water') <= 4 || state.connected.includes('verdant')) connect('rain', 'Rain Island supplies fresh water, fish and stone. Its waterfalls can support more homes and gardens.', 92)
  if (projection.net.food < 0 && canAfford(state.resources, BUILDINGS.garden.cost) && getLevelInfo(state.xp).level >= 2) add('Plant a Food Garden', 'Food use is outpacing the starter garden. Seeds from Verdant Reach can fill another terrace with crops.', 'A garden uses 6 wood, 1 seed and water for upkeep.', 91, { art: 'garden' })
  if (state.connected.includes('verdant') || getLevelInfo(state.xp).level >= 3) connect('prism', 'Prism Shelf supplies energy crystals and components for solar farms, batteries and advanced buildings.', 86)
  if (state.deposits.stone > 0 && state.resources.stone < 4) add('Mine the starter stone deposit', 'The small stone outcrop provides material for shelters and your first bridge anchor.', 'This deposit is finite. Rain Island and Prism Shelf provide ongoing stone.', 90)
  if (!state.beaconRestored && state.bridges.length && canAfford(state.resources, BEACON_COST)) add('Restore the beacon', 'The navigation beacon marks the home island and completes its story mission.', 'It uses 20 wood and 10 energy.', 82)
  if (state.connected.includes('prism') && !countType(state, 'solarFarm')) add('Build a Solar Farm', 'Use Prism Shelf crystals and components to generate clean power on a free plot.', 'Needs level 3, 3 crystals and 2 building materials as well as wood and coins.', 84, { art: 'solarFarm' })
  if (!tips.length) add('Keep the settlement balanced', 'Gather from the forest, waterfalls and crystal shelf, and use the workshop to expand your town.', 'More homes also increase food and water needs.', 80)
  return tips
}
