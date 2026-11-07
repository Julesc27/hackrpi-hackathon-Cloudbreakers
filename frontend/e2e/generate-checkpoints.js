// Regenerate committed checkpoints from real game actions, never from manually edited stats.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createInitialState, gameReducer } from '../src/game/engine.js'

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
for (let i = 0; i < 2; i++) town = gameReducer(town, { type: 'GATHER_WOOD' })
if (town.resources.wood < 14 || town.bridges.length) throw new Error('Bridge checkpoint is not ready')
save('anchor-ready', town)

for (const routeId of ['verdant-haven', 'rain-haven', 'prism-haven', 'mercy-haven', 'hearth-haven']) {
  // The first bridge unlocks renewable timber for the remaining crossings.
  for (let i = 0; town.resources.wood < 24 && town.connected.includes('verdant') && i < 8; i++) {
    town = gameReducer(town, { type: 'HARVEST_FOREST' })
  }
  town = gameReducer(town, { type: 'BUILD_BRIDGE', routeId, bridgeType: 'rope' })
  if (!town.bridges.some(b => b.route === routeId)) throw new Error(`Could not build ${routeId}`)
}
save('all-bridges', town)
