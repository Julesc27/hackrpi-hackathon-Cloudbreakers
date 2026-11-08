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

mkdirSync(new URL('./checkpoints/', import.meta.url), { recursive: true })

const save = (name, state) => {
  const { toasts, ...town } = state
  writeFileSync(new URL(`./checkpoints/${name}.json`, import.meta.url), `${JSON.stringify(town, null, 2)}\n`)
}

let town = { ...createInitialState(), seenIntro: true }
save('new-town', town)

town = gameReducer(town, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })
if (!town.completed.includes('firstSteps')) throw new Error('Shelter checkpoint did not complete First Steps')
save('shelter-built', town)

town = gameReducer(town, { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' })
if (!town.completed.includes('anchor')) throw new Error('Anchor checkpoint did not complete Hold Fast')
for (let i = 0; i < 2; i++) town = gatherAndDeposit(town, { type: 'GATHER_WOOD' })
if (town.resources.wood < 14 || town.bridges.length) throw new Error('Bridge checkpoint is not ready')
save('anchor-ready', town)

for (const routeId of ['verdant-haven', 'rain-haven', 'prism-haven', 'mercy-haven', 'hearth-haven']) {
  // The first bridge unlocks renewable timber for the remaining crossings.
  for (let i = 0; town.resources.wood < 24 && town.connected.includes('verdant') && i < 8; i++) {
    town = gatherAndDeposit(town, { type: 'HARVEST_FOREST' })
  }
  town = gameReducer(town, { type: 'BUILD_BRIDGE', routeId, bridgeType: 'rope' })
  if (!town.bridges.some(b => b.route === routeId)) throw new Error(`Could not build ${routeId}`)
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
}
save('all-reinforced', town)
