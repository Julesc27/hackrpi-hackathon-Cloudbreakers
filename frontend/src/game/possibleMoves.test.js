import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CONSULT_COST, BUILDINGS, ISLANDS } from './data.js'
import { gameReducer, migrateSave } from './engine.js'
import { possibleMoves } from './possibleMoves.js'

const checkpoint = (name) => migrateSave(JSON.parse(readFileSync(new URL(`../../e2e/checkpoints/${name}.json`, import.meta.url), 'utf8')))
const paid = (state) => ({ ...state, resources: Object.fromEntries(Object.entries(state.resources).map(([k, v]) => [k, v - (CONSULT_COST[k] || 0)])) })

test('every listed move really works after paying for the consultation', () => {
  for (const name of ['shelter-built', 'anchor-ready', 'all-bridges', 'all-reinforced']) {
    const town = checkpoint(name), after = paid(town)
    for (const move of possibleMoves(town)) {
      if (BUILDINGS[move] && !BUILDINGS[move].infrastructure) {
        const done = Object.keys(ISLANDS).some((island) => (ISLANDS[island].plots || []).some((_, slot) =>
          gameReducer(after, { type: 'BUILD', buildingType: move, island, slot }).buildings.length > after.buildings.length))
        assert.ok(done, `${name}: ${move} listed but cannot be built`)
      }
    }
  }
})

test('advice the town cannot afford, has not unlocked or cannot reach is never listed', () => {
  const town = checkpoint('anchor-ready')
  const moves = possibleMoves(town)
  assert.ok(!moves.includes('bridgeAnchor'), 'already built, so not a move')
  assert.ok(!moves.includes('solarFarm'), 'locked at this level')
  assert.ok(!moves.includes('mercy') && !moves.includes('hearth'), 'too expensive to bridge with this wood')
  assert.ok(moves.includes('verdant'), 'the first bridge is affordable')
  const broke = { ...town, resources: { ...town.resources, wood: 0, stone: 0, coins: CONSULT_COST.coins, energy: CONSULT_COST.energy } }
  assert.deepEqual(possibleMoves(broke).filter((m) => m !== 'gather'), ['balance'])
})

test('the price of the consultation is taken into account', () => {
  const town = checkpoint('anchor-ready')
  // exactly enough coins for the gods; a move that also needs those coins would not be affordable
  const rich = { ...town, resources: { ...town.resources, wood: 100, stone: 100, coins: CONSULT_COST.coins, energy: CONSULT_COST.energy } }
  const moves = possibleMoves(rich)
  for (const move of moves) {
    if (!BUILDINGS[move]?.cost?.coins) continue
    assert.fail(`${move} needs coins the consultation already spent`)
  }
  assert.ok(moves.includes('balance'))
})

test('the list does not change the town', () => {
  const town = checkpoint('all-bridges'), copy = JSON.parse(JSON.stringify(town))
  possibleMoves(town)
  assert.deepEqual(JSON.parse(JSON.stringify(town)), copy)
})
