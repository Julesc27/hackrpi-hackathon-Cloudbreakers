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

town = gameReducer(town, { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven', slot: 1 })
if (!town.completed.includes('anchor')) throw new Error('Anchor checkpoint did not complete Hold Fast')
for (let i = 0; i < 2; i++) town = gameReducer(town, { type: 'GATHER_WOOD' })
if (town.resources.wood < 14 || town.bridges.length) throw new Error('Bridge checkpoint is not ready')
save('anchor-ready', town)
