import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState, gameReducer, getLevelInfo, isUnlocked, migrateSave } from './engine.js'

test('actions remain available and award XP beyond the former action limit', () => {
  let state = createInitialState()
  for (let i = 0; i < 12; i++) state = gameReducer(state, { type: 'GATHER_WOOD' })
  assert.ok(state.xp >= 120)
  assert.ok(getLevelInfo(state.xp).level >= 2)
  assert.ok(isUnlocked(state, 'garden'))
  assert.equal('actionsLeft' in state, false)
  assert.equal(gameReducer(state, { type: 'END_TURN' }), state)
})

test('building advances production and missions; rejected actions do neither', () => {
  const initial = createInitialState()
  const built = gameReducer(initial, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })
  assert.ok(built.completed.includes('firstSteps'))
  assert.equal(built.xp, 60)
  assert.notEqual(built.resources.water, initial.resources.water)
  const rejected = gameReducer(initial, { type: 'BUILD', buildingType: 'solarFarm', island: 'newHaven', slot: 0 })
  assert.equal(rejected.xp, initial.xp)
  assert.deepEqual(rejected.resources, initial.resources)
  const occupied = gameReducer(built, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })
  assert.equal(occupied, built)
})

test('resource quests advance through actions and interface actions do not simulate production', () => {
  let state = createInitialState()
  for (let i = 0; i < 5; i++) state = gameReducer(state, { type: 'GATHER_WOOD' })
  assert.ok(state.completed.includes('placeForWater'))
  const seen = gameReducer(state, { type: 'SEEN_INTRO' })
  assert.equal(seen.xp, state.xp)
  assert.deepEqual(seen.resources, state.resources)
  assert.deepEqual(seen.counters, state.counters)
})

test('old saves preserve town progress and resume even with zero former actions', () => {
  const old = { ...createInitialState(), version: 2, xp: 250, turn: 9, actionsLeft: 0, report: {}, showReport: true }
  const state = migrateSave(old)
  assert.equal(state.version, 3)
  assert.equal(state.xp, old.xp)
  assert.deepEqual(state.resources, old.resources)
  for (const key of ['turn', 'actionsLeft', 'report', 'showReport']) assert.equal(key in state, false)
  assert.equal(gameReducer(state, { type: 'GATHER_WOOD' }).xp, 260)
  assert.deepEqual(migrateSave(state), state)
})
