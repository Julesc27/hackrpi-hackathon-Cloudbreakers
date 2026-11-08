import test from 'node:test'
import assert from 'node:assert/strict'
import { generateTowns } from './generate-checkpoints.js'
import { backpackCapacity, backpackUsed, gameReducer, migrateSave, storageCapacity, storageUsed } from '../src/game/engine.js'
import { Player } from '../src/game/player.js'

test('checkpoint generation reinforces every bridge after finite nodes regrow', () => {
  const towns = generateTowns()
  const reinforced = towns['all-reinforced']
  assert.equal(reinforced.bridges.length, 5)
  for (const bridge of reinforced.bridges) assert.equal(bridge.type, 'reinforced', bridge.route)
  assert.ok(reinforced.buildings.some((b) => b.type === 'market'))
  assert.deepEqual(generateTowns()['all-reinforced'].deposits, reinforced.deposits)
})

test('the all-bridges checkpoint can accept a full backpack without exceeding shared storage', () => {
  const towns = generateTowns(), initial = towns['all-bridges']
  assert.equal(initial.bridges.length,5)
  assert.ok(storageUsed(initial.resources)+backpackCapacity(initial)<=storageCapacity(initial))
  let town = { ...migrateSave(initial), backpack: { wood:17, crystals:3 } }
  const captain = new Player(town)
  captain.onSave = position => { town=gameReducer(town,{ type:'PLAYER_POSITION',position }) }
  assert.ok(captain.request({ type:'DEPOSIT_BACKPACK' },action => {
    town=gameReducer(town,action);captain.sync(town)
  }))
  for(let i=0;captain.pending&&i<2000;i++)captain.update(.1)
  assert.equal(backpackUsed(town),0)
  assert.equal(town.resources.wood,initial.resources.wood+17)
  assert.equal(town.resources.crystals,initial.resources.crystals+3)
  assert.equal(storageUsed(town.resources),storageUsed(initial.resources)+20)
  assert.equal(town.xp,initial.xp)
  assert.deepEqual(town.weatherCycle,initial.weatherCycle)
  assert.deepEqual(generateTowns(),towns)
})
