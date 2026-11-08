// Deterministic, action-driven game rules with XP and level unlocks.
import {
  BASE_CAP, BASE_HOUSING, BEACON_COST, BRIDGE_TYPES, BUILDINGS, CONSULT_COST,
  GATHER_AMOUNT, HARVEST, GATHER_SITES, RESOURCES, ISLANDS, LEVELS, MISSIONS, REPAIR_COST, ROUTES, ROUTE_MAP, WEATHER,
} from './data.js'
import { formatRemaining, freshDeposits, normalizeDeposits, primaryReward, viewDeposit } from './deposits.js'

export const METERS = ['energy', 'water', 'food']
const ALL_RES = Object.keys(RESOURCES)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function createInitialState() {
  return {
    version: 6,
    townName: 'New Haven',
    resources: { wood: 24, water: 30, food: 24, energy: 12, coins: 40, stone: 8, seeds: 2, crystals: 0, materials: 0, fish: 0 },
    deposits: freshDeposits(),
    lastInteraction: null,
    happiness: 62,
    population: 6,
    sustainability: 40,
    sustainPenalty: 0,
    xp: 0,
    blueprints: [],
    flags: {},
    buildings: [
      { id: 'b1', type: 'starterGarden', island: 'newHaven', slot: -1, builtLevel: 1 },
      { id: 'b2', type: 'rainBarrel', island: 'newHaven', slot: -2, builtLevel: 1 },
    ],
    beaconRestored: false,
    connected: ['newHaven'],
    discovered: Object.keys(ISLANDS),
    bridges: [],
    weather: 'clear',
    forecast: 'clear',
    completed: [],
    counters: { waterStreak: 0, energyStreak: 0, foodSurplus: 0 },
    journal: [
      { id: 'j0', level: 1, type: 'story', title: 'Chapter 1 — A Place to Begin', text: 'The shelter is damaged, the beacon is dark, and the old bridge has collapsed. Three islands drift within sight.' },
    ],
    journalUnread: 1,
    toasts: [],
    seenIntro: false,
    nextId: 3,
  }
}

/* ---------- derived helpers ---------- */

export function getLevelInfo(xp) {
  let cur = LEVELS[0]
  for (const l of LEVELS) if (xp >= l.xp) cur = l
  const next = LEVELS.find((l) => l.level === cur.level + 1) || null
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1
  return { ...cur, next, progress }
}

export const unlockLevel = (key) => LEVELS.find((l) => l.unlocks.includes(key))?.level ?? 1

export function isUnlocked(state, key) {
  const lvl = getLevelInfo(state.xp).level
  return LEVELS.some((l) => l.level <= lvl && l.unlocks.includes(key)) || state.blueprints.includes(key)
}

export const countType = (state, type) => state.buildings.filter((b) => b.type === type).length
export const hasAnchor = (state) => countType(state, 'bridgeAnchor') > 0

export function housing(state) {
  const access = islandAccess(state)
  const islandHomes = Object.keys(access).reduce((s, id) => s + (ISLANDS[id].housing || 0), 0)
  return BASE_HOUSING + islandHomes + state.buildings.reduce((s, b) => s + (BUILDINGS[b.type].housing || 0), 0)
}

export function caps(state) {
  const bonus = state.buildings.reduce((s, b) => s + (BUILDINGS[b.type].capBonus || 0), 0)
  const eBonus = state.buildings.reduce((s, b) => s + (BUILDINGS[b.type].energyCap || 0), 0)
  return { water: BASE_CAP + bonus, food: BASE_CAP + bonus, energy: BASE_CAP + bonus + eBonus }
}

export function canAfford(resources, cost = {}) {
  return Object.entries(cost).every(([k, v]) => (resources[k] ?? 0) >= v)
}
function pay(resources, cost = {}) {
  const r = { ...resources }
  for (const [k, v] of Object.entries(cost)) r[k] -= v
  return r
}

export function bridgeCost(route, type) {
  const t = BRIDGE_TYPES[type]
  const cost = { wood: Math.round(route.wood * t.woodMult) }
  if (t.coins) cost.coins = t.coins
  if (t.stone) cost.stone = t.stone
  return cost
}

const edgeFactor = (b) => (b.condition <= 0 ? 0 : b.condition < 40 ? 0.5 : 1)
export const bridgeStatus = (b) => (b.condition <= 0 ? 'closed' : b.condition < 40 ? 'strained' : 'good')

// Best throughput factor (0..1) from New Haven to each island, via open bridges.
export function islandAccess(state) {
  const f = { newHaven: 1 }
  let changed = true
  while (changed) {
    changed = false
    for (const b of state.bridges) {
      const r = ROUTE_MAP[b.route]
      if (!r) continue
      const ef = edgeFactor(b)
      for (const [u, v] of [[r.a, r.b], [r.b, r.a]]) {
        if (f[u] == null) continue
        const val = Math.min(f[u], ef)
        if (val > 0 && (f[v] ?? 0) < val) { f[v] = val; changed = true }
      }
    }
  }
  return f
}

function islandYieldMult(state, id) {
  const reinforced = state.bridges.some((b) => {
    const r = ROUTE_MAP[b.route]
    return (r.a === id || r.b === id) && b.type === 'reinforced' && b.condition > 0
  })
  return reinforced ? BRIDGE_TYPES.reinforced.yieldMult : 1
}

// Routes the player can build right now (one end connected, other end discovered, no bridge yet)
export function openRoutes(state) {
  return ROUTES.filter((r) => {
    if (state.bridges.some((b) => b.route === r.id)) return false
    const aC = state.connected.includes(r.a)
    const bC = state.connected.includes(r.b)
    if (aC === bC) return false
    const other = aC ? r.b : r.a
    return state.discovered.includes(other)
  })
}
export const otherEnd = (route, connected) => (connected.includes(route.a) ? route.b : route.a)

// Production and consumption applied after each successful game action.
export function projectProduction(state, weatherKey = state.weather) {
  const w = WEATHER[weatherKey]
  const access = islandAccess(state)
  const gain = Object.fromEntries(ALL_RES.map((k) => [k, 0]))
  const use = Object.fromEntries(ALL_RES.map((k) => [k, 0]))
  const sources = []

  for (const b of state.buildings) {
    const def = BUILDINGS[b.type]
    if (!access[b.island]) continue
    const m = w.mult?.[b.type] ?? 1
    for (const [k, v] of Object.entries(def.prod || {})) gain[k] += v * m
    for (const [k, v] of Object.entries(def.upkeep || {})) use[k] += v
    if (b.type === 'starterGarden' && state.flags.gardenUpgrade) gain.food += 2
  }
  for (const id of Object.keys(access)) {
    if (id === 'newHaven') continue
    const isl = ISLANDS[id]
    const m = access[id] * islandYieldMult(state, id) * (w.islandMult?.[id] ?? 1)
    for (const [k, v] of Object.entries(isl.yields)) gain[k] += v * m
    if (Object.keys(isl.yields).length) sources.push(id)
  }
  for (const [k, v] of Object.entries(w.gain || {})) gain[k] += v
  for (const [k, v] of Object.entries(w.use || {})) use[k] += v

  const half = Math.ceil(state.population / 2)
  use.food += half
  use.water += half

  for (const k of ALL_RES) gain[k] = Math.max(0, Math.round(gain[k]))
  const net = Object.fromEntries(ALL_RES.map((k) => [k, gain[k] - use[k]]))

  // Project happiness change on next action
  const cap = caps(state)
  const nextRes = {}
  const shortages = []
  for (const k of METERS) {
    const val = (state.resources?.[k] || 0) + net[k]
    if (val < 0) shortages.push(k)
    nextRes[k] = Math.max(0, Math.min(cap[k] || 0, val))
  }

  const waterRatio = cap.water > 0 ? nextRes.water / cap.water : 1
  const foodRatio = cap.food > 0 ? nextRes.food / cap.food : 1
  const lowSupplies = waterRatio < 0.25 || foodRatio < 0.25

  let dh = 0
  if (lowSupplies) {
    dh -= 1
  } else {
    if (!shortages.length) dh += 1
    if (net.food > 0) dh += 1
  }
  for (const k of shortages) dh -= 6
  const house = housing(state)
  if (state.population > house) dh -= 3
  if (w.happiness) dh += w.happiness
  const bh =
    state.buildings.reduce((s, b) => s + (access[b.island] ? BUILDINGS[b.type].happiness || 0 : 0), 0) +
    Object.keys(access).reduce((s, id) => s + (access[id] === 1 ? ISLANDS[id].happiness || 0 : 0), 0)
  if (bh) dh += bh
  net.happiness = dh

  return { gain, use, net, sources }
}

export function actionsOfSupply(state, key) {
  const { net } = projectProduction(state)
  if (net[key] >= 0) return Infinity
  return Math.floor(state.resources[key] / -net[key])
}

/* ---------- reducer helpers ---------- */

function toast(state, kind, text, title) {
  const id = `t${state.nextId}`
  return { ...state, nextId: state.nextId + 1, toasts: [...state.toasts, { id, kind, text, title }].slice(-5) }
}
function journal(state, type, title, text) {
  const id = `j${state.nextId}`
  return {
    ...state,
    nextId: state.nextId + 1,
    journal: [...state.journal, { id, level: getLevelInfo(state.xp).level, type, title, text }],
    journalUnread: state.journalUnread + 1,
  }
}

function discoverFrom(state, islandId) {
  const add = ROUTES.filter((r) => r.a === islandId || r.b === islandId)
    .map((r) => (r.a === islandId ? r.b : r.a))
    .filter((id) => !state.discovered.includes(id))
  return add.length ? { ...state, discovered: [...state.discovered, ...add] } : state
}

function levelUnlockNames(level) {
  const l = LEVELS.find((x) => x.level === level)
  return (l?.unlocks || []).map((k) => BUILDINGS[k]?.name || BRIDGE_TYPES[k]?.name + ' bridges').join(', ')
}

function awardXP(state, amount) {
  const before = getLevelInfo(state.xp).level
  let s = { ...state, xp: state.xp + amount }
  const after = getLevelInfo(s.xp)
  if (after.level > before) {
    const names = LEVELS.filter((l) => l.level > before && l.level <= after.level).map((l) => levelUnlockNames(l.level)).filter(Boolean).join(', ')
    s = toast(s, 'level', names ? `Unlocked: ${names}` : 'A new title for a sky steward.', `Level ${after.level} — ${after.title}`)
    s = journal(s, 'level', `Reached level ${after.level}: ${after.title}`, names ? `Unlocked ${names}.` : '')
  }
  return s
}

function completeMission(state, m) {
  let s = {
    ...state,
    completed: [...state.completed, m.id],
    resources: { ...state.resources, coins: state.resources.coins + (m.reward.coins || 0) },
  }
  if (m.reward.blueprint && !s.blueprints.includes(m.reward.blueprint)) s.blueprints = [...s.blueprints, m.reward.blueprint]
  if (m.reward.flag) s.flags = { ...s.flags, [m.reward.flag]: true }
  if (m.reward.reveal) s.discovered = Object.keys(ISLANDS)
  s = toast(s, 'mission', m.rewardText, `Mission complete — ${m.name}`)
  s = journal(s, 'mission', m.name, `${m.objective} Reward: ${m.rewardText}.`)
  s = awardXP(s, m.reward.xp || 0)
  if (m.final) {
    s = journal(s, 'story', 'A Skystead is founded', 'Water, food, energy and spirits are all holding. The sky network glows from end to end. Higher tomorrows.')
  }
  return s
}

export function activeMissions(state) {
  return MISSIONS.filter(
    (m) => !state.completed.includes(m.id) && (m.requires || []).every((r) => state.completed.includes(r)),
  )
}

export function checkMissions(state) {
  let s = state
  let changed = true
  while (changed) {
    changed = false
    for (const m of activeMissions(s)) {
      const [v, goal] = m.progress(s)
      if (v >= goal) { s = completeMission(s, m); changed = true }
    }
  }
  return s
}

/* ---------- automatic settlement updates ---------- */

function progressSettlement(state, xp) {
  const w = WEATHER[state.weather]
  const proj = projectProduction(state)
  const cap = caps(state)
  const res = { ...state.resources }
  const shortages = []

  for (const key of ALL_RES) if (!METERS.includes(key)) res[key] = Math.max(0, (res[key] || 0) + proj.net[key])
  for (const k of METERS) {
    res[k] += proj.net[k]
    if (res[k] < 0) { shortages.push(k); res[k] = 0 }
    res[k] = Math.min(res[k], cap[k])
  }

  // Happiness
  const access = islandAccess(state)
  const reasons = []

  const waterRatio = cap.water > 0 ? res.water / cap.water : 1
  const foodRatio = cap.food > 0 ? res.food / cap.food : 1
  const lowSupplies = waterRatio < 0.25 || foodRatio < 0.25

  let dh = 0
  if (lowSupplies) {
    dh -= 1
    reasons.push(['Low supplies', -1])
  } else {
    if (!shortages.length) { dh += 1; reasons.push(['Needs met', 1]) }
    if (proj.net.food > 0) { dh += 1; reasons.push(['Food surplus', 1]) }
  }
  for (const k of shortages) { dh -= 6; reasons.push([`${k[0].toUpperCase() + k.slice(1)} shortage`, -6]) }
  const house = housing(state)
  if (state.population > house) { dh -= 3; reasons.push(['Overcrowding', -3]) }
  if (w.happiness) { dh += w.happiness; reasons.push([w.name, w.happiness]) }
  const bh =
    state.buildings.reduce((s, b) => s + (access[b.island] ? BUILDINGS[b.type].happiness || 0 : 0), 0) +
    Object.keys(access).reduce((s, id) => s + (access[id] === 1 ? ISLANDS[id].happiness || 0 : 0), 0)
  if (bh) { dh += bh; reasons.push(['Buildings & islands', bh]) }
  const happiness = clamp(state.happiness + dh, 0, 100)

  // Population
  let population = state.population
  if (shortages.includes('food') || shortages.includes('water')) population = Math.max(3, population - 1)
  else if (happiness >= 55 && res.food >= 10 && res.water >= 10 && population < house) {
    population += Math.min(2, house - population)
  }

  // Bridges vs. weather
  const bridgeNotes = []
  const bridges = state.bridges.map((b) => {
    if (!w.bridgeDamage) return b
    let dmg = Math.round(w.bridgeDamage * (100 - BRIDGE_TYPES[b.type].stability) * 0.05)
    if (state.flags.stormBracing) dmg = Math.round(dmg / 2)
    if (dmg <= 0) return b
    const condition = Math.max(0, b.condition - dmg)
    bridgeNotes.push({ route: b.route, from: b.condition, to: condition })
    return { ...b, condition }
  })

  // Sustainability drifts toward a target score
  const sustainPenalty = Math.max(0, state.sustainPenalty - 1)
  let target =
    30 +
    Math.min(20, proj.gain.energy * 2) +
    (proj.net.food >= 0 ? 10 : 0) +
    (proj.net.water >= 0 ? 10 : 0) +
    (happiness >= 60 ? 10 : 0) +
    Math.min(15, (state.connected.length - 1) * 5) +
    (state.beaconRestored ? 5 : 0) -
    shortages.length * 10 -
    bridges.filter((b) => b.condition < 40).length * 3 -
    state.sustainPenalty
  target = clamp(target, 0, 100)
  const sustainability = clamp(state.sustainability + clamp(target - state.sustainability, -5, 5), 0, 100)

  const counters = {
    waterStreak: res.water >= 3 * proj.use.water ? state.counters.waterStreak + 1 : 0,
    energyStreak: proj.net.energy >= 0 && res.energy > 0 ? state.counters.energyStreak + 1 : 0,
    foodSurplus: proj.net.food > 0 ? 1 : 0,
  }

  let s = {
    ...state,
    resources: res,
    happiness,
    population,
    sustainability,
    sustainPenalty,
    bridges,
    counters,
  }

  if (shortages.length) s = journal(s, 'event', 'Shortage', `New Haven ran out of ${shortages.join(' and ')}. Residents are worried.`)
  for (const n of bridgeNotes) {
    if (n.to === 0 && n.from > 0) s = journal(s, 'event', 'A bridge has closed', `${bridgeLabel(n.route)} is closed until repaired.`)
  }

  s = checkMissions(awardXP(s, xp))
  // Weather changes with level progression, without a separate turn cycle.
  const weatherKeys = Object.keys(WEATHER)
  const level = getLevelInfo(s.xp).level
  const weather = weatherKeys[(level - 1) % weatherKeys.length]
  const forecast = weatherKeys[level % weatherKeys.length]
  if (weather !== state.weather) s = journal(s, 'event', WEATHER[weather].name, WEATHER[weather].text)
  return { ...s, weather, forecast }

}

export const bridgeLabel = (routeId) => {
  const r = ROUTE_MAP[routeId]
  return `${ISLANDS[r.a].name} ↔ ${ISLANDS[r.b].name}`
}

function withRegrowth(state, now) {
  const deposits = {}
  for (const id of Object.keys(GATHER_SITES)) {
    const view = viewDeposit(state.deposits, id, now)
    deposits[id] = { stock: view.stock, regrowAt: view.regrowAt }
  }
  return { ...state, deposits }
}

export function gatherAvailability(state, siteId, now = Date.now()) {
  const site = GATHER_SITES[siteId]
  if (!site) return 'Unknown resource site'
  if (!islandAccess(state)[site.island]) return `Connect ${ISLANDS[site.island].name} first`
  const view = viewDeposit(state.deposits, siteId, now)
  if (!view?.ready) return `Depleted — regrows in ${formatRemaining(view?.remainingMs || site.regrowMs)}`
  if (!canAfford(state.resources, site.cost)) return 'Needs seeds from Verdant Reach'
  const cap = caps(state)
  if (!Object.keys(site.reward).some((key) => (state.resources[key] || 0) < (cap[key] ?? Infinity))) return 'Storage is full'
  return null
}

function gatherAtSite(state, siteId, now = Date.now()) {
  const ready = withRegrowth(state, now)
  const reason = gatherAvailability(ready, siteId, now)
  if (reason) return toast(ready, 'warn', reason)
  const site = GATHER_SITES[siteId]
  const primary = primaryReward(site)
  const resources = pay(ready.resources, site.cost)
  const deposits = { ...ready.deposits }
  const node = { ...deposits[siteId] }
  const cap = caps(ready)
  const reward = {}
  const taken = Math.min(site.reward[primary], node.stock, (cap[primary] ?? Infinity) - (resources[primary] || 0))
  if (taken <= 0) return toast(ready, 'warn', 'Storage is full')
  resources[primary] = (resources[primary] || 0) + taken
  reward[primary] = taken
  const fraction = taken / site.reward[primary]
  for (const [key, value] of Object.entries(site.reward)) {
    if (key === primary) continue
    const amount = Math.min(Math.round(value * fraction), (cap[key] ?? Infinity) - (resources[key] || 0))
    if (amount <= 0) continue
    resources[key] = (resources[key] || 0) + amount
    reward[key] = amount
  }
  node.stock -= taken
  if (node.stock <= 0) { node.stock = 0; node.regrowAt = now + site.regrowMs }
  deposits[siteId] = node
  let s = { ...ready, resources, deposits, nextId: ready.nextId + 1,
    lastInteraction: { id: `i${ready.nextId}`, siteId, island: site.island, kind: site.kind, reward },
  }
  s = progressSettlement(s, 10)
  if (node.stock === 0) s = journal(s, 'event', `${site.label} is resting`, `${site.label} is depleted and regrows in ${formatRemaining(site.regrowMs)}. Nothing was added to storage while it waits.`)
  return s
}

/* ---------- reducer ---------- */

export function gameReducer(state, action) {
  switch (action.type) {
    case 'GATHER_WOOD':
      return gatherAtSite(state, 'grove', action.now)
    case 'HARVEST_FOREST':
      return gatherAtSite(state, 'forest', action.now)
    case 'GATHER_AT_SITE':
      return gatherAtSite(state, action.siteId, action.now)

    case 'BUILD': {
      const { buildingType, island, slot } = action
      const def = BUILDINGS[buildingType]
      if (!def || def.buildable === false) return state
      if (!isUnlocked(state, buildingType)) return toast(state, 'warn', `${def.name} unlocks at level ${unlockLevel(buildingType)}.`)
      if (def.unique && countType(state, buildingType)) return toast(state, 'warn', `You already have a ${def.name}.`)
      if (!ISLANDS[island]) return toast(state, 'warn', 'Unknown island.')
      if (def.homeOnly && island !== 'newHaven') return toast(state, 'warn', `${def.name} must be built on New Haven.`)
      if (!islandAccess(state)[island]) return toast(state, 'warn', `Connect ${ISLANDS[island]?.name || 'that island'} before building there.`)
      if (!canAfford(state.resources, def.cost)) return toast(state, 'warn', `Not enough resources for a ${def.name}.`)
      if (!def.infrastructure && (!Number.isInteger(slot) || slot < 0 || slot >= ISLANDS[island].plots.length)) return state
      if (!def.infrastructure && state.buildings.some((b) => !BUILDINGS[b.type].infrastructure && b.island === island && b.slot === slot)) return state
      let s = {
        ...state,
        resources: pay(state.resources, def.cost),
        buildings: [...state.buildings, { id: `b${state.nextId}`, type: buildingType, island, slot: def.infrastructure ? -3 : slot, builtLevel: getLevelInfo(state.xp).level }],
        nextId: state.nextId + 1,
      }
      s = toast(s, 'build', `${def.name} built on ${ISLANDS[island].name}`)
      return progressSettlement(s, 10)
    }

    case 'BUILD_BRIDGE': {
      const { routeId, bridgeType } = action
      const route = ROUTE_MAP[routeId]
      if (!openRoutes(state).some((r) => r.id === routeId)) return state
      if (!hasAnchor(state)) return toast(state, 'warn', 'Build a Bridge Anchor on New Haven first.')
      if (!isUnlocked(state, bridgeType)) return toast(state, 'warn', `${BRIDGE_TYPES[bridgeType].name} bridges unlock at level ${unlockLevel(bridgeType)}.`)
      const cost = bridgeCost(route, bridgeType)
      if (!canAfford(state.resources, cost)) return toast(state, 'warn', 'Not enough resources for this bridge.')
      const dest = otherEnd(route, state.connected)
      let s = {
        ...state,
        resources: pay(state.resources, cost),
        bridges: [...state.bridges, { route: routeId, type: bridgeType, condition: 100, builtLevel: getLevelInfo(state.xp).level }],
        connected: [...state.connected, dest],
      }
      s = discoverFrom(s, dest)
      s = toast(s, 'bridge', `${ISLANDS[dest].name} is connected!`, 'Bridge complete')
      s = journal(s, 'discovery', `Reached ${ISLANDS[dest].name}`, ISLANDS[dest].desc)
      return progressSettlement(s, 10)
    }

    case 'UPGRADE_BRIDGE': {
      const b = state.bridges.find((x) => x.route === action.routeId)
      if (!b || b.type === 'reinforced') return state
      if (!isUnlocked(state, 'reinforced')) return toast(state, 'warn', `Reinforced bridges unlock at level ${unlockLevel('reinforced')}.`)
      const full = bridgeCost(ROUTE_MAP[b.route], 'reinforced')
      const cost = { wood: Math.ceil(full.wood / 2), coins: full.coins, stone: full.stone }
      if (!canAfford(state.resources, cost)) return toast(state, 'warn', 'Not enough resources to reinforce.')
      let s = {
        ...state,
        resources: pay(state.resources, cost),
        bridges: state.bridges.map((x) => (x === b ? { ...x, type: 'reinforced', condition: 100 } : x)),
      }
      s = toast(s, 'build', `${bridgeLabel(b.route)} reinforced`)
      return progressSettlement(s, 10)
    }

    case 'REPAIR_BRIDGE': {
      const b = state.bridges.find((x) => x.route === action.routeId)
      if (!b || b.condition >= 100) return state
      if (!canAfford(state.resources, REPAIR_COST)) return toast(state, 'warn', 'Not enough wood to repair.')
      let s = {
        ...state,
        resources: pay(state.resources, REPAIR_COST),
        bridges: state.bridges.map((x) => (x === b ? { ...x, condition: 100 } : x)),
      }
      s = toast(s, 'build', `${bridgeLabel(b.route)} repaired`)
      return progressSettlement(s, 10)
    }

    case 'RESTORE_BEACON': {
      if (state.beaconRestored) return state
      if (!canAfford(state.resources, BEACON_COST)) return toast(state, 'warn', 'The beacon needs 20 wood and 10 energy.')
      let s = { ...state, resources: pay(state.resources, BEACON_COST), beaconRestored: true }
      s = toast(s, 'bridge', 'The navigation beacon hums back to life.', 'Beacon restored')
      s = journal(s, 'story', 'The Beacon Wakes', 'Cloud, the old planning assistant, blinks awake inside the beacon: "Oh! Visitors. Wonderful. I have notes."')
      return progressSettlement(s, 10)
    }

    case 'CONSULT_GODS': {
      // Sent after the backend returns a poem, so a failed consultation costs nothing.
      const poem = typeof action.poem === 'string' ? action.poem.trim() : ''
      if (!poem) return state
      if (!canAfford(state.resources, CONSULT_COST)) return toast(state, 'warn', 'The gods ask 25 energy and 50 coins.')
      let s = { ...state, resources: pay(state.resources, CONSULT_COST), oracle: { focus: action.focus || null, xp: state.xp } }
      s = toast(s, 'story', 'Their words are written in your journal.', 'The gods have spoken')
      return journal(s, 'oracle', 'Word from the gods', poem)
    }

    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'PLAYER_POSITION': {
      const p = action.position
      if (!p || !state.connected.includes(p.island) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state
      return { ...state, player: { island: p.island, x: p.x, y: p.y } }
    }
    case 'SEEN_INTRO':
      return { ...state, seenIntro: true }
    case 'READ_JOURNAL':
      return { ...state, journalUnread: 0 }
    case 'NEW_GAME':
      return createInitialState()
    case 'LOAD':
      return migrateSave(action.state)
    default:
      return state
  }
}

// Map the older eight-island town into the current chapter without losing buildings.
export function migrateSave(saved) {
  if (!saved || ![2, 3, 4, 5, 6].includes(saved.version)) return createInitialState()
  const { turn, actionsLeft, report, showReport, ...rest } = saved
  const islandMap = { mistral: 'prism', gardens: 'verdant', skyport: 'prism' }
  const remap = (id) => islandMap[id] || id
  const routeMap = { 'mistral-haven': 'prism-haven', 'gardens-haven': 'verdant-haven', 'hearth-skyport': 'prism-haven' }
  const occupied = new Set()
  // Give existing slots on retained islands priority, then find space for relocated structures.
  const originals = saved.buildings || []
  const buildings = new Map()
  const ordered = [...originals.filter((b) => remap(b.island) === b.island), ...originals.filter((b) => remap(b.island) !== b.island)]
  for (const { builtTurn, ...building } of ordered) {
    const island = remap(building.island)
    if (!ISLANDS[island] || !BUILDINGS[building.type]) continue
    let slot = BUILDINGS[building.type].infrastructure ? -3 : building.slot
    if (slot >= 0 && (slot >= ISLANDS[island].plots.length || occupied.has(`${island}:${slot}`))) {
      slot = ISLANDS[island].plots.findIndex((_, i) => !occupied.has(`${island}:${i}`))
    }
    if (building.slot >= 0 && slot < 0 && !BUILDINGS[building.type].infrastructure) continue
    occupied.add(`${island}:${slot}`)
    buildings.set(building.id, { builtLevel: 1, ...building, island, slot })
  }
  const bridges = new Map()
  for (const { builtTurn, ...b } of saved.bridges || []) {
    const route = routeMap[b.route] || b.route
    if (!ROUTE_MAP[route]) continue
    const prior = bridges.get(route)
    bridges.set(route, { builtLevel: 1, ...b, route,
      type: prior?.type === 'reinforced' ? 'reinforced' : b.type,
      condition: Math.max(prior?.condition || 0, b.condition),
    })
  }
  return {
    ...createInitialState(), ...rest, version: 6, toasts: [],
    resources: { ...createInitialState().resources, ...saved.resources },
    deposits: normalizeDeposits(saved.deposits),
    connected: [...new Set((saved.connected || ['newHaven']).map(remap))].filter((id) => ISLANDS[id]),
    discovered: Object.keys(ISLANDS),
    buildings: originals.map((b) => buildings.get(b.id)).filter(Boolean),
    bridges: [...bridges.values()],
    journal: (saved.journal || []).map(({ turn, ...entry }) => ({ level: 1, ...entry })),
  }
}
