import test from 'node:test'
import assert from 'node:assert/strict'
import { generateTowns } from './generate-checkpoints.js'
import { backpackCapacity, backpackUsed, gameReducer, migrateSave, storageUsed } from '../src/game/engine.js'
import { STORAGE_CAP, MISSIONS } from '../src/game/data.js'
import { Player } from '../src/game/player.js'

test('checkpoint generation reinforces every bridge after finite nodes regrow', () => {
  const towns = generateTowns()
  const reinforced = towns['all-reinforced']
  assert.equal(reinforced.bridges.length, 5)
  for (const bridge of reinforced.bridges) assert.equal(bridge.type, 'reinforced', bridge.route)
  assert.ok(reinforced.buildings.some((b) => b.type === 'market'))
  assert.deepEqual(generateTowns()['all-reinforced'].deposits, reinforced.deposits)
})

test('the revised quest chain can reach the finale using only earned supplies and successful jobs', () => {
  let town = migrateSave(generateTowns()['all-reinforced'])
  assert.equal(town.completed.includes('balancedTown'), false)
  town = gameReducer(town, { type: 'GATHER_WOOD', now: 1e9 })
  town = gameReducer(town, { type: 'BUILD', buildingType: 'solarFarm', island: 'newHaven', slot: 2 })
  assert.ok(town.completed.includes('prismPower'))
  assert.equal(town.completed.includes('keepLightsOn'), false)
  for (let i = 1; i <= 5; i++) town = gameReducer(town, { type: 'GATHER_AT_SITE', siteId: 'stone', now: i * 1e9 })
  assert.ok(town.completed.includes('keepLightsOn'))
  assert.deepEqual(new Set(town.completed), new Set(MISSIONS.map(m => m.id)))
  assert.equal(new Set(town.completed).size, town.completed.length)
})

test('the all-bridges checkpoint can accept a full backpack without exceeding shared storage', () => {
  const towns = generateTowns(), initial = towns['all-bridges']
  assert.equal(initial.bridges.length,5)
  assert.ok(storageUsed(initial.resources)+backpackCapacity(initial)<=STORAGE_CAP)
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
