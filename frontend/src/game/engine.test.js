import test from 'node:test'
import assert from 'node:assert/strict'
import { ISLANDS, ROUTES } from './data.js'
import { createInitialState, gameReducer, getLevelInfo, isUnlocked, migrateSave, gatherAvailability } from './engine.js'

test('actions remain available and award XP beyond the former action limit', () => {
  let state = createInitialState()
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_WOOD' })
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'stone' })
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
  assert.equal(state.version, 5)
  assert.equal(state.xp, old.xp)
  assert.deepEqual(state.resources, old.resources)
  for (const key of ['turn', 'actionsLeft', 'report', 'showReport']) assert.equal(key in state, false)
  assert.equal(gameReducer(state, { type: 'GATHER_WOOD' }).xp, 260)
  assert.deepEqual(migrateSave(state), state)
})


test('expanded home terraces preserve old buildings and accept shelters on new plots', () => {
  const initial = createInitialState()
  const legacy = {
    ...initial, version: 2, turn: 4, actionsLeft: 0,
    resources: { ...initial.resources, wood: 100 },
    buildings: [...initial.buildings, { id: 'existing-shelter', type: 'shelter', island: 'newHaven', slot: 4, builtTurn: 2 }],
  }
  const loaded = migrateSave(legacy)
  const built = gameReducer(loaded, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 7 })
  assert.ok(built.buildings.some((b) => b.id === 'existing-shelter' && b.slot === 4))
  assert.ok(built.buildings.some((b) => b.type === 'shelter' && b.slot === 7))
  assert.equal(gameReducer(built, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 7 }), built)
  assert.equal(gameReducer(built, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 8 }), built)
})


test('starter timber and stone deplete; rejected harvesting grants neither XP nor effects', () => {
  let state = createInitialState()
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove' })
  assert.equal(state.deposits.wood, 0)
  const rejected = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove' })
  assert.equal(rejected.xp, state.xp)
  assert.equal(rejected.resources.wood, state.resources.wood)
  assert.equal(rejected.lastInteraction, state.lastInteraction)
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'stone' })
  assert.equal(state.deposits.stone, 0)
  assert.match(gatherAvailability(state, 'stone'), /depleted/)
})

test('outer resource sites require a working bridge and provide their distinct resources', () => {
  let state = createInitialState()
  assert.match(gatherAvailability(state, 'crystals'), /Connect Prism Shelf/)
  const rejected = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'crystals' })
  assert.equal(rejected.xp, state.xp)
  state = { ...state, connected: Object.keys(ISLANDS), bridges: ROUTES.map((r) => ({ route: r.id, type: 'reinforced', condition: 100 })) }
  for (const [siteId, resource] of [['forest', 'wood'], ['forage', 'seeds'], ['fishing', 'fish'], ['crystals', 'crystals'], ['salvage', 'materials']]) {
    const before = state.resources[resource]
    state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId })
    assert.ok(state.resources[resource] > before)
    assert.equal(state.lastInteraction.siteId, siteId)
  }
  const closed = { ...state, bridges: state.bridges.map((b) => ({ ...b, condition: 0 })) }
  assert.match(gatherAvailability(closed, 'forest'), /Connect Verdant Reach/)
})

test('crystal technology consumes Prism Shelf crystals and building materials', () => {
  const initial = { ...createInitialState(), xp: 250 }
  const blocked = gameReducer(initial, { type: 'BUILD', buildingType: 'solarFarm', island: 'newHaven', slot: 0 })
  assert.equal(blocked.xp, initial.xp)
  assert.equal(blocked.buildings.length, initial.buildings.length)
  const supplied = { ...initial, resources: { ...initial.resources, crystals: 3, materials: 2 } }
  const built = gameReducer(supplied, { type: 'BUILD', buildingType: 'solarFarm', island: 'newHaven', slot: 0 })
  assert.ok(built.buildings.some((b) => b.type === 'solarFarm'))
  assert.equal(built.resources.crystals, 0)
  assert.equal(built.resources.materials, 0)
})

test('older structures are preserved with hospital and village islands restored', () => {
  const state = createInitialState()
  const oldCounts = { newHaven: 8, verdant: 2, gardens: 2, hearth: 2, rain: 2, mercy: 2, mistral: 2, skyport: 1 }
  const buildings = [...state.buildings]
  for (const [island, count] of Object.entries(oldCounts)) for (let slot = 0; slot < count; slot++) buildings.push({ id: `${island}-${slot}`, type: 'shelter', island, slot, builtTurn: 1 })
  const old = { ...state, version: 3, buildings, connected: Object.keys(oldCounts), bridges: [
    { route: 'mistral-haven', type: 'rope', condition: 80 },
    { route: 'verdant-haven', type: 'rope', condition: 60 },
    { route: 'gardens-haven', type: 'reinforced', condition: 95 },
    { route: 'mercy-haven', type: 'rope', condition: 80 },
  ] }
  const migrated = migrateSave(old)
  assert.deepEqual(Object.keys(ISLANDS), ['newHaven', 'verdant', 'rain', 'prism', 'mercy', 'hearth'])
  assert.equal(migrated.buildings.length, buildings.length)
  assert.equal(migrated.bridges.length, 3)
  assert.equal(migrated.bridges.find((b) => b.route === 'verdant-haven').type, 'reinforced')
  const occupied = migrated.buildings.filter((b) => b.slot >= 0).map((b) => `${b.island}:${b.slot}`)
  assert.equal(new Set(occupied).size, occupied.length)
  assert.deepEqual(migrateSave(migrated), migrated)
})


test('a fresh town can build homes and reach all three resource islands before starter timber runs out', () => {
  let state = createInitialState()
  const act = (action) => { state = gameReducer(state, action) }
  act({ type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 })
  act({ type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven', slot: 1 })
  act({ type: 'GATHER_AT_SITE', siteId: 'grove' })
  act({ type: 'GATHER_AT_SITE', siteId: 'grove' })
  act({ type: 'BUILD_BRIDGE', routeId: 'verdant-haven', bridgeType: 'rope' })
  act({ type: 'GATHER_AT_SITE', siteId: 'forest' })
  act({ type: 'BUILD_BRIDGE', routeId: 'rain-haven', bridgeType: 'rope' })
  act({ type: 'GATHER_AT_SITE', siteId: 'forest' })
  act({ type: 'GATHER_AT_SITE', siteId: 'forest' })
  act({ type: 'BUILD_BRIDGE', routeId: 'prism-haven', bridgeType: 'rope' })
  assert.equal(state.connected.length, 4)
  assert.equal(state.bridges.length, 3)
  assert.ok(state.deposits.wood > 0)
  assert.ok(state.resources.seeds > 0)
  assert.ok(state.resources.crystals > 0)
  assert.ok(state.resources.fish > 0)
})


test('new towns have no bridges and each crossing must be built explicitly', () => {
  const initial = createInitialState()
  assert.deepEqual(initial.bridges, [])
  assert.deepEqual(initial.connected, ['newHaven'])
  const rejected = gameReducer(initial, { type: 'BUILD_BRIDGE', routeId: 'mercy-haven', bridgeType: 'rope' })
  assert.deepEqual(rejected.bridges, [])
  assert.deepEqual(rejected.resources, initial.resources)
  const anchored = gameReducer(initial, { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven', slot: 0 })
  const built = gameReducer(anchored, { type: 'BUILD_BRIDGE', routeId: 'verdant-haven', bridgeType: 'rope' })
  assert.equal(built.bridges.length, 1)
  assert.equal(built.bridges[0].route, 'verdant-haven')
  assert.deepEqual(built.connected, ['newHaven', 'verdant'])
  assert.equal(built.bridges.some((b) => ['mercy-haven', 'hearth-haven'].includes(b.route)), false)
})

test('every bridge span stays attached to both independently floating islands', async () => {
  const { bridgeCurve } = await import('../components/world/people.js')
  const { WORLD_ISLANDS, BRIDGE_ENDS, bridgePoints } = await import('../components/world/layout.js')
  for (const route of ROUTES) {
    const ends = BRIDGE_ENDS[route.id], base = bridgePoints(route.id)
    const a = WORLD_ISLANDS[ends.a[0]], b = WORLD_ISLANDS[ends.b[0]]
    const oldA = a._bob, oldB = b._bob
    try {
      a._bob = 2.2; b._bob = -1.8
      const points = bridgeCurve(route.id, 20)
      assert.deepEqual(points[0], [base.a[0], base.a[1] + 2.2])
      assert.ok(Math.abs(points.at(-1)[0] - base.b[0]) < 1e-8)
      assert.ok(Math.abs(points.at(-1)[1] - (base.b[1] - 1.8)) < 1e-8)
    } finally { a._bob = oldA; b._bob = oldB }
  }
})
