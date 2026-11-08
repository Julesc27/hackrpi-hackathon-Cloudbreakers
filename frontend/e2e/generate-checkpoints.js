// Regenerate committed checkpoints from real game actions, never from manually edited stats.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createInitialState, gameReducer, backpackUsed } from '../src/game/engine.js'
import { Player } from '../src/game/player.js'

// Exercise the captain's return journey and physical deposit, just like a player.
function gatherAndDeposit(state, action) {
  state = gameReducer(state, action)
  if (!backpackUsed(state)) return state
  const captain = new Player(state)
  captain.onSave = position => { state = gameReducer(state, { type: 'PLAYER_POSITION', position }) }
  if (!captain.request({ type: 'DEPOSIT_BACKPACK' }, action => { state = gameReducer(state, action) })) throw new Error('Cannot reach town storage')
  for (let i=0; captain.pending && i<2000; i++) captain.update(.1)
  if (backpackUsed(state)) throw new Error('Checkpoint supplies were not deposited')
  return state
}
import { pathToFileURL } from 'node:url'
import { GATHER_SITES, ROUTE_MAP } from '../src/game/data.js'
import { bridgeCost, createInitialState, gameReducer } from '../src/game/engine.js'

// A fixed clock keeps regrowth deterministic. Date.now() would change every
// committed checkpoint and would let a reload skip the wait.
export function generateTowns() {
  let now = 0
  let town = { ...createInitialState(), seenIntro: true }
  const act = (action) => { town = gameReducer(town, { ...action, now }) }
  const snap = () => JSON.parse(JSON.stringify((({ toasts, ...rest }) => rest)(town)))

  const readyStock = (siteId) => {
    const site = GATHER_SITES[siteId]
    const node = town.deposits?.[siteId]
    if (!node || node.stock > 0) return node?.stock ?? site.stock
    return node.regrowAt && now >= node.regrowAt ? site.stock : 0
  }

  const gather = (siteId) => {
    const site = GATHER_SITES[siteId]
    const node = town.deposits?.[siteId]
    if (node && node.stock <= 0 && node.regrowAt > now) now = node.regrowAt
    const key = Object.keys(site.reward)[0]
    const before = town.resources[key] || 0
    if (siteId === 'grove') act({ type: 'GATHER_WOOD' })
    else if (siteId === 'forest') act({ type: 'HARVEST_FOREST' })
    else act({ type: 'GATHER_AT_SITE', siteId })
    return (town.resources[key] || 0) > before
  }

  const fill = (key, amount, sites) => {
    for (let guard = 0; (town.resources[key] || 0) < amount; guard++) {
      if (guard > 80) throw new Error(`Cannot gather enough ${key}: have ${town.resources[key] ?? 0}, need ${amount}`)
      const open = sites.filter((id) => readyStock(id) > 0)
      if (!open.length) {
        const waits = sites.map((id) => town.deposits?.[id]?.regrowAt || 0).filter((t) => t > now)
        if (!waits.length) throw new Error(`No regrowth left for ${key}`)
        now = Math.min(...waits)
      }
      gather(open[0] || sites[0])
    }
  }

  const woodSites = () => (town.connected.includes('verdant') ? ['forest', 'grove'] : ['grove'])
  const stoneSites = () => (town.connected.includes('prism') ? ['salvage', 'stone'] : ['stone'])

  const towns = {}
  towns['new-town'] = snap()

town = gameReducer(town, { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' })
if (!town.completed.includes('anchor')) throw new Error('Anchor checkpoint did not complete Hold Fast')
for (let i = 0; i < 2; i++) town = gatherAndDeposit(town, { type: 'GATHER_WOOD' })
if (town.resources.wood < 14 || town.bridges.length) throw new Error('Bridge checkpoint is not ready')
save('anchor-ready', town)

for (const routeId of ['verdant-haven', 'rain-haven', 'prism-haven', 'mercy-haven', 'hearth-haven']) {
  // The first bridge unlocks renewable timber for the remaining crossings.
  for (let i = 0; town.resources.wood < 24 && town.connected.includes('verdant') && i < 8; i++) {
    town = gatherAndDeposit(town, { type: 'HARVEST_FOREST' })
  act({ type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })
  if (!town.completed.includes('firstSteps')) throw new Error('Shelter checkpoint did not complete First Steps')
  towns['shelter-built'] = snap()

  act({ type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' })
  if (!town.completed.includes('anchor')) throw new Error('Anchor checkpoint did not complete Hold Fast')
  for (let i = 0; i < 2; i++) act({ type: 'GATHER_WOOD' })
  if (town.resources.wood < 14 || town.bridges.length) throw new Error('Bridge checkpoint is not ready')
  towns['anchor-ready'] = snap()

  for (const routeId of ['verdant-haven', 'rain-haven', 'prism-haven', 'mercy-haven', 'hearth-haven']) {
    fill('wood', ROUTE_MAP[routeId].wood, woodSites())
    act({ type: 'BUILD_BRIDGE', routeId, bridgeType: 'rope' })
    if (!town.bridges.some((b) => b.route === routeId)) throw new Error(`Could not build ${routeId}`)
  }
  towns['all-bridges'] = snap()

  fill('materials', 2, ['salvage'])
  fill('wood', 15, woodSites())
  act({ type: 'BUILD', buildingType: 'market', island: 'newHaven', slot: 1 })
  if (!town.buildings.some((b) => b.type === 'market')) throw new Error('Could not build the upgrade checkpoint market')
  for (const bridge of town.bridges) {
    const full = bridgeCost(ROUTE_MAP[bridge.route], 'reinforced')
    const cost = { wood: Math.ceil(full.wood / 2), coins: full.coins, stone: full.stone }
    fill('wood', cost.wood, woodSites())
    fill('stone', cost.stone, stoneSites())
    fill('coins', cost.coins, woodSites())
    act({ type: 'UPGRADE_BRIDGE', routeId: bridge.route })
    if (!town.bridges.some((b) => b.route === bridge.route && b.type === 'reinforced')) throw new Error(`Could not reinforce ${bridge.route}`)
  }
  towns['all-reinforced'] = snap()
  return towns
}
save('all-bridges', town)

town = gatherAndDeposit(town, { type: 'HARVEST_FOREST' })
town = gameReducer(town, { type: 'BUILD', buildingType: 'market', island: 'newHaven', slot: 1 })
if (!town.buildings.some(b => b.type === 'market')) throw new Error('Could not build the upgrade checkpoint market')
for (const bridge of town.bridges) {
  for (let i = 0; town.resources.wood < 18 && i < 8; i++) town = gatherAndDeposit(town, { type: 'HARVEST_FOREST' })
  for (let i = 0; town.resources.stone < 8 && i < 8; i++) town = gatherAndDeposit(town, { type: 'GATHER_AT_SITE', siteId: 'salvage' })
  town = gameReducer(town, { type: 'UPGRADE_BRIDGE', routeId: bridge.route })
  if (!town.bridges.some(b => b.route === bridge.route && b.type === 'reinforced')) throw new Error(`Could not reinforce ${bridge.route}`)

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  mkdirSync(new URL('./checkpoints/', import.meta.url), { recursive: true })
  const towns = generateTowns()
  for (const [name, town] of Object.entries(towns)) {
    writeFileSync(new URL(`./checkpoints/${name}.json`, import.meta.url), `${JSON.stringify(town, null, 2)}\n`)
  }
}
