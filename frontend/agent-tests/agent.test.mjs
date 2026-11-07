import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gameReducer, migrateSave } from '../src/game/engine.js'
import { gradeGatherWood, parseAction } from './agent.mjs'

const start = JSON.parse(readFileSync(new URL('../e2e/checkpoints/new-town.json', import.meta.url), 'utf8'))

test('grader requires a real grove gathering action, not just extra XP or wood', () => {
  assert.equal(gradeGatherWood(start, start), false)
  assert.equal(gradeGatherWood(start, gameReducer(migrateSave(start), { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })), false)
  assert.equal(gradeGatherWood(start, gameReducer(migrateSave(start), { type: 'GATHER_WOOD' })), true)
})

test('model action parser accepts visible coordinates and rejects unsafe clicks', () => {
  const response = (action) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(action) }] } }] })
  const viewport = { width: 1440, height: 900 }
  assert.equal(parseAction(response({ action: 'click', x: 50, y: 60, message: 'Open the island' }), viewport).x, 50)
  assert.throws(() => parseAction(response({ action: 'click', x: 1440, y: 60, message: 'Outside' }), viewport), /outside/)
  assert.throws(() => parseAction(response({ action: 'evaluate', message: 'Change the save' }), viewport), /invalid action/)
  assert.throws(() => parseAction({ candidates: [{ finishReason: 'MAX_TOKENS' }] }, viewport), /did not finish normally/)
})
