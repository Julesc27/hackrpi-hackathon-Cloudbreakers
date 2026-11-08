// Deterministic, action-driven game rules with XP and level unlocks.
import {
  BASE_CAP, BASE_HOUSING, BEACON_COST, BRIDGE_TYPES, BUILDINGS, CONSULT_COST,
  GATHER_AMOUNT, HARVEST, GATHER_SITES, RESOURCES, ISLANDS, LEVELS, MISSIONS, REPAIR_COST, ROUTES, ROUTE_MAP, WEATHER,
  STORAGE_CAP, STORED_MATERIALS, SHELTER_LEVELS, SHELTER_REPAIR_COST,
} from './data.js'
import { freshDeposits, normalizeDeposits, primaryReward, viewDeposit } from './deposits.js'
import { DEFAULT_AVATAR, normalizeAvatar } from './avatar.js'

export const METERS = ['energy', 'water', 'food']
export const BACKPACK_RESOURCES = ['wood', 'stone', 'seeds', 'crystals', 'materials', 'fish']
export const backpackCapacity = () => 20
export const backpackUsed = state => BACKPACK_RESOURCES.reduce((sum, key) => sum + (state.backpack?.[key] || 0), 0)
const emptyBackpack = () => Object.fromEntries(BACKPACK_RESOURCES.map(key => [key, 0]))
export function storageDepots(state) {
  const access = islandAccess(state)
  return [{ id: 'workshop', island: 'newHaven', point: [635, 610] }, ...state.buildings
    .filter(b => b.type === 'storageHouse' && b.slot >= 0 && access[b.island] && ISLANDS[b.island]?.plots[b.slot])
    .map(b => ({ id: b.id, island: b.island, point: ISLANDS[b.island].plots[b.slot] }))]
}
export const atTownStorage = (state, storageId = null) => storageDepots(state).some(depot => (!storageId || depot.id === storageId) && depot.island === state.player?.island && Math.hypot(depot.point[0]-state.player.x,depot.point[1]-state.player.y) <= 45)
const ALL_RES = Object.keys(RESOURCES)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

const freshWeather = (seed = 0x6c8e9cf5) => ({ phase: 'calm', remaining: 24, seed: (seed >>> 0) || 1, events: 0, lastWeather: null })
function normalizeWeatherSave(saved) {
  const cycle = saved.weatherCycle
  const phase = cycle?.phase
  const key = phase === 'warning' ? saved.forecast : saved.weather
  if (saved.version !== 7 || !['calm','warning','active'].includes(phase) || !Number.isFinite(cycle.remaining) ||
      (phase !== 'calm' && (!WEATHER[key] || key === 'clear'))) {
    return { weather: 'clear', forecast: 'clear', weatherCycle: freshWeather() }
  }
  return { weather: phase === 'active' ? key : 'clear', forecast: phase === 'calm' ? 'clear' : key,
    weatherCycle: { phase, remaining: clamp(Math.floor(cycle.remaining),1,phase === 'calm' ? 24 : phase === 'warning' ? 6 : 5),
      seed: Number.isFinite(cycle.seed) ? (cycle.seed >>> 0) || 1 : freshWeather().seed,
      events: Number.isFinite(cycle.events) ? Math.max(0,Math.floor(cycle.events)) : 0,
      lastWeather: WEATHER[cycle.lastWeather] && cycle.lastWeather !== 'clear' ? cycle.lastWeather : null } }
}
export const shelterLevel = building => clamp(Math.floor(Number(building.shelterLevel) || 1), 1, 3)
export const shelterCondition = building => Number.isFinite(building.condition) ? clamp(Math.floor(building.condition), 0, 100) : 100
export function shelterWork(state, buildingId, repair = false) {
  const building = state.buildings.find(b => b.id === buildingId && b.type === 'shelter')
  if (!building) return null
  const next = SHELTER_LEVELS[shelterLevel(building)+1]
  const cost = repair ? SHELTER_REPAIR_COST : next?.cost
  const reason = !islandAccess(state)[building.island] ? 'Reconnect this island first.'
    : repair ? (shelterCondition(building) >= 100 ? 'This shelter is already in good condition.' : null)
    : !next ? 'This shelter is already stormproof.' : getLevelInfo(state.xp).level < next.unlock ? `Reach player level ${next.unlock} first.` : null
  return { building, next, cost, reason: reason || (!canAffordConstruction(state,cost) ? 'Gather more construction supplies.' : null) }
}
export function weatherReadiness(state, key = state.weatherCycle?.phase === 'warning' ? state.forecast : state.weather) {
  const required = WEATHER[key]?.shelterLevel || 1
  const shelters = state.buildings.filter(b => b.type === 'shelter')
  const ready = shelters.filter(b => shelterLevel(b) >= required && shelterCondition(b) > 0).length
  return { key, required, total: shelters.length, ready, vulnerable: shelters.length-ready }
}

export function createInitialState(weatherSeed) {
  return {
    version: 7,
    townName: 'New Haven',
    avatar: { ...DEFAULT_AVATAR },
    avatarSet: false, // true once the player has designed their Captain
    resources: { wood: 24, water: 30, food: 24, energy: 12, coins: 40, stone: 8, seeds: 2, crystals: 0, materials: 0, fish: 0 },
    backpack: emptyBackpack(),
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
    weatherCycle: freshWeather(weatherSeed),
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
  return BASE_HOUSING + islandHomes + state.buildings.reduce((s, b) => s + (b.type === 'shelter' && shelterCondition(b) === 0 ? 0 : BUILDINGS[b.type].housing || 0), 0)
}

export function caps(state) {
  const bonus = state.buildings.reduce((s, b) => s + (BUILDINGS[b.type].capBonus || 0), 0)
  const eBonus = state.buildings.reduce((s, b) => s + (BUILDINGS[b.type].energyCap || 0), 0)
  return { water: BASE_CAP + bonus, food: BASE_CAP + bonus, energy: BASE_CAP + bonus + eBonus }
}

export function storageUsed(resources = {}) {
  return STORED_MATERIALS.reduce((sum, key) => sum + Math.max(0, Number(resources[key]) || 0), 0)
}

export function storageFullMessage(resources) {
  return `Storage is full (${storageUsed(resources)}/${STORAGE_CAP})`
}

// Net change of stored goods. Costs free space; the whole yield must fit.
export function storageAccepts(resources, delta = {}) {
  const used = storageUsed(resources)
  let next = used
  for (const [key, amount] of Object.entries(delta)) {
    if (STORED_MATERIALS.includes(key)) next += amount
  }
  if (next < 0) return false
  if (used > STORAGE_CAP) return next <= used
  return next <= STORAGE_CAP
}

export function canAfford(resources, cost = {}) {
  return Object.entries(cost).every(([k, v]) => (resources[k] ?? 0) >= v)
}
export function constructionResources(state) {
  const resources = { ...state.resources }
  for (const key of BACKPACK_RESOURCES) resources[key] = (resources[key] || 0)+(state.backpack?.[key] || 0)
  return resources
}
export const canAffordConstruction = (state, cost) => canAfford(constructionResources(state),cost)

// Spend carried materials first to free backpack space. Call only after validating the job.
function payConstruction(state, cost) {
  const resources = { ...state.resources }, backpack = { ...state.backpack }
  for (const [key, amount] of Object.entries(cost)) {
    const carried = BACKPACK_RESOURCES.includes(key) ? Math.min(backpack[key] || 0,amount) : 0
    if (carried) backpack[key] -= carried
    resources[key] = (resources[key] || 0)-(amount-carried)
  }
  return { resources, backpack }
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

const recordedCost = (item, recipe) => Object.fromEntries(Object.entries(item.paidCost || recipe || {}).filter(([key,value]) => RESOURCES[key] && Number.isFinite(value) && value > 0).map(([key,value]) => [key, Math.floor(value)]))
const addCosts = (a,b) => Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(key => [key,(a[key] || 0)+(b[key] || 0)]))

function linkedIslands(bridges) {
  const connected = new Set(['newHaven'])
  let changed = true
  while (changed) {
    changed = false
    for (const bridge of bridges) {
      const route = ROUTE_MAP[bridge.route]
      if (!route) continue
      for (const [a,b] of [[route.a,route.b],[route.b,route.a]]) if (connected.has(a) && !connected.has(b)) { connected.add(b); changed = true }
    }
  }
  return [...connected]
}

export function removalInfo(state, target) {
  if (!target) return null
  const bridge = target.routeId && state.bridges.find(b => b.route === target.routeId)
  const building = target.buildingId && state.buildings.find(b => b.id === target.buildingId)
  const item = bridge || building
  if (!item) return null
  const def = building && BUILDINGS[building.type]
  const route = bridge && ROUTE_MAP[bridge.route]
  if ((!def && building) || (!route && bridge)) return null
  const protectedItem = building && (def.buildable === false || def.painted || (building.slot < 0 && !def.infrastructure))
  const reason = protectedItem ? 'Starter scenery cannot be removed.' : building && !islandAccess(state)[building.island] ? 'Reconnect this island before removing its buildings.' : null
  const cost = recordedCost(item, bridge ? bridgeCost(route, bridge.type) : def.cost)
  const refund = Object.fromEntries(Object.entries(cost).map(([key,value]) => [key,Math.floor(value*.5)]).filter(([,value]) => value > 0))
  const after = bridge ? { ...state, bridges: state.bridges.filter(b => b !== bridge), connected: linkedIslands(state.bridges.filter(b => b !== bridge)) } : { ...state, buildings: state.buildings.filter(b => b !== building) }
  const capacity = caps(after)
  const overflow = Object.fromEntries(METERS.map(key => [key,Math.max(0,state.resources[key]-capacity[key])]).filter(([,value]) => value > 0))
  return { name: bridge ? `${ISLANDS[route.b].name} bridge` : def.name, refund, reason, after, overflow,
    bedLoss: Math.max(0,housing(state)-housing(after)), lostIslands: state.connected.filter(id => !after.connected.includes(id)) }
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
  if (w.shelterLevel) net.happiness -= Math.min(8,weatherReadiness(state,weatherKey).vulnerable*2)

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

function advanceWeather(state) {
  let cycle = { ...(state.weatherCycle || freshWeather()) }
  cycle.remaining -= 1
  if (cycle.remaining > 0) return { ...state, weatherCycle: cycle }
  // A saved random stream makes reloads resume the same warning and recovery period.
  const random = () => {
    let seed = cycle.seed >>> 0
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    cycle.seed = (seed >>> 0) || 1
    return cycle.seed / 4294967296
  }
  if (cycle.phase === 'calm') {
    const keys = Object.keys(WEATHER).filter(key => key !== 'clear' && key !== cycle.lastWeather &&
      (key !== 'solarStorm' || (cycle.events >= 2 && getLevelInfo(state.xp).level >= 5 && state.connected.includes('prism'))))
    let roll = random()*keys.reduce((sum,key) => sum+WEATHER[key].weight,0)
    const next = keys.find(key => (roll -= WEATHER[key].weight) < 0) || keys.at(-1)
    cycle = { ...cycle, phase: 'warning', remaining: 6 }
    const text = `${WEATHER[next].name} arrives after 6 completed jobs. Prepare level ${WEATHER[next].shelterLevel} shelters and stock food, water and energy.`
    return { ...journal(toast(state,'warn',text,'Weather warning'),'event','Weather warning',text), weather: 'clear', forecast: next, weatherCycle: cycle }
  }
  if (cycle.phase === 'warning') {
    cycle = { ...cycle, phase: 'active', remaining: 5 }
    const text = `${WEATHER[state.forecast].text} This event lasts 5 completed jobs. Shelters need level ${WEATHER[state.forecast].shelterLevel} protection.`
    return { ...journal(toast(state,'warn',text,WEATHER[state.forecast].name),'event',WEATHER[state.forecast].name,text), weather: state.forecast, weatherCycle: cycle }
  }
  const recovery = 12+Math.floor(random()*9)
  cycle = { ...cycle, phase: 'calm', remaining: recovery, events: cycle.events+1, lastWeather: state.weather }
  const text = `The weather has passed. You have ${recovery} calm jobs before another warning. Repair homes and replenish supplies.`
  return { ...journal(toast(state,'story',text,'Clear skies return'),'event','Clear skies return',text), weather: 'clear', forecast: 'clear', weatherCycle: cycle }
}

function progressSettlement(state, xp) {
  const w = WEATHER[state.weather]
  const damaged = []
  if (w.shelterLevel) {
    const buildings = state.buildings.map(b => {
      if (b.type !== 'shelter' || shelterLevel(b) >= w.shelterLevel || shelterCondition(b) === 0) return b
      const condition = Math.max(0,shelterCondition(b)-(w.shelterLevel === 3 ? 25 : 20))
      if (condition === 0) damaged.push(b)
      return { ...b, condition }
    })
    state = { ...state, buildings }
  }
  const proj = projectProduction(state)
  const cap = caps(state)
  const res = { ...state.resources }
  const shortages = []

  res.energy = (res.energy || 0) + (proj.net.energy || 0)
  if (res.energy < 0) { shortages.push('energy'); res.energy = 0 }
  res.energy = Math.min(res.energy, cap.energy)
  res.coins = Math.max(0, (res.coins || 0) + (proj.net.coins || 0))
  for (const key of STORED_MATERIALS) {
    const net = proj.net[key] || 0
    if (net >= 0) continue
    res[key] = (res[key] || 0) + net
    if (res[key] < 0) {
      if (METERS.includes(key)) shortages.push(key)
      res[key] = 0
    }
  }
  let room = STORAGE_CAP - storageUsed(res)
  if (room < 0) room = 0
  for (const key of STORED_MATERIALS) {
    const net = proj.net[key] || 0
    if (net <= 0 || room <= 0) continue
    let add = net
    if (cap[key] != null) add = Math.min(add, Math.max(0, cap[key] - (res[key] || 0)))
    add = Math.min(add, room)
    if (add <= 0) continue
    res[key] = (res[key] || 0) + add
    room -= add
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
  if (w.shelterLevel) dh -= Math.min(8,weatherReadiness(state,state.weather).vulnerable*2)
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
  for (const b of damaged) s = journal(toast(s,'warn','A shelter is uninhabitable. Repair or upgrade it to restore its 4 beds.'),'event','Shelter damaged',`A shelter on ${ISLANDS[b.island].name} lost its protection during ${w.name}. Its residents need repairs before their home can be used again.`)
  for (const n of bridgeNotes) {
    if (n.to === 0 && n.from > 0) s = journal(s, 'event', 'A bridge has closed', `${bridgeLabel(n.route)} is closed until repaired.`)
  }

  s = checkMissions(awardXP(s, xp))
  return advanceWeather(s)

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

function planGather(state, site, stock) {
  const primary = primaryReward(site)
  const carried = (key) => BACKPACK_RESOURCES.includes(key)
  const cap = caps(state)
  let room = Math.max(0, backpackCapacity(state) - backpackUsed(state))
  const space = (key) => (carried(key) ? room : (cap[key] ?? Infinity) - ((state.resources[key] || 0) - (site.cost?.[key] || 0)))
  const take = Math.min(site.reward[primary], stock, space(primary))
  if (take <= 0) return { blocked: carried(primary) ? 'backpack' : 'meter' }
  const reward = { [primary]: take }
  if (carried(primary)) room -= take
  const fraction = take / site.reward[primary]
  for (const [key, value] of Object.entries(site.reward)) {
    if (key === primary) continue
    const amount = Math.max(0, Math.min(Math.round(value * fraction), (() => {
      const pocket = carried(key) ? room : (cap[key] ?? Infinity) - ((state.resources[key] || 0) - (site.cost?.[key] || 0))
      return pocket
    })()))
    if (amount > 0) {
      reward[key] = amount
      if (carried(key)) room -= amount
    }
  }
  const townReward = Object.fromEntries(Object.entries(reward).filter(([key]) => !carried(key)))
  if (!storageAccepts(state.resources, storedChange(site.cost, townReward))) return { blocked: 'shared' }
  return { reward }
}

function storedChange(cost = {}, reward = {}) {
  const delta = {}
  for (const key of STORED_MATERIALS) {
    const change = (reward[key] || 0) - (cost[key] || 0)
    if (change) delta[key] = change
  }
  return delta
}

export function gatherAvailability(state, siteId, now = Date.now()) {
  const site = GATHER_SITES[siteId]
  if (!site) return 'Unknown resource site'
  if (!islandAccess(state)[site.island]) return `Connect ${ISLANDS[site.island].name} first`
  const view = viewDeposit(state.deposits, siteId, now)
  if (!view?.ready) return 'Depleted — regrowing'
  if (!canAfford(state.resources, site.cost)) return 'Needs seeds from Verdant Reach'
  const plan = planGather(state, site, view.stock)
  if (plan.blocked === 'backpack') return 'Backpack full — return to town and deposit supplies'
  if (plan.blocked === 'shared') return storageFullMessage(state.resources)
  if (plan.blocked) return 'Storage is full'
  return null
}

function gatherAtSite(state, siteId, now = Date.now()) {
  const ready = withRegrowth(state, now)
  const reason = gatherAvailability(ready, siteId, now)
  if (reason) return toast(ready, 'warn', reason)
  const site = GATHER_SITES[siteId]
  const primary = primaryReward(site)
  const plan = planGather(ready, site, ready.deposits[siteId].stock)
  if (plan.blocked) return toast(ready, 'warn', plan.blocked === 'backpack' ? 'Backpack full — return to town and deposit supplies' : plan.blocked === 'shared' ? storageFullMessage(ready.resources) : 'Storage is full')
  const resources = pay(ready.resources, site.cost)
  const backpack = { ...emptyBackpack(), ...ready.backpack }
  const deposits = { ...ready.deposits }
  const node = { ...deposits[siteId] }
  const reward = plan.reward
  const carried = (key) => BACKPACK_RESOURCES.includes(key)
  for (const [key, amount] of Object.entries(reward)) {
    if (carried(key)) backpack[key] = (backpack[key] || 0) + amount
    else resources[key] = (resources[key] || 0) + amount
  }
  node.stock -= reward[primary]
  if (node.stock <= 0) { node.stock = 0; node.regrowAt = now + site.regrowMs }
  deposits[siteId] = node
  let s = { ...ready, resources, backpack, deposits, nextId: ready.nextId + 1,
    lastInteraction: { id: `i${ready.nextId}`, siteId, island: site.island, kind: site.kind, reward,
      carried: Object.fromEntries(Object.entries(reward).filter(([key]) => carried(key))) },
  }
  s = progressSettlement(s, 10)
  if (backpackUsed(s) >= backpackCapacity(s)) s = toast(s, 'warn', 'Backpack full! Build with carried materials or open Backpack to deposit supplies.')
  if (node.stock === 0) s = journal(s, 'event', `${site.label} is resting`, `${site.label} is depleted and will regrow on its own. Nothing is added to storage while it waits.`)
  return s
}

/* ---------- reducer ---------- */

export function gameReducer(state, action) {
  switch (action.type) {
    case 'UPGRADE_SHELTER':
    case 'REPAIR_SHELTER': {
      const repair = action.type === 'REPAIR_SHELTER'
      const work = shelterWork(state,action.buildingId,repair)
      if (!work) return state
      if (work.reason) return toast(state,'warn',work.reason)
      const buildings = state.buildings.map(b => b !== work.building ? b : {
        ...b, condition: 100, shelterLevel: repair ? shelterLevel(b) : shelterLevel(b)+1,
        ...(!repair && { paidCost: addCosts(recordedCost(b,BUILDINGS.shelter.cost),work.cost) }),
      })
      return progressSettlement(toast({ ...state, buildings, ...payConstruction(state,work.cost) },'build',repair ? 'Shelter repaired.' : `Shelter upgraded to level ${work.next === SHELTER_LEVELS[3] ? 3 : 2}: ${work.next.name}.`),10)
    }
    case 'REMOVE_BUILDING':
    case 'REMOVE_BRIDGE': {
      const target = action.type === 'REMOVE_BUILDING' ? { buildingId: action.buildingId } : { routeId: action.routeId }
      const info = removalInfo(state,target)
      if (!info) return state
      if (info.reason) return toast(state,'warn',info.reason)
      if (info.lostIslands.includes(state.player?.island)) return toast(state,'warn','Return to New Haven before dismantling this bridge.')
      const resources = { ...state.resources }
      for (const [key,value] of Object.entries(info.refund)) resources[key] = (resources[key] || 0)+value
      const capacity = caps(info.after)
      for (const key of METERS) resources[key] = Math.min(resources[key],capacity[key])
      return toast({ ...info.after, resources },'build',`${info.name} removed. Recovered supplies were added to Town Storage.`)
    }
    case 'DEPOSIT_BACKPACK': {
      if (!backpackUsed(state)) return state
      if (!atTownStorage(state, action.storageId)) return toast(state, 'warn', 'Walk to the workshop or a connected storage house to deposit supplies.')
      const incoming = {}
      for (const key of BACKPACK_RESOURCES) if (state.backpack?.[key]) incoming[key] = state.backpack[key]
      if (!storageAccepts(state.resources, incoming)) return toast(state, 'warn', storageFullMessage(state.resources))
      const resources = { ...state.resources }
      for (const key of BACKPACK_RESOURCES) resources[key] = (resources[key] || 0) + (state.backpack?.[key] || 0)
      return toast({ ...state, resources, backpack: emptyBackpack(), nextId: state.nextId+1 }, 'success', 'Backpack deposited into town storage.')
    }
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
      if (!canAffordConstruction(state, def.cost)) return toast(state, 'warn', `Not enough resources for a ${def.name}.`)
      if (!def.infrastructure && (!Number.isInteger(slot) || slot < 0 || slot >= ISLANDS[island].plots.length)) return state
      if (!def.infrastructure && state.buildings.some((b) => !BUILDINGS[b.type].infrastructure && b.island === island && b.slot === slot)) return state
      let s = {
        ...state,
        ...payConstruction(state, def.cost),
        buildings: [...state.buildings, { id: `b${state.nextId}`, type: buildingType, island, slot: def.infrastructure ? -3 : slot, builtLevel: getLevelInfo(state.xp).level, paidCost: { ...def.cost } }],
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
      if (!canAffordConstruction(state, cost)) return toast(state, 'warn', 'Not enough resources for this bridge.')
      const dest = otherEnd(route, state.connected)
      let s = {
        ...state,
        ...payConstruction(state, cost),
        bridges: [...state.bridges, { route: routeId, type: bridgeType, condition: 100, builtLevel: getLevelInfo(state.xp).level, paidCost: { ...cost } }],
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
      if (!canAffordConstruction(state, cost)) return toast(state, 'warn', 'Not enough resources to reinforce.')
      let s = {
        ...state,
        ...payConstruction(state, cost),
        bridges: state.bridges.map((x) => (x === b ? { ...x, type: 'reinforced', condition: 100, paidCost: addCosts(recordedCost(b,bridgeCost(ROUTE_MAP[b.route],b.type)),cost) } : x)),
      }
      s = toast(s, 'build', `${bridgeLabel(b.route)} reinforced`)
      return progressSettlement(s, 10)
    }

    case 'REPAIR_BRIDGE': {
      const b = state.bridges.find((x) => x.route === action.routeId)
      if (!b || b.condition >= 100) return state
      if (!canAffordConstruction(state, REPAIR_COST)) return toast(state, 'warn', 'Not enough wood to repair.')
      let s = {
        ...state,
        ...payConstruction(state, REPAIR_COST),
        bridges: state.bridges.map((x) => (x === b ? { ...x, condition: 100 } : x)),
      }
      s = toast(s, 'build', `${bridgeLabel(b.route)} repaired`)
      return progressSettlement(s, 10)
    }

    case 'RESTORE_BEACON': {
      if (state.beaconRestored) return state
      if (!canAffordConstruction(state, BEACON_COST)) return toast(state, 'warn', 'The beacon needs 20 wood and 10 energy.')
      let s = { ...state, ...payConstruction(state, BEACON_COST), beaconRestored: true }
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

    case 'NOTICE': // a short message for the player, e.g. why the Captain can't do something
      return action.text ? toast(state, 'warn', String(action.text).slice(0, 160)) : state
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    case 'PLAYER_POSITION': {
      const p = action.position
      if (!p || !state.connected.includes(p.island) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state
      return { ...state, player: { island: p.island, x: p.x, y: p.y } }
    }
    case 'SEEN_INTRO':
      return { ...state, seenIntro: true }
    case 'SET_AVATAR':
      return { ...state, avatar: normalizeAvatar(action.avatar), avatarSet: true }
    case 'READ_JOURNAL':
      return { ...state, journalUnread: 0 }
    case 'NEW_GAME':
      return createInitialState(action.seed)
    case 'LOAD':
      return migrateSave(action.state)
    default:
      return state
  }
}

// Map the older eight-island town into the current chapter without losing buildings.
export function migrateSave(saved) {
  if (!saved || ![2, 3, 4, 5, 6, 7].includes(saved.version)) return createInitialState()
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
    buildings.set(building.id, { builtLevel: 1, ...building, island, slot, ...(building.type === 'shelter' && { shelterLevel: shelterLevel(building), condition: shelterCondition(building) }) })
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
    ...createInitialState(), ...rest, version: 7, toasts: [],
    ...normalizeWeatherSave(saved),
    avatar: normalizeAvatar(saved.avatar),
    avatarSet: saved.avatarSet === true,
    resources: { ...createInitialState().resources, ...saved.resources },
    backpack: Object.fromEntries(BACKPACK_RESOURCES.map(key => [key, Number.isFinite(saved.backpack?.[key]) ? Math.max(0, Math.floor(saved.backpack[key])) : 0])),
    deposits: normalizeDeposits(saved.deposits),
    connected: [...new Set((saved.connected || ['newHaven']).map(remap))].filter((id) => ISLANDS[id]),
    discovered: Object.keys(ISLANDS),
    buildings: originals.map((b) => buildings.get(b.id)).filter(Boolean),
    bridges: [...bridges.values()],
    journal: (saved.journal || []).map(({ turn, ...entry }) => ({ level: 1, ...entry })),
  }
}
