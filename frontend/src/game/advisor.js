// Cloud, the advisor. For now this is a local rule-based stand-in.
// Later, the backend can return the same shape from an AI model via
// api/client.js -> getAdvice(). The advisor never changes game state.
import { ISLANDS, BEACON_COST } from './data.js'
import {
  projectTurn, turnsOfSupply, hasAnchor, countType, housing, openRoutes, otherEnd,
  bridgeCost, canAfford, activeMissions, isUnlocked, bridgeLabel,
} from './engine.js'

const fmtTurns = (n) => (n === Infinity ? 'stable' : `${n} turn${n === 1 ? '' : 's'}`)

export function getAdvice(state) {
  const proj = projectTurn(state)
  const water = turnsOfSupply(state, 'water')
  const food = turnsOfSupply(state, 'food')
  const routes = openRoutes(state)
  const routeTo = (id) => routes.find((r) => otherEnd(r, state.connected) === id)
  const situation = `Turn ${state.turn}. ${state.population} residents. Water: ${fmtTurns(water)}. Food: ${fmtTurns(food)}. Energy ${state.resources.energy}.`
  const out = []

  const damaged = state.bridges.filter((b) => b.condition < 40)
  if (damaged.length) {
    out.push({
      situation,
      recommendation: `Repair ${bridgeLabel(damaged[0].route)}.`,
      reason: `It is at ${damaged[0].condition}% condition, so the island beyond it is producing at half strength or not at all.`,
      tradeoff: 'Costs 6 wood and an action you could spend expanding.',
      confidence: 90,
      alternative: 'If wood is tight, wait for clear skies — storms will only damage it further, though.',
    })
  }

  if (!countType(state, 'shelter')) {
    out.push({
      situation,
      recommendation: 'Build a Shelter on New Haven.',
      reason: 'Residents are sleeping under canvas. A shelter adds room for 4 more people and completes First Steps.',
      tradeoff: 'Uses 10 of your 24 wood, which delays the bridge anchor slightly.',
      confidence: 92,
      alternative: 'Build the Bridge Anchor first if you want to reach another island one turn sooner.',
    })
  }

  if (!hasAnchor(state)) {
    out.push({
      situation,
      recommendation: 'Build a Bridge Anchor.',
      reason: 'Every bridge starts from it. Without one, the nearby islands stay out of reach.',
      tradeoff: '8 wood now means one more round of gathering before the first bridge.',
      confidence: 88,
      alternative: 'Gather wood first so you can build the anchor and a bridge back-to-back.',
    })
  }

  if (hasAnchor(state) && state.bridges.length === 0) {
    const rain = routeTo('rain')
    const prism = routeTo('prism')
    const verdant = routeTo('verdant')
    const pickRain = water <= food && water !== Infinity
    const target = pickRain ? rain : verdant
    const tId = pickRain ? 'rain' : 'verdant'
    if (target) {
      const cost = bridgeCost(target, 'rope').wood
      out.push({
        situation,
        recommendation: `Connect to ${ISLANDS[tId].name}.`,
        reason: pickRain
          ? `Your water reserve will last ${fmtTurns(water)}, and new residents will drink more.`
          : `Wood is your bottleneck. Verdant Reach adds wood and food every turn and is the cheapest crossing (${cost} wood).`,
        tradeoff: pickRain
          ? 'The water route delays Prism Shelf, which would unlock better energy.'
          : 'Harvesting the forest too hard will lower sustainability.',
        confidence: pickRain ? 86 : 82,
        alternative: prism ? `Prism Shelf (${bridgeCost(prism, 'rope').wood} wood) gives energy, which you will need to restore the beacon.` : null,
      })
      if (state.resources.wood < cost) {
        out.push({
          situation,
          recommendation: 'Gather wood on New Haven.',
          reason: `You have ${state.resources.wood} wood and the bridge needs ${cost}.`,
          tradeoff: 'Gathering spends actions you could use to build.',
          confidence: 80,
          alternative: null,
        })
      }
    }
  }

  if (water !== Infinity && water <= 3) {
    const r = routeTo('rain')
    out.push({
      situation,
      recommendation: r ? 'Bridge to Rain Island.' : isUnlocked(state, 'waterCollector') ? 'Build a Water Collector.' : 'Prioritise water.',
      reason: `Water runs out in ${fmtTurns(water)}. A shortage costs 6 happiness per turn and residents will leave.`,
      tradeoff: 'Spending on water slows energy and housing.',
      confidence: 90,
      alternative: 'Avoid growing the population until water is stable.',
    })
  }
  if (food !== Infinity && food <= 3) {
    out.push({
      situation,
      recommendation: isUnlocked(state, 'garden') ? 'Build a Food Garden.' : 'Connect Verdant Reach for food.',
      reason: `Food runs out in ${fmtTurns(food)}.`,
      tradeoff: 'Gardens use 1 water per turn.',
      confidence: 85,
      alternative: null,
    })
  }

  if (state.population >= housing(state)) {
    out.push({
      situation,
      recommendation: 'Build another Shelter.',
      reason: `All ${housing(state)} beds are taken, so the population cannot grow.`,
      tradeoff: 'More residents means more food and water every turn.',
      confidence: 70,
      alternative: 'Staying small is valid too — a quiet Skystead is a sustainable one.',
    })
  }

  if (state.bridges.length && !state.beaconRestored) {
    const ok = canAfford(state.resources, BEACON_COST)
    out.push({
      situation,
      recommendation: 'Restore the navigation beacon.',
      reason: 'It reveals the whole sky map and wakes me up properly. I have been napping for years.',
      tradeoff: ok ? 'Takes 20 wood and 10 energy.' : `You need ${BEACON_COST.wood} wood and ${BEACON_COST.energy} energy first.`,
      confidence: ok ? 84 : 65,
      alternative: 'Connect Prism Shelf first so energy is not a worry.',
    })
  }

  if (proj.net.energy <= 0 && state.bridges.length && !isUnlocked(state, 'solarFarm')) {
    const p = routeTo('prism')
    if (p) {
      out.push({
        situation,
        recommendation: 'Connect Prism Shelf.',
        reason: 'You produce no energy yet. Crystals provide 6 energy each turn.',
        tradeoff: 'Solar storms halve crystal output.',
        confidence: 78,
        alternative: null,
      })
    }
  }

  const next = activeMissions(state)[0]
  out.push({
    situation,
    recommendation: next ? `Work toward "${next.name}".` : 'Hold steady and enjoy the view.',
    reason: next ? next.objective : 'Everything is balanced. That is the hardest thing to do up here.',
    tradeoff: 'Growing faster is possible, but balance keeps the town resilient.',
    confidence: 70,
    alternative: null,
  })

  return out
}

