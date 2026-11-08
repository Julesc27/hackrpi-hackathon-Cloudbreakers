// Cloud's advice follows the four-island resource loop and never mutates game state.
// Each tip has a `focus` using the same words as the gods (backend/app/oracle.py FOCUSES),
// so Cloud can notice when the gods have said something different.
import { ISLANDS, BUILDINGS, BEACON_COST, WEATHER } from './data.js'
import { projectProduction, actionsOfSupply, hasAnchor, countType, openRoutes, otherEnd, bridgeCost, canAffordConstruction, getLevelInfo, weatherReadiness, shelterCondition } from './engine.js'
import { viewDeposit } from './deposits.js'

export function getAdvice(state) {
  const projection = projectProduction(state)
  const timber = viewDeposit(state.deposits, 'grove').stock
  const stone = viewDeposit(state.deposits, 'stone').stock
  const situation = `Level ${getLevelInfo(state.xp).level}. ${state.population} residents. Starter timber: ${timber}. Stone deposits: ${stone}.`
  const tips = []
  const add = (recommendation, reason, tradeoff, confidence = 88, extra = {}) => tips.push({ situation, recommendation, reason, tradeoff, confidence, alternative: null, ...extra })
  const readiness = weatherReadiness(state)
  if (state.weatherCycle?.phase !== 'calm' && readiness.vulnerable) add(`Prepare level ${readiness.required} shelters`, `${WEATHER[readiness.key].name}: ${readiness.vulnerable} homes need protection. Open Weather readiness to upgrade them before they lose condition.`, 'Upgrades use wood and stone; stormproof homes also use building materials.', 99, { art:'shelter', focus:'shelter' })
  else if (state.buildings.some(b => b.type === 'shelter' && shelterCondition(b) === 0)) add('Repair uninhabitable shelters', 'Damaged homes cannot house residents until repaired or upgraded. Open their panels to restore the beds.', 'Repairs use 4 wood and 2 stone.', 99, { art:'shelter', focus:'shelter' })
  const connect = (id, reason, confidence) => {
    const route = openRoutes(state).find((r) => otherEnd(r, state.connected) === id)
    if (!route) return
    const cost = bridgeCost(route, 'rope')
    add(`Connect to ${ISLANDS[id].name}`, reason, `The bridge costs ${cost.wood} wood.`, confidence, { routeId: route.id, art: id, focus: id })
  }
  if (!countType(state, 'shelter')) add('Build a Shelter', 'The first families need a home. Choose an empty stone terrace on New Haven.', 'A shelter uses 10 wood and 2 stone.', 98, { art: 'shelter', focus: 'shelter' })
  if (!hasAnchor(state)) add('Unlock bridges in the workshop', 'The workshop prepares the first crossing. The anchor upgrade opens routes to the resource islands without occupying a plot.', 'Reserve 8 wood and 4 stone for the anchor.', 96, { art: 'bridgeAnchor', focus: 'bridgeAnchor' })
  if (!state.connected.includes('verdant')) connect('verdant', `New Haven has ${timber} timber in the grove. Verdant Reach holds a larger stand of wood, food, seeds and building materials, and it regrows after a rest.`, 94)
  if (actionsOfSupply(state, 'water') <= 4 || state.connected.includes('verdant')) connect('rain', 'Rain Island supplies fresh water, fish and stone. Its waterfalls can support more homes and gardens.', 92)
  if (projection.net.food < 0 && canAffordConstruction(state, BUILDINGS.garden.cost) && getLevelInfo(state.xp).level >= 2) add('Plant a Food Garden', 'Food use is outpacing the starter garden. Seeds from Verdant Reach can fill another terrace with crops.', 'A garden uses 6 wood, 1 seed and water for upkeep.', 91, { art: 'garden', focus: 'garden' })
  if (state.connected.includes('verdant') || getLevelInfo(state.xp).level >= 3) connect('prism', 'Prism Shelf supplies energy crystals and components for solar farms, batteries and advanced buildings.', 86)
  if (stone > 0 && state.resources.stone < 4) add('Mine the starter stone deposit', 'The small stone outcrop provides material for shelters and your first bridge anchor.', 'The outcrop regrows after it is mined out. Rain Island and Prism Shelf hold more stone.', 90, { focus: 'gather' })
  if (!state.beaconRestored && state.bridges.length && canAffordConstruction(state, BEACON_COST)) add('Restore the beacon', 'The navigation beacon marks the home island and completes its story mission.', 'It uses 20 wood and 10 energy.', 82, { focus: 'beacon' })
  if (state.connected.includes('prism') && !countType(state, 'solarFarm')) add('Build a Solar Farm', 'Use Prism Shelf crystals and components to generate clean power on a free plot.', 'Needs level 3, 3 crystals and 2 building materials as well as wood and coins.', 84, { art: 'solarFarm', focus: 'solarFarm' })
  if (!tips.length) add('Keep the settlement balanced', 'Gather from the forest, waterfalls and crystal shelf, and use the workshop to expand your town.', 'More homes also increase food and water needs.', 80, { focus: 'balance' })
  return tips
}

// The gods' last word goes stale once the town has moved on this much.
export const GODS_FRESH_XP = 200

// What Cloud says about the gods next to `tip`. `link` is shown as a button to the Store.
export function godsWord(state, tip) {
  const o = state.oracle
  const fresh = o?.focus && state.xp - (o.xp ?? 0) < GODS_FRESH_XP
  if (!fresh) return { kind: 'nudge', text: 'I’m only a cloud. The gods see the rules beneath the sky.', link: 'Consult them in the Store' }
  if (tip?.focus === o.focus) return { kind: 'agree', text: 'Even the gods agree with me. Ha!' }
  return { kind: 'differ', text: 'The gods spoke of something else… perhaps they know better.', link: 'Ask them again in the Store' }
}
