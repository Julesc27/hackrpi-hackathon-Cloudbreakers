import { ISLAND_OFFSETS, STARTER_PLOTS, BRIDGE_LAYOUT_SHIFTS, shiftIslandPoint } from './mapLayout.js'

// Static game content: islands, routes, buildings, levels, missions, weather.
// Everything here is plain data so the backend can later serve the same shapes.

export const BASE_HOUSING = 6
export const BASE_CAP = 100
export const GATHER_AMOUNT = 6

export const RESOURCES = {
  energy: { label: 'Energy', color: 'var(--energy)' },
  water: { label: 'Water', color: 'var(--water)' },
  food: { label: 'Food', color: 'var(--food)' },
  wood: { label: 'Wood', color: 'var(--wood)' },
  coins: { label: 'Coins', color: 'var(--coin)' },
  stone: { label: 'Stone', color: '#b3c5d9' },
  seeds: { label: 'Seeds', color: '#c7d879' },
  crystals: { label: 'Energy crystals', color: '#8ee8ff' },
  materials: { label: 'Building materials', color: '#d7b985' },
  fish: { label: 'Fish', color: '#8fcddf' },
}

// Islands use independent painted sprites (components/world). These records are gameplay data only.
// Map coordinates use the concept art's 1600 x 900 frame. `hit` is the clickable
// ellipse [cx, cy, rx, ry]; `plots` are building spots in the same frame.
export const ISLANDS = {
  newHaven: {
    name: 'New Haven', kind: 'Starter Island', hit: [775, 510, 340, 220], yields: {},
    desc: 'Open residential terraces, a small wood grove, stone deposits, a starter garden, a basic collector and a workshop. Each source can be gathered dry, then regrows after a short rest. Outer islands regrow larger stocks.',
    question: 'Give the first families a home, then choose which resource island to connect.',
    plots: STARTER_PLOTS,
  },
  verdant: {
    name: 'Verdant Reach', kind: 'Forest Island', hit: [500, 680, 225, 130],
    yields: { wood: 5, food: 4, seeds: 1, materials: 1 }, badge: 'wood',
    desc: 'A living forest and farming island. Bring back timber, food, seeds and building materials; preserve its grove as your settlement grows.',
    question: 'A healthy forest can support a growing town. What will you plant next?',
    plots: [[440, 720], [500, 737], [560, 750], [400, 755], [460, 775], [525, 790]],
  },
  rain: {
    name: 'Rain Island', kind: 'Water Island', hit: [930, 225, 215, 125],
    yields: { water: 8, fish: 1, stone: 1 }, badge: 'drop',
    desc: 'Waterfalls, rain collectors and quiet fishing pools supply fresh water, irrigation and aquatic materials. Upgrade collection to support a larger town.',
    question: 'Clean water links the homes, gardens and workshops of the settlement.',
    // Keep the two eastern plots on reachable plaza paving, above the cliff.
    plots: [[825, 270], [885, 288], [900, 200], [940, 240]],
  },
  prism: {
    name: 'Prism Shelf', kind: 'Crystal Island', hit: [410, 235, 225, 140],
    yields: { energy: 6, crystals: 2, materials: 2, stone: 2 }, badge: 'energy',
    desc: 'Blue energy crystals rise through ancient stone shelves. Mine crystals and recover power-generation materials for solar farms, batteries and advanced buildings.',
    question: 'Turn the shelf’s energy into a cleaner, more resilient settlement.',
    plots: [[330, 290], [395, 310], [460, 310], [520, 335]],
  },
  mercy: {
    name: 'Mercy Rise', kind: 'Hospital Island', hit: [320, 470, 175, 120], yields: {}, happiness: 4,
    desc: 'The white-stone hospital and its airship landing return to the skyways. Connect the island for care, happier residents and room for community buildings.',
    question: 'A growing settlement needs care as well as supplies.',
    plots: [[440, 505], [480, 478]],
  },
  hearth: {
    name: 'Hearthside', kind: 'Village Island', hit: [1220, 450, 200, 125], yields: { food: 1 }, housing: 8,
    desc: 'Lantern-lit cottages, gardens and quiet lanes offer homes for eight more residents. Bridge the village to New Haven when the town is ready to grow.',
    question: 'Welcome new families while keeping everyone fed and supplied with water.',
    // Leave the bridge entrance clear of a building's full foundation.
    plots: [[1138, 515], [1250, 548]],
  },
}
for (const [id, [dx, dy]] of Object.entries(ISLAND_OFFSETS)) {
  const island = ISLANDS[id]
  island.hit = [island.hit[0] + dx, island.hit[1] + dy, ...island.hit.slice(2)]
  island.plots = island.plots.map(([x, y]) => [x + dx, y + dy])
}

// Actual clearings in the painted forest and crystal shelf, in world coordinates.
ISLANDS.verdant.hit = [355, 215, 240, 155]
ISLANDS.verdant.plots = [[280, 213], [340, 227], [400, 241], [300, 245], [360, 259], [420, 273]]
ISLANDS.prism.hit = [1355, 945, 230, 160]
ISLANDS.prism.plots = [[1278, 879], [1474, 924], [1292, 975], [1445, 1002]]
for (const id of Object.keys(BRIDGE_LAYOUT_SHIFTS)) {
  ISLANDS[id].hit = shiftIslandPoint(id, ISLANDS[id].hit)
  ISLANDS[id].plots = ISLANDS[id].plots.map((point) => shiftIslandPoint(id, point))
}

export const ROUTES = [
  { id: 'verdant-haven', a: 'newHaven', b: 'verdant', wood: 14, note: 'Timber, crops and seeds for a growing town.' },
  { id: 'rain-haven', a: 'newHaven', b: 'rain', wood: 20, note: 'A steady source of fresh water and aquatic supplies.' },
  { id: 'prism-haven', a: 'newHaven', b: 'prism', wood: 18, note: 'Energy crystals and advanced building materials.' },
  { id: 'mercy-haven', a: 'newHaven', b: 'mercy', wood: 22, note: 'A crossing to the hospital and airship landing.' },
  { id: 'hearth-haven', a: 'newHaven', b: 'hearth', wood: 22, note: 'Connect the village and welcome new families.' },
]
export const ROUTE_MAP = Object.fromEntries(ROUTES.map((r) => [r.id, r]))
// Older saves stored New Haven stock under these resource names.
export const STARTER_DEPOSITS = { wood: 36, stone: 18, water: 18, food: 10 }
// `stock` is remaining world yield of the first reward, not the player's inventory.
// `regrowMs` is wall-clock time after the node hits zero before that stock returns.
export const GATHER_SITES = {
  grove: { island: 'newHaven', label: 'Gather wood', kind: 'wood', legacy: 'wood', stock: 36, regrowMs: 90_000, reward: { wood: 6 } },
  stone: { island: 'newHaven', label: 'Mine stone', kind: 'stone', legacy: 'stone', stock: 18, regrowMs: 90_000, reward: { stone: 3 } },
  garden: { island: 'newHaven', label: 'Tend the garden', kind: 'garden', legacy: 'food', stock: 10, regrowMs: 60_000, cost: { seeds: 1 }, reward: { food: 5 } },
  collector: { island: 'newHaven', label: 'Collect fresh water', kind: 'water', legacy: 'water', stock: 18, regrowMs: 75_000, reward: { water: 3 } },
  forest: { island: 'verdant', label: 'Harvest timber', kind: 'wood', stock: 48, regrowMs: 75_000, reward: { wood: 8 } },
  forage: { island: 'verdant', label: 'Forage & collect seeds', kind: 'garden', stock: 30, regrowMs: 60_000, reward: { food: 5, seeds: 2 } },
  lumber: { island: 'verdant', label: 'Prepare building materials', kind: 'stone', stock: 18, regrowMs: 90_000, reward: { materials: 3 } },
  falls: { island: 'rain', label: 'Collect waterfall water', kind: 'water', stock: 48, regrowMs: 60_000, reward: { water: 8 } },
  fishing: { island: 'rain', label: 'Fish the pools', kind: 'water', stock: 12, regrowMs: 75_000, reward: { fish: 2, food: 3 } },
  crystals: { island: 'prism', label: 'Mine energy crystals', kind: 'crystal', stock: 18, regrowMs: 120_000, reward: { crystals: 3, energy: 2 } },
  salvage: { island: 'prism', label: 'Recover power components', kind: 'crystal', stock: 18, regrowMs: 120_000, reward: { materials: 3, stone: 2 } },
}

export const BRIDGE_TYPES = {
  rope: {
    name: 'Rope & Plank',
    stability: 55,
    capacity: 4,
    yieldMult: 1,
    woodMult: 1,
    coins: 0,
    desc: 'Cheap and quick. Sways in storms and will need repairs.',
  },
  reinforced: {
    name: 'Reinforced Stone',
    stability: 85,
    capacity: 8,
    yieldMult: 1.25,
    woodMult: 1.4,
    coins: 20,
    stone: 8,
    desc: 'Costs more, but keeps routes open and carries 25% more goods.',
  },
}

export const REPAIR_COST = { wood: 6 }
export const BEACON_COST = { wood: 20, energy: 10 }
// Store: "Consult the Gods" (an AI reads the game's code and answers in a riddle)
export const CONSULT_COST = { energy: 25, coins: 50 }
export const HARVEST = { wood: 10, sustainability: 3 }

// prod / upkeep are per action. happiness is an adjustment after each action.
export const BUILDINGS = {
  shelter: {
    name: 'Shelter', category: 'Survival', cost: { wood: 10, stone: 2 }, housing: 4,
    desc: 'Timber and canvas homes. Houses 4 residents.',
  },
  bridgeAnchor: {
    name: 'Bridge Anchor', category: 'Exploration', cost: { wood: 8, stone: 4 }, unique: true, homeOnly: true, infrastructure: true,
    desc: 'A workshop upgrade that unlocks bridges without using a shelter plot. Open bridge routes here to build, reinforce or repair crossings.',
  },
  waterCollector: {
    name: 'Water Collector', category: 'Survival', cost: { wood: 8 }, prod: { water: 4 },
    desc: 'Canvas funnels and barrels that catch cloud moisture.',
  },
  garden: {
    name: 'Food Garden', category: 'Survival', cost: { wood: 6, seeds: 1 }, prod: { food: 4 }, upkeep: { water: 1 },
    desc: 'Raised beds of greens and roots.',
  },
  storageHouse: {
    name: 'Storage House', category: 'Survival', cost: { wood: 12, stone: 4 }, capBonus: 25,
    desc: 'Adds 25 capacity each for water, food and energy. Drop off backpack supplies here while its island is connected.',
  },
  solarFarm: {
    name: 'Solar Farm', category: 'Renewable', cost: { wood: 12, coins: 30, crystals: 3, materials: 2 }, prod: { energy: 5 }, renewable: true,
    desc: 'Rows of recycled panels. Weak during solar storms.',
  },
  market: {
    name: 'Market', category: 'Community', cost: { wood: 15, coins: 20, materials: 2 }, prod: { coins: 6 }, upkeep: { energy: 1 }, happiness: 1,
    desc: 'Stalls, gossip and trade. Earns cloud coins.',
  },
  clinic: {
    name: 'Clinic', category: 'Survival', cost: { wood: 18, coins: 40 }, upkeep: { energy: 2, water: 1 }, happiness: 2,
    desc: 'Keeps residents healthy. Needs steady power.',
  },
  battery: {
    name: 'Crystal Battery', category: 'Renewable', cost: { wood: 10, coins: 35, crystals: 5, materials: 3 }, energyCap: 40,
    desc: 'Stores surplus renewable energy (+40 energy storage).',
  },
  communityHall: {
    name: 'Community Hall', category: 'Community', cost: { wood: 20, coins: 30 }, upkeep: { energy: 1 }, happiness: 3,
    desc: 'Meetings, music and the occasional festival.',
  },
  windTurbine: {
    name: 'Wind Turbine', category: 'Renewable', cost: { wood: 14, coins: 25, crystals: 4, materials: 4 }, prod: { energy: 7 }, happiness: -1, renewable: true,
    desc: 'Strong renewable power. Residents say it hums at night.',
  },
  // Pre-placed, not buildable
  // Pre-existing (part of the painted island, not drawn separately)
  starterGarden: { name: 'Starter Garden', category: 'Survival', prod: { food: 2 }, buildable: false, painted: true, desc: 'A few hardy rows Pip refuses to give up on.' },
  rainBarrel: { name: 'Fountain Cistern', category: 'Survival', prod: { water: 2 }, buildable: false, painted: true, desc: 'The plaza fountain still trickles.' },
}

export const BUILD_ORDER = [
  'shelter', 'bridgeAnchor', 'waterCollector', 'garden', 'storageHouse',
  'solarFarm', 'market', 'battery', 'clinic', 'communityHall', 'windTurbine',
]

export const LEVELS = [
  { level: 1, title: 'Drifter', xp: 0, unlocks: ['shelter', 'bridgeAnchor', 'rope'] },
  { level: 2, title: 'Settler', xp: 100, unlocks: ['garden', 'waterCollector', 'storageHouse'] },
  { level: 3, title: 'Builder', xp: 250, unlocks: ['solarFarm', 'reinforced', 'market'] },
  { level: 4, title: 'Steward', xp: 450, unlocks: ['clinic', 'communityHall'] },
  { level: 5, title: 'Sky Engineer', xp: 700, unlocks: ['windTurbine', 'battery'] },
  { level: 6, title: 'Cloud Mayor', xp: 1000, unlocks: [] },
  { level: 7, title: 'Sky Warden', xp: 1350, unlocks: [] },
  { level: 8, title: 'Wind Navigator', xp: 1750, unlocks: [] },
  { level: 9, title: 'Aether Architect', xp: 2200, unlocks: [] },
  { level: 10, title: 'Zephyr Marshal', xp: 2700, unlocks: [] },
  { level: 11, title: 'Sky Pioneer', xp: 3250, unlocks: [] },
  { level: 12, title: 'Storm Tamer', xp: 3850, unlocks: [] },
  { level: 13, title: 'Isle Keeper', xp: 4500, unlocks: [] },
  { level: 14, title: 'Horizon Watcher', xp: 5200, unlocks: [] },
  { level: 15, title: 'Sky Commander', xp: 5950, unlocks: [] },
  { level: 16, title: 'Nimbus Sovereign', xp: 6750, unlocks: [] },
  { level: 17, title: 'High Archon', xp: 7600, unlocks: [] },
  { level: 18, title: 'Celestial Steward', xp: 8500, unlocks: [] },
  { level: 19, title: 'Paragon of the Skies', xp: 9450, unlocks: [] },
  { level: 20, title: 'Ascendant of Cloudbreak', xp: 10450, unlocks: [] },
]

// progress(state) => [value, goal]
export const MISSIONS = [
  {
    id: 'firstSteps', name: 'First Steps', chapter: 1,
    objective: 'Build the first shelter.',
    reward: { xp: 50, coins: 25 }, rewardText: '50 XP · 25 coins · basic housing',
    progress: (s) => [s.buildings.filter((b) => b.type === 'shelter').length, 1],
  },
  {
    id: 'anchor', name: 'Hold Fast', chapter: 1,
    objective: 'Unlock bridge construction in the workshop.',
    reward: { xp: 30 }, rewardText: '30 XP · bridges unlocked',
    progress: (s) => [s.buildings.filter((b) => b.type === 'bridgeAnchor').length, 1],
  },
  {
    id: 'placeForWater', name: 'A Place for Water', chapter: 1,
    objective: 'Maintain three actions of water reserves for 3 consecutive actions.',
    reward: { xp: 60, blueprint: 'waterCollector' }, rewardText: '60 XP · Water Collector blueprint',
    progress: (s) => [Math.min(s.counters.waterStreak, 3), 3],
  },
  {
    id: 'firstBridge', name: 'The First Bridge', chapter: 1, requires: ['anchor'],
    objective: 'Connect New Haven to any resource island.',
    reward: { xp: 100, coins: 30 }, rewardText: '100 XP · 30 coins · island production',
    progress: (s) => [Math.min(s.bridges.length, 1), 1],
  },
  {
    id: 'gardenInSky', name: 'A Garden in the Sky', chapter: 2,
    objective: 'Achieve a food surplus after an action.',
    reward: { xp: 75, flag: 'gardenUpgrade' }, rewardText: '75 XP · Starter Garden upgrade (+2 food)',
    progress: (s) => [s.counters.foodSurplus ? 1 : 0, 1],
  },
  {
    id: 'beaconWakes', name: 'The Beacon Wakes', chapter: 2, requires: ['firstBridge'],
    objective: 'Restore the navigation beacon on New Haven.',
    reward: { xp: 120, coins: 40, reveal: true }, rewardText: '120 XP · 40 coins · whole sky map revealed',
    progress: (s) => [s.beaconRestored ? 1 : 0, 1],
  },
  {
    id: 'keepLightsOn', name: 'Keep the Lights On', chapter: 2, requires: ['firstBridge'],
    objective: 'Keep energy positive for 5 consecutive actions.',
    reward: { xp: 100, blueprint: 'battery' }, rewardText: '100 XP · Crystal Battery blueprint',
    progress: (s) => [Math.min(s.counters.energyStreak, 5), 5],
  },
  {
    id: 'prismPower', name: 'From Crystal to Current', chapter: 2, requires: ['firstBridge'],
    objective: 'Connect Prism Shelf and build a Solar Farm.',
    reward: { xp: 100, coins: 30 }, rewardText: '100 XP · 30 coins · clean power',
    progress: (s) => [Number(s.connected.includes('prism')) + Number(s.buildings.some((b) => b.type === 'solarFarm')), 2],
  },
  {
    id: 'longSpan', name: 'The Long Span', chapter: 3, requires: ['firstBridge'],
    objective: 'Have a bridge with stability above 70%.',
    reward: { xp: 80, flag: 'stormBracing' }, rewardText: '80 XP · Storm Bracing (halves bridge damage)',
    progress: (s) => [s.bridges.some((b) => BRIDGE_TYPES[b.type].stability > 70) ? 1 : 0, 1],
  },
  {
    id: 'cleanRoute', name: 'The Clean Route', chapter: 3, requires: ['firstBridge'],
    objective: 'Connect Verdant Reach, Rain Island and Prism Shelf to New Haven.',
    reward: { xp: 250 }, rewardText: '250 XP · clean transit badge',
    progress: (s) => [['verdant', 'rain', 'prism'].filter((id) => s.connected.includes(id)).length, 3],
  },
  {
    id: 'balancedTown', name: 'Higher Tomorrows', chapter: 3, requires: ['cleanRoute'], final: true,
    objective: 'Water, food, energy and happiness all ≥ 50, and sustainability ≥ 60.',
    reward: { xp: 300, coins: 100 }, rewardText: '300 XP · the Skystead is founded',
    progress: (s) => [
      ['water', 'food', 'energy'].filter((k) => s.resources[k] >= 50).length +
        (s.happiness >= 50 ? 1 : 0) +
        (s.sustainability >= 60 ? 1 : 0),
      5,
    ],
  },
]

export const WEATHER = {
  clear: { name: 'Clear Skies', text: 'All is calm above the clouds.', icon: 'sun', happiness: 1, weight: 4 },
  heavyRain: { name: 'Heavy Rain', text: 'Collectors overflow. Rope bridges creak.', icon: 'rain', gain: { water: 5 }, bridgeDamage: 1, weight: 2 },
  heatWave: { name: 'Heat Wave', text: 'Thirsty crops, thirsty people.', icon: 'heat', gain: { food: -2 }, use: { water: 3 }, weight: 1.5 },
  crosswind: { name: 'Crosswind', text: 'Bridges sway. Turbines sing.', icon: 'wind', gain: { energy: 2 }, bridgeDamage: 0.7, weight: 2 },
  solarStorm: { name: 'Solar Storm', text: 'Panels flicker; solar output is halved.', icon: 'storm', mult: { solarFarm: 0.5 }, islandMult: { prism: 0.5 }, weight: 1 },
  cloudDrought: { name: 'Cloud Drought', text: 'The clouds are holding on to their water.', icon: 'drought', gain: { water: -3 }, weight: 1.5 },
}

export const INTRO = {
  speaker: 'Mara Vale, settlement coordinator',
  text: 'New Haven has room for homes, but only a small reserve of wood and stone. The beacon is dark, the pantry is nearly empty, and the nearest islands are beyond the broken bridge. We have enough material for one useful beginning. Choose carefully.',
}
