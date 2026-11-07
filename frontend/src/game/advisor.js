// Cloud, the advisor. For now this is a local rule-based stand-in.
// Later, the backend can return the same shape from an AI model via
// api/client.js -> getAdvice(). The advisor never changes game state.
//
// Each tip: { situation, recommendation, reason, tradeoff, confidence, alternative, routeId?, art? }
import { ISLANDS, BEACON_COST } from './data.js'
import {
  projectProduction, actionsOfSupply, hasAnchor, countType, housing, openRoutes, otherEnd,
  getLevelInfo, bridgeCost, canAfford, activeMissions, isUnlocked, bridgeLabel,
} from './engine.js'

const fmtActions = (n) => (n === Infinity ? 'stable' : `${n} action${n === 1 ? '' : 's'}`)
const islandArt = (id) => (id === 'rain' ? '/art/advisor-rain.webp' : `/art/island-${id}.webp`)

export function getAdvice(state) {
  const proj = projectProduction(state)
  const water = actionsOfSupply(state, 'water')
  const food = actionsOfSupply(state, 'food')
  const routes = openRoutes(state)
  const routeTo = (id) => routes.find((r) => otherEnd(r, state.connected) === id)
  const situation = `Level ${getLevelInfo(state.xp).level}. ${state.population} residents. Water: ${fmtActions(water)}. Food: ${fmtActions(food)}. Energy ${state.resources.energy}.`
  const out = []
  const connectTip = (id, reason, tradeoff, confidence, alternative = null) => {
    const r = routeTo(id)
    if (!r) return
    out.push({
      situation, recommendation: `Connect to ${ISLANDS[id].name}`, reason, tradeoff, confidence, alternative,
      routeId: r.id, art: islandArt(id),
    })
  }

  const damaged = state.bridges.filter((b) => b.condition < 40)
  if (damaged.length) {
    out.push({
      situation,
      recommendation: `Repair ${bridgeLabel(damaged[0].route)}`,
      reason: `It is at ${damaged[0].condition}% condition, so the island beyond it is producing at half strength or not at all.`,
      tradeoff: 'Costs 6 wood you could spend expanding.',
      confidence: 90,
      alternative: 'If wood is tight, wait for clear skies — but storms will only make it worse.',
      routeId: damaged[0].route,
    })
  }

  if (!countType(state, 'shelter')) {
    out.push({
      situation,
      recommendation: 'Build a Shelter',
      reason: 'Residents are sleeping under canvas. A shelter adds room for 4 more people and completes First Steps.',
      tradeoff: 'Uses 10 of your wood, which delays the bridge anchor slightly.',
      confidence: 92,
      alternative: 'Build the Bridge Anchor first if you want to reach another island sooner.',
      art: '/art/build-shelter.webp',
    })
  }

  if (!hasAnchor(state)) {
    out.push({
      situation,
      recommendation: 'Build a Bridge Anchor',
      reason: 'Every bridge starts from it. Without one, the nearby islands stay out of reach.',
      tradeoff: '8 wood now means one more round of gathering before the first bridge.',
      confidence: 88,
      alternative: 'Gather wood first so you can build the anchor and a bridge back-to-back.',
      art: '/art/build-bridgeAnchor.webp',
    })
  }

  if (water !== Infinity && water <= 3) {
    connectTip('rain',
      `Our water will last only ${fmtActions(water)}, and new residents will drink more. Rain Island gives a steady supply.`,
      'It costs wood, leaving less for housing.', 90,
      isUnlocked(state, 'waterCollector') ? 'A Water Collector on New Haven is a cheaper stopgap.' : null)
  }

  if (hasAnchor(state) && state.bridges.length === 0) {
    const pickRain = water !== Infinity && water <= food
    if (pickRain) {
      connectTip('rain',
        `Rain Island has abundant fresh water. Our reserve lasts ${fmtActions(water)}, and a bridge gives a steady supply that keeps us resilient in storms.`,
        'The water route delays Mistral Heights, which would bring energy for the beacon.', 88,
        routeTo('verdant') ? `Verdant Reach is cheaper (${bridgeCost(routeTo('verdant'), 'rope').wood} wood) and adds wood after each action.` : null)
    } else {
      connectTip('verdant',
        `Wood is our bottleneck. Verdant Reach adds wood and coins after each action and is the cheapest crossing.`,
        'Harvesting the grove too hard will lower sustainability.', 82,
        'Rain Island first if you expect a dry spell.')
    }
    const cheapest = routes.reduce((m, r) => Math.min(m, bridgeCost(r, 'rope').wood), Infinity)
    if (state.resources.wood < cheapest) {
      out.push({
        situation,
        recommendation: 'Gather wood on New Haven',
        reason: `We have ${state.resources.wood} wood and the cheapest bridge needs ${cheapest}.`,
        tradeoff: 'Gathering also advances production and resident needs.',
        confidence: 80,
        alternative: null,
        art: '/art/card-verdant.webp',
      })
    }
  }

  if (food !== Infinity && food <= 3) {
    if (routeTo('gardens')) {
      connectTip('gardens', `Food runs out in ${fmtActions(food)}. The Glass Gardens grow 6 food after each action.`, 'A 20-wood bridge.', 86)
    } else {
      out.push({
        situation,
        recommendation: isUnlocked(state, 'garden') ? 'Build a Food Garden' : 'Find more food',
        reason: `Food runs out in ${fmtActions(food)}.`,
        tradeoff: 'Gardens use 1 water per action.',
        confidence: 85,
        alternative: null,
        art: '/art/build-garden.webp',
      })
    }
  }

  if (state.population >= housing(state)) {
    if (routeTo('hearth')) {
      connectTip('hearth', `All ${housing(state)} beds are taken. Hearthside has cottages for 8 more residents.`,
        'More residents means more food and water after each action.', 72,
        'A Shelter on New Haven is cheaper but houses only 4.')
    } else {
      out.push({
        situation,
        recommendation: 'Build another Shelter',
        reason: `All ${housing(state)} beds are taken, so the population cannot grow.`,
        tradeoff: 'More residents means more food and water after each action.',
        confidence: 70,
        alternative: 'Staying small is valid too — a quiet Skystead is a sustainable one.',
        art: '/art/build-shelter.webp',
      })
    }
  }

  if (state.bridges.length && !state.beaconRestored) {
    const ok = canAfford(state.resources, BEACON_COST)
    out.push({
      situation,
      recommendation: 'Restore the navigation beacon',
      reason: 'It reveals the whole sky map and wakes me up properly. I have been napping for years.',
      tradeoff: ok ? 'Takes 20 wood and 10 energy.' : `We need ${BEACON_COST.wood} wood and ${BEACON_COST.energy} energy first.`,
      confidence: ok ? 84 : 65,
      alternative: 'Connect Mistral Heights first so energy is not a worry.',
      art: '/art/island-newHaven.webp',
    })
  }

  if (proj.net.energy <= 0 && state.bridges.length) {
    connectTip('mistral', 'We produce no energy yet. The turbines and panels on Mistral Heights give 6 after each action, plus forecasts.',
      'Solar storms halve its output.', 78)
  }

  const next = activeMissions(state)[0]
  out.push({
    situation,
    recommendation: next ? `Work toward “${next.name}”` : 'Hold steady and enjoy the view',
    reason: next ? next.objective : 'Everything is balanced. That is the hardest thing to do up here.',
    tradeoff: 'Growing faster is possible, but balance keeps the town resilient.',
    confidence: 70,
    alternative: null,
  })

  // de-duplicate by recommendation
  const seen = new Set()
  return out.filter((t) => (seen.has(t.recommendation) ? false : seen.add(t.recommendation)))
}
