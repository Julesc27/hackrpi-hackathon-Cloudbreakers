import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gameReducer, migrateSave } from '../src/game/engine.js'
import { defaultModel, gradeGatherWood, parseAction, requestTimeoutMs } from './agent.mjs'

const start = JSON.parse(readFileSync(new URL('../e2e/checkpoints/new-town.json', import.meta.url), 'utf8'))

test('defaults to free-tier Flash, which can tell the wood and stone markers apart better than Flash Lite', () => {
  assert.equal(defaultModel, 'gemini-3.8-flash')
})

test('Gemini gets more than the 25 seconds that aborted the first CI request', () => {
  assert.ok(requestTimeoutMs > 25_000)
  assert.ok(requestTimeoutMs <= 60_000)
})

test('grader requires a real grove gathering action, not just extra XP or wood', () => {
  assert.equal(gradeGatherWood(start, start), false)
  assert.equal(gradeGatherWood(start, gameReducer(migrateSave(start), { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })), false)
  assert.equal(gradeGatherWood(start, gameReducer(migrateSave(start), { type: 'GATHER_WOOD' })), true)
})

test('model action parser scales normalized 0-1000 points to the viewport and rejects unsafe clicks', () => {
  const response = (action) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(action) }] } }] })
  const viewport = { width: 1440, height: 900 }
  const parsed = parseAction(response({ action: 'click', x: 500, y: 500, message: 'Open the island' }), viewport)
  assert.deepEqual([parsed.x, parsed.y, parsed.modelX, parsed.modelY], [720, 450, 500, 500])
  // The failing CI run's "18 wood node" click: normalized (395,516) is the stone marker, not empty sky at pixel (395,516).
  const quarry = parseAction(response({ action: 'click', x: 395, y: 516, message: 'Click the node' }), viewport)
  assert.deepEqual([quarry.x, quarry.y], [569, 464])
  assert.equal(parseAction(response({ action: 'click', x: 1000, y: 1000, message: 'Corner' }), viewport).x, 1439)
  assert.throws(() => parseAction(response({ action: 'click', x: 1001, y: 60, message: 'Outside' }), viewport), /outside/)
  assert.throws(() => parseAction(response({ action: 'evaluate', message: 'Change the save' }), viewport), /invalid action/)
  assert.throws(() => parseAction({ candidates: [{ finishReason: 'MAX_TOKENS' }] }, viewport), /did not finish normally/)
})
