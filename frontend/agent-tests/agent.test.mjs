import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gameReducer, migrateSave } from '../src/game/engine.js'
import { GATHER_SITES } from '../src/game/data.js'
import { defaultModel, parseAction, requestGemini, requestTimeoutMs, retryableStatus, stepBudgetMs, thinkingLevel } from './agent.mjs'
import { gradeFirstSteps, gradeGatherWood, gradeHoldFast, scenarios } from './scenarios.mjs'

const checkpoint = (name) => JSON.parse(readFileSync(new URL(`../e2e/checkpoints/${name}.json`, import.meta.url), 'utf8'))
const start = checkpoint('new-town')
const playFrom = (from, ...actions) => actions.reduce((state, action) => gameReducer(state, action), migrateSave(from))
const play = (...actions) => playFrom(start, ...actions)
const buildShelter = { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 }

test('defaults to free-tier Flash, which can tell the wood and stone markers apart better than Flash Lite', () => {
  assert.equal(defaultModel, 'gemini-3.8-flash')
})

test('Gemini Flash gets more than the 60 seconds that aborted its first CI request', () => {
  assert.ok(requestTimeoutMs > 60_000)
})

test('overload and rate-limit errors are retried, but bad keys and requests are not', () => {
  for (const status of [429, 503]) assert.ok(retryableStatus.has(status), `${status} should retry`)
  for (const status of [400, 401, 403, 404]) assert.ok(!retryableStatus.has(status), `${status} should fail fast`)
})

test('asks Gemini 3.8 Flash for low thinking, a level it supports (it rejects minimal)', () => {
  assert.equal(thinkingLevel, 'low')
})

test('a step budget outlasts one slow answer, so a timeout is retried instead of ending the run', () => {
  assert.ok(stepBudgetMs >= 2 * requestTimeoutMs)
})

// Stubbed Gemini: plays back a script of responses; 'timeout' waits until the request's own abort signal fires.
// AbortSignal.timeout's timer does not keep Node alive (a real socket would), so the stub holds a timer open itself;
// without it Node 20 exits mid-test and cancels every later test.
async function withGemini(script, run) {
  const realFetch = globalThis.fetch
  const realLog = console.log
  let calls = 0
  globalThis.fetch = (url, { signal }) => {
    const next = script[Math.min(calls++, script.length - 1)]
    if (next === 'timeout') {
      return new Promise((_, reject) => {
        const keepAlive = setInterval(() => {}, 1_000)
        signal.addEventListener('abort', () => { clearInterval(keepAlive); reject(signal.reason) })
      })
    }
    const [status, payload] = next
    return Promise.resolve(new Response(JSON.stringify(payload), { status }))
  }
  console.log = () => {}
  try {
    return { result: await run(), calls }
  } catch (error) {
    return { error, calls }
  } finally {
    globalThis.fetch = realFetch
    console.log = realLog
  }
}
const fast = { budgetMs: 400, timeoutMs: 60, delaysMs: [5] }
const overloaded = [503, { error: { status: 'UNAVAILABLE', message: 'This model is currently experiencing high demand.' } }]

test('requestGemini retries overloads and slow answers, then returns the answer', async () => {
  const { result, calls, error } = await withGemini([overloaded, 'timeout', [200, { ok: true }]], () => requestGemini('{}', 'key', 'test', fast))
  assert.equal(error, undefined)
  assert.deepEqual(result, { ok: true })
  assert.equal(calls, 3)
})

test('requestGemini fails fast on a bad key and explains why', async () => {
  const { error, calls } = await withGemini([[401, { error: { status: 'UNAUTHENTICATED', message: 'API key not valid' } }]], () => requestGemini('{}', 'key', 'test', fast))
  assert.equal(calls, 1)
  assert.match(error.message, /HTTP 401: UNAUTHENTICATED - API key not valid/)
})

test('requestGemini gives up when the step budget runs out, naming the last problem', async () => {
  const { error, calls } = await withGemini([overloaded], () => requestGemini('{}', 'key', 'test', fast))
  assert.ok(calls > 1)
  assert.match(error.message, /step budget .*HTTP 503: UNAVAILABLE/)
})

test('every scenario has a unique id, a committed checkpoint, and fits its CI job', () => {
  const jobTimeoutMs = 60 * 60_000
  assert.equal(new Set(scenarios.map((s) => s.id)).size, scenarios.length)
  for (const scenario of scenarios) {
    readFileSync(new URL(`../e2e/checkpoints/${scenario.checkpoint}.json`, import.meta.url))
    // Worst case: every step uses its full Gemini budget, plus the 2-minute setup allowance in agent.spec.js.
    assert.ok(scenario.maxSteps * stepBudgetMs + 120_000 < jobTimeoutMs, `${scenario.id} could outlive its CI job`)
  }
})

test('grader requires a real grove gathering action, not just extra XP or wood', () => {
  assert.equal(gradeGatherWood(start, start), false)
  assert.equal(gradeGatherWood(start, play(buildShelter)), false)
  const gathered = play({ type: 'GATHER_WOOD' })
  assert.equal(gradeGatherWood(start, gathered), true)
  assert.equal(gathered.deposits.grove.stock, start.deposits.grove.stock - GATHER_SITES.grove.reward.wood)
  const padded = {
    ...gathered,
    resources: { ...gathered.resources, wood: gathered.resources.wood + 6 },
    xp: gathered.xp + 10,
    lastInteraction: { siteId: 'grove' },
  }
  assert.equal(gradeGatherWood(gathered, padded), false)
  const t0 = 1_700_000_000_000
  let dry = migrateSave(start)
  for (let i = 0; i < 6; i++) dry = gameReducer(dry, { type: 'GATHER_WOOD', now: t0 })
  const rejected = gameReducer(dry, { type: 'GATHER_WOOD', now: t0 + 1 })
  assert.equal(rejected.resources.wood, dry.resources.wood)
  assert.equal(rejected.xp, dry.xp)
  assert.equal(rejected.deposits.grove.stock, 0)
  assert.equal(rejected.deposits.grove.regrowAt, dry.deposits.grove.regrowAt)
  assert.equal(gradeGatherWood(dry, rejected), false)
  const refilled = gameReducer(dry, { type: 'GATHER_WOOD', now: dry.deposits.grove.regrowAt })
  assert.equal(refilled.resources.wood, dry.resources.wood + GATHER_SITES.grove.reward.wood)
  assert.equal(refilled.deposits.grove.stock, GATHER_SITES.grove.stock - GATHER_SITES.grove.reward.wood)
  assert.equal(refilled.deposits.grove.regrowAt, 0)
  assert.equal(gradeGatherWood(dry, refilled), true)
})

test('First Steps grader requires a newly built shelter, not just gathering or a stale completion', () => {
  assert.equal(gradeFirstSteps(start, start), false)
  assert.equal(gradeFirstSteps(start, play({ type: 'GATHER_WOOD' }, { type: 'GATHER_WOOD' })), false)
  assert.equal(gradeFirstSteps(start, play(buildShelter)), true)
  assert.equal(gradeFirstSteps(start, play({ type: 'GATHER_WOOD' }, buildShelter)), true)
  const alreadyDone = play(buildShelter)
  assert.equal(gradeFirstSteps(alreadyDone, alreadyDone), false)
})

test('Hold Fast grader requires the bridge-anchor upgrade built from the shelter-built save', () => {
  const shelterBuilt = checkpoint('shelter-built')
  const buildAnchor = { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' }
  assert.equal(gradeHoldFast(shelterBuilt, shelterBuilt), false)
  assert.equal(gradeHoldFast(shelterBuilt, playFrom(shelterBuilt, { type: 'GATHER_WOOD' })), false)
  // The checkpoint can afford the anchor without gathering first.
  assert.equal(gradeHoldFast(shelterBuilt, playFrom(shelterBuilt, buildAnchor)), true)
  const anchorReady = checkpoint('anchor-ready')
  assert.equal(gradeHoldFast(anchorReady, anchorReady), false)
})

test('scenarios run in the order a player meets them', () => {
  assert.deepEqual(scenarios.map((s) => s.id), ['gather-wood', 'first-steps', 'hold-fast'])
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
