// Regenerate committed checkpoints from real game actions, never from manually edited stats.
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { GATHER_SITES, ROUTE_MAP, ISLANDS, BRIDGE_TYPES } from '../src/game/data.js'
import { backpackUsed, backpackCapacity, bridgeCost, createInitialState, gameReducer, storageAccepts, storageCapacity, storageUsed } from '../src/game/engine.js'
import { Player } from '../src/game/player.js'

// A fixed clock keeps regrowth deterministic. Date.now() would change every
// committed checkpoint and would let a reload skip the wait.
export function generateTowns() {
  let now = 0
  let town = { ...createInitialState(), seenIntro: true }
  const act = (action) => { town = gameReducer(town, { ...action, now }) }
  const snap = () => JSON.parse(JSON.stringify((({ toasts, ...rest }) => rest)(town)))

  // Materials go into the Captain's backpack; walk them home and deposit them, just like a
  // player, so they count towards town stock.
  const depositBackpack = () => {
    if (!backpackUsed(town)) return true
    if (!storageAccepts(town.resources, town.backpack, storageCapacity(town))) return false
    const captain = new Player(town)
    captain.onSave = (position) => act({ type: 'PLAYER_POSITION', position })
    if (!captain.request({ type: 'DEPOSIT_BACKPACK' }, (action) => { act(action); captain.sync(town) })) throw new Error('Cannot reach town storage')
    for (let i = 0; captain.pending && i < 2000; i++) captain.update(0.1)
    if (backpackUsed(town)) throw new Error('Checkpoint supplies were not deposited')
    return true
  }

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
    depositBackpack()
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

  const towns = {}
  towns['new-town'] = snap()

  act({ type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })
  if (!town.completed.includes('firstSteps')) throw new Error('Shelter checkpoint did not complete First Steps')
  towns['shelter-built'] = snap()

  act({ type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' })
  if (!town.completed.includes('anchor')) throw new Error('Anchor checkpoint did not complete Hold Fast')
  for (let i = 0; i < 2; i++) gather('grove')
  if (town.resources.wood < 14 || town.bridges.length) throw new Error('Bridge checkpoint is not ready')
  towns['anchor-ready'] = snap()

  // Bank supplies before opening the islands, when gathering does not also
  // produce their yields. Verdant opens first and produces wood after every
  // bridge job: count that income toward reinforcement stock instead of
  // banking it twice. The rope-only town must still accept a full backpack.
  const routes = ['verdant-haven', 'rain-haven', 'prism-haven', 'mercy-haven', 'hearth-haven']
  const ropeWood = routes.reduce((sum, id) => sum + ROUTE_MAP[id].wood, 0)
  const upgradeWood = routes.reduce((sum, id) => sum + Math.ceil(bridgeCost(ROUTE_MAP[id], 'reinforced').wood / 2), 0)
  const upgradeStone = routes.reduce((sum, id) => sum + bridgeCost(ROUTE_MAP[id], 'reinforced').stone, 0)
  const openingWood = routes.length * Math.floor(ISLANDS.verdant.yields.wood * BRIDGE_TYPES.rope.yieldMult)
  fill('stone', upgradeStone, ['stone'])
  fill('wood', ropeWood + Math.max(0, upgradeWood - openingWood), ['grove'])
  for (const routeId of routes) {
    act({ type: 'BUILD_BRIDGE', routeId, bridgeType: 'rope' })
    if (!town.bridges.some((b) => b.route === routeId)) throw new Error(`Could not build ${routeId}`)
  }
  if (storageUsed(town.resources) + backpackCapacity(town) > storageCapacity(town)) throw new Error(`all-bridges checkpoint is too full to deposit a backpack (${storageUsed(town.resources)}/${storageCapacity(town)})`)
  towns['all-bridges'] = snap()

  act({ type: 'RESTORE_BEACON' })
  if (!town.beaconRestored) throw new Error(`Beacon was not restored (wood ${town.resources.wood}, energy ${town.resources.energy})`)
  // The reinforced checkpoint has always included a market. Build it from
  // stock already in town so the action does not depend on another deposit.
  act({ type: 'BUILD', buildingType: 'market', island: 'newHaven', slot: 1 })
  if (!town.buildings.some((b) => b.type === 'market')) throw new Error(`Could not build the market (wood ${town.resources.wood}, coins ${town.resources.coins}, materials ${town.resources.materials})`)
  for (const routeId of routes) {
    act({ type: 'UPGRADE_BRIDGE', routeId })
    if (!town.bridges.some((b) => b.route === routeId && b.type === 'reinforced')) {
      throw new Error(`Could not reinforce ${routeId} (wood ${town.resources.wood}, stone ${town.resources.stone}, coins ${town.resources.coins}, stored ${storageUsed(town.resources)})`)
    }
  }
  towns['all-reinforced'] = snap()
  return towns
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  mkdirSync(new URL('./checkpoints/', import.meta.url), { recursive: true })
  const towns = generateTowns()
  for (const [name, town] of Object.entries(towns)) {
    writeFileSync(new URL(`./checkpoints/${name}.json`, import.meta.url), `${JSON.stringify(town, null, 2)}\n`)
  }
}
