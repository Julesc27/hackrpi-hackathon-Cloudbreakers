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
}

// Islands are painted cut-outs from the concept art (public/art/island-*.webp).
// Map coordinates use the concept art's 1600 x 900 frame. `hit` is the clickable
// ellipse [cx, cy, rx, ry]; `plots` are building spots in the same frame.
export const ISLANDS = {
  newHaven: {
    name: 'New Haven',
    kind: 'Home Island',
    hit: [765, 450, 230, 150],
    yields: {},
    desc: 'What remains of a small outpost: a gathering plaza, a fountain and a dormant navigation beacon.',
    question: 'New Haven is small, but it is still here.',
    plots: [[640, 478], [688, 540], [882, 468], [905, 528], [612, 520]],
  },
  verdant: {
    name: 'Verdant Reach',
    kind: 'Market Grove',
    hit: [500, 680, 190, 95],
    yields: { wood: 5, coins: 2 },
    badge: 'wood',
    desc: 'Pine groves around an old trading post. The easiest island to reach and the fastest way to build.',
    question: 'How much of the forest should the town harvest, and how much should it protect?',
    plots: [[545, 695], [610, 700]],
  },
  rain: {
    name: 'Rain Island',
    kind: 'Water Island',
    hit: [930, 225, 205, 115],
    yields: { water: 6 },
    badge: 'drop',
    desc: 'Crystal reservoirs and endless waterfalls. The sky\'s lifeblood flows here.',
    question: 'Redirect the water now for growth, or restore the natural collection system first?',
    plots: [[840, 255], [1065, 270]],
  },
  mistral: {
    name: 'Mistral Heights',
    kind: 'Wind & Sun Island',
    hit: [410, 235, 215, 120],
    yields: { energy: 6 },
    special: 'forecast',
    badge: 'energy',
    desc: 'Old turbines and solar rows on an exposed ridge. Reliable power, and a good view of the weather.',
    question: 'Is the town willing to accept noisy machinery in exchange for reliable energy?',
    plots: [[430, 285], [525, 248]],
  },
  mercy: {
    name: 'Mercy Rise',
    kind: 'Clinic Island',
    hit: [320, 470, 175, 120],
    yields: {},
    happiness: 2,
    badge: 'happiness',
    desc: 'A white stone clinic and an airship pad. Healthy residents are happy residents.',
    question: 'Who gets care first when supplies run short?',
    plots: [[440, 470], [470, 505]],
  },
  hearth: {
    name: 'Hearthside',
    kind: 'Village Island',
    hit: [1220, 450, 200, 125],
    yields: { food: 1 },
    housing: 8,
    badge: 'town',
    desc: 'Cottages and lantern-lit lanes, ready for new families. Adds homes for 8 residents.',
    question: 'Grow quickly, or keep the town small enough that everyone knows each other?',
    plots: [[1110, 480], [1300, 520]],
  },
  gardens: {
    name: 'The Glass Gardens',
    kind: 'Greenhouse Island',
    hit: [1040, 690, 210, 100],
    yields: { food: 6 },
    badge: 'leaf',
    desc: 'A greenhouse, a windmill and tidy crop rows left by a vanished community.',
    question: 'Preserve the old seeds as a library, or plant them now to solve shortages?',
    plots: [[890, 690], [1180, 735]],
  },
  skyport: {
    name: 'Skyport',
    kind: 'Airship Dock',
    hit: [1470, 640, 120, 120],
    yields: { coins: 6 },
    badge: 'coins',
    desc: 'A timber dock where trade airships tie up. Brings cloud coins from distant towns.',
    question: 'Who should New Haven trade with — and what should it never sell?',
    plots: [[1440, 655]],
  },
}

// Route ids match the painted bridge files (public/art/bridge-<id>.webp).
export const ROUTES = [
  { id: 'verdant-haven', a: 'newHaven', b: 'verdant', wood: 14, note: 'A short stair down to the grove.' },
  { id: 'mistral-haven', a: 'newHaven', b: 'mistral', wood: 18, note: 'A long boardwalk. Gusty, but well anchored.' },
  { id: 'rain-haven', a: 'newHaven', b: 'rain', wood: 20, note: 'Close enough to see, far enough to be expensive.' },
  { id: 'gardens-haven', a: 'newHaven', b: 'gardens', wood: 20, note: 'Steep steps, sheltered from the wind.' },
  { id: 'mercy-haven', a: 'newHaven', b: 'mercy', wood: 22, note: 'A railed span over a long drop.' },
  { id: 'hearth-haven', a: 'newHaven', b: 'hearth', wood: 22, note: 'The village has been waiting for this one.' },
  { id: 'hearth-skyport', a: 'hearth', b: 'skyport', wood: 26, note: 'A trestle out to the airship dock.' },
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

// prod / upkeep are per action. happiness is an adjustment after each action.
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
  solarStorm: { name: 'Solar Storm', text: 'Panels flicker; solar output is halved.', icon: 'storm', mult: { solarFarm: 0.5 }, islandMult: { mistral: 0.5 }, weight: 1 },
  cloudDrought: { name: 'Cloud Drought', text: 'The clouds are holding on to their water.', icon: 'drought', gain: { water: -3 }, weight: 1.5 },
}

export const INTRO = {
  speaker: 'Mara Vale, settlement coordinator',
  text: 'New Haven is small, but it is still here. The beacon is dark, the pantry is nearly empty, and the nearest islands are beyond the broken bridge. We have enough material for one useful beginning. Choose carefully.',
}
