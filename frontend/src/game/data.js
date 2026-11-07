// Static game content: islands, routes, buildings, levels, missions, weather.
// Everything here is plain data so the backend can later serve the same shapes.

export const ACTIONS_PER_TURN = 3
export const BASE_HOUSING = 6
export const BASE_CAP = 100
export const GATHER_AMOUNT = 6

export const RESOURCES = {
  energy: { label: 'Energy', color: 'var(--energy)' },
  water: { label: 'Water', color: 'var(--water)' },
  food: { label: 'Food', color: 'var(--food)' },
  wood: { label: 'Wood', color: 'var(--wood)' },
  coins: { label: 'Coins', color: 'var(--coin)' },
}

// Map coordinates live in a 1600 x 900 SVG viewBox.
// `rx` is the island's horizontal radius; its vertical radius is rx / 2.
// `slots` are building plots in island-local coordinates.
export const ISLANDS = {
  newHaven: {
    name: 'New Haven',
    kind: 'Home Island',
    theme: 'haven',
    x: 800, y: 450, rx: 175,
    yields: {},
    desc: 'What remains of a small outpost: a shelter site, a gathering area and a dormant navigation beacon.',
    question: 'New Haven is small, but it is still here.',
    slots: [[-105, -18], [-62, 30], [72, 30], [112, -14], [-14, 56], [44, -52], [-80, -52]],
  },
  verdant: {
    name: 'Verdant Reach',
    kind: 'Forest Island',
    theme: 'forest',
    x: 330, y: 540, rx: 130,
    yields: { wood: 5, food: 2 },
    desc: 'Trees, vines, herbs and old wooden platforms. The easiest island to reach and the fastest way to build.',
    question: 'How much of the forest should the town harvest, and how much should it protect?',
    slots: [[-30, 22], [48, 8]],
  },
  rain: {
    name: 'Rain Island',
    kind: 'Water Island',
    theme: 'rain',
    x: 1170, y: 225, rx: 130,
    yields: { water: 6 },
    desc: 'Natural reservoirs, suspended waterfalls and old filtration equipment.',
    question: 'Redirect the water now for growth, or restore the natural collection system first?',
    slots: [[-58, 22], [56, 26]],
  },
  prism: {
    name: 'Prism Shelf',
    kind: 'Crystal Island',
    theme: 'crystal',
    x: 1275, y: 545, rx: 120,
    yields: { energy: 6 },
    desc: 'Luminous crystals that store wind and sunlight. Powers research and advanced bridges.',
    question: 'Can the crystals be used without destabilizing the island?',
    slots: [[-44, 20], [40, 22]],
  },
  mistral: {
    name: 'Mistral Heights',
    kind: 'Wind Island',
    theme: 'wind',
    x: 440, y: 220, rx: 120,
    yields: { energy: 5 },
    desc: 'Old wind turbines on exposed ridges. Reliable power, at the price of noise.',
    question: 'Is the town willing to accept noisy machinery in exchange for reliable energy?',
    slots: [[-46, 24], [40, 26]],
  },
  observatory: {
    name: 'Quiet Observatory',
    kind: 'High Island',
    theme: 'observatory',
    x: 575, y: 775, rx: 105,
    yields: { coins: 3 },
    special: 'forecast',
    desc: 'A star map, a weather instrument and records of the first sky settlements. Unlocks weather forecasts.',
    question: 'The storms may not be random. Investigate, warn others, or keep it secret?',
    slots: [[-40, 18], [36, 20]],
  },
  gardens: {
    name: 'The Glass Gardens',
    kind: 'Greenhouse Island',
    theme: 'gardens',
    x: 1035, y: 780, rx: 120,
    yields: { food: 6 },
    desc: 'Greenhouses, seed libraries and automated growing beds left by a vanished community.',
    question: 'Preserve the old seeds as a library, or plant them now to solve shortages?',
    slots: [[-50, 18], [48, 22]],
  },
}

export const ROUTES = [
  { id: 'haven-verdant', a: 'newHaven', b: 'verdant', wood: 14, note: 'A short, sheltered span.' },
  { id: 'haven-rain', a: 'newHaven', b: 'rain', wood: 20, note: 'Close enough to see, far enough to be expensive.' },
  { id: 'haven-prism', a: 'newHaven', b: 'prism', wood: 18, note: 'Crystal glare makes the crossing tricky.' },
  { id: 'verdant-mistral', a: 'verdant', b: 'mistral', wood: 18, note: 'Gusty, but the ridge gives good anchors.' },
  { id: 'verdant-observatory', a: 'verdant', b: 'observatory', wood: 16, note: 'An old stair hints a path once existed.' },
  { id: 'prism-gardens', a: 'prism', b: 'gardens', wood: 18, note: 'Warm air rises from the glasshouses.' },
  { id: 'rain-prism', a: 'rain', b: 'prism', wood: 12, note: 'A loop route — a second way home if a bridge fails.' },
  { id: 'rain-mistral', a: 'rain', b: 'mistral', wood: 30, note: 'The High Span. Long, exposed and ambitious.' },
]
export const ROUTE_MAP = Object.fromEntries(ROUTES.map((r) => [r.id, r]))

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
    desc: 'Costs more, but keeps routes open and carries 25% more goods.',
  },
}

export const REPAIR_COST = { wood: 6 }
export const BEACON_COST = { wood: 20, energy: 10 }
export const HARVEST = { wood: 10, sustainability: 3 }

// prod / upkeep are per turn. happiness is a per-turn nudge.
export const BUILDINGS = {
  shelter: {
    name: 'Shelter', category: 'Survival', cost: { wood: 10 }, housing: 4,
    desc: 'Timber and canvas homes. Houses 4 residents.',
  },
  bridgeAnchor: {
    name: 'Bridge Anchor', category: 'Exploration', cost: { wood: 8 }, unique: true, homeOnly: true,
    desc: 'A braced timber anchor. Needed before any bridge can be built.',
  },
  waterCollector: {
    name: 'Water Collector', category: 'Survival', cost: { wood: 8 }, prod: { water: 4 },
    desc: 'Canvas funnels and barrels that catch cloud moisture.',
  },
  garden: {
    name: 'Food Garden', category: 'Survival', cost: { wood: 6 }, prod: { food: 4 }, upkeep: { water: 1 },
    desc: 'Raised beds of greens and roots.',
  },
  storageHouse: {
    name: 'Storage House', category: 'Survival', cost: { wood: 12 }, capBonus: 25,
    desc: 'Raises water, food and energy storage by 25.',
  },
  solarFarm: {
    name: 'Solar Farm', category: 'Renewable', cost: { wood: 12, coins: 30 }, prod: { energy: 5 }, renewable: true,
    desc: 'Rows of recycled panels. Weak during solar storms.',
  },
  market: {
    name: 'Market', category: 'Community', cost: { wood: 15, coins: 20 }, prod: { coins: 6 }, upkeep: { energy: 1 }, happiness: 1,
    desc: 'Stalls, gossip and trade. Earns cloud coins.',
  },
  clinic: {
    name: 'Clinic', category: 'Survival', cost: { wood: 18, coins: 40 }, upkeep: { energy: 2, water: 1 }, happiness: 2,
    desc: 'Keeps residents healthy. Needs steady power.',
  },
  battery: {
    name: 'Crystal Battery', category: 'Renewable', cost: { wood: 10, coins: 35 }, energyCap: 40,
    desc: 'Stores surplus renewable energy (+40 energy storage).',
  },
  communityHall: {
    name: 'Community Hall', category: 'Community', cost: { wood: 20, coins: 30 }, upkeep: { energy: 1 }, happiness: 3,
    desc: 'Meetings, music and the occasional festival.',
  },
  windTurbine: {
    name: 'Wind Turbine', category: 'Renewable', cost: { wood: 14, coins: 25 }, prod: { energy: 7 }, happiness: -1, renewable: true,
    desc: 'Strong renewable power. Residents say it hums at night.',
  },
  // Pre-placed, not buildable
  starterGarden: { name: 'Starter Garden', category: 'Survival', prod: { food: 2 }, buildable: false, desc: 'A few hardy rows Pip refuses to give up on.' },
  rainBarrel: { name: 'Old Rain Barrel', category: 'Survival', prod: { water: 2 }, buildable: false, desc: 'Leaky, but faithful.' },
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
    objective: 'Build a bridge anchor on New Haven.',
    reward: { xp: 30 }, rewardText: '30 XP · bridges unlocked',
    progress: (s) => [s.buildings.filter((b) => b.type === 'bridgeAnchor').length, 1],
  },
  {
    id: 'placeForWater', name: 'A Place for Water', chapter: 1,
    objective: 'End 3 turns in a row with at least 3 turns of water stored.',
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
    objective: 'End a turn with a food surplus.',
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
    objective: 'Keep energy positive for 5 turns in a row.',
    reward: { xp: 100, blueprint: 'battery' }, rewardText: '100 XP · Crystal Battery blueprint',
    progress: (s) => [Math.min(s.counters.energyStreak, 5), 5],
  },
  {
    id: 'longSpan', name: 'The Long Span', chapter: 3, requires: ['firstBridge'],
    objective: 'Have a bridge with stability above 70%.',
    reward: { xp: 80, flag: 'stormBracing' }, rewardText: '80 XP · Storm Bracing (halves bridge damage)',
    progress: (s) => [s.bridges.some((b) => BRIDGE_TYPES[b.type].stability > 70) ? 1 : 0, 1],
  },
  {
    id: 'cleanRoute', name: 'The Clean Route', chapter: 3, requires: ['firstBridge'],
    objective: 'Connect three islands to New Haven.',
    reward: { xp: 250 }, rewardText: '250 XP · clean transit badge',
    progress: (s) => [Math.min(s.connected.length - 1, 3), 3],
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
  text: 'New Haven is small, but it is still here. The beacon is dark, the pantry is nearly empty, and the nearest islands are beyond the broken bridge. We have enough material for one useful beginning. Choose carefully.',
}
