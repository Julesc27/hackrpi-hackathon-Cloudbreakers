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
      const midpoint = points[10], straightY = (points[0][1] + points.at(-1)[1]) / 2
      assert.ok(midpoint[1] > straightY + 9, 'suspension decks must sag below their shore anchors')
      const reinforced = bridgeCurve(route.id, 20, 'reinforced')
      assert.deepEqual(reinforced[0], points[0])
      assert.deepEqual(reinforced.at(-1), points.at(-1))
      assert.ok(reinforced[10][1] > straightY && reinforced[10][1] < midpoint[1], 'reinforced decks must stay shallower and share the same landings')
    } finally { a._bob = oldA; b._bob = oldB }
  }
})


test('the full network has separated decks and walkable terrace entrances', async () => {
  const { bridgeCurve, buildGraph } = await import('../components/world/people.js')
  const { WORLD_ISLANDS } = await import('../components/world/layout.js')
  const islands = Object.values(WORLD_ISLANDS), oldBobs = islands.map(i => i._bob)
  try {
    for (const phase of [0, 1, -1]) {
      islands.forEach((island, i) => { island._bob = phase * (i % 2 ? 2.2 : -2.2) })
      const curves = ROUTES.map(route => bridgeCurve(route.id, 100))
      for (let a = 0; a < curves.length; a++) for (let b = a + 1; b < curves.length; b++) {
        const clearance = Math.min(...curves[a].flatMap(p => curves[b].map(q => Math.hypot(p[0]-q[0], p[1]-q[1]))))
        assert.ok(clearance > 32, `${ROUTES[a].id} overlaps ${ROUTES[b].id}`)
      }
    }
  } finally { islands.forEach((island, i) => { island._bob = oldBobs[i] }) }
  const initial = createInitialState()
  const fresh = buildGraph(initial, { newHaven: true })
  assert.equal(fresh.nodes.has('newHaven:crystalPath'), false)
  const state = { ...initial, bridges: ROUTES.map(r => ({ route: r.id, condition: 100 })) }
  const graph = buildGraph(state, Object.fromEntries(['newHaven', 'verdant', 'rain', 'prism', 'mercy', 'hearth'].map(id => [id, true])))
  const visited = new Set(['newHaven:n1']), queue = ['newHaven:n1']
  for (let i = 0; i < queue.length; i++) for (const next of graph.adj.get(queue[i]) || []) {
    if (!visited.has(next)) { visited.add(next); queue.push(next) }
  }
  assert.ok(visited.has('prism:e_newHaven'))
  assert.ok(visited.has('hearth:e_newHaven'))
})

test('bridge access is a one-time workshop upgrade that does not require a free plot', () => {
  const initial = createInitialState()
  const full = { ...initial, resources: { ...initial.resources, wood: 100, stone: 100 },
    buildings: [...initial.buildings, ...ISLANDS.newHaven.plots.map((_, slot) => ({ id: `home-${slot}`, type: 'shelter', island: 'newHaven', slot }))],
  }
  const upgraded = gameReducer(full, { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' })
  assert.equal(upgraded.buildings.find((b) => b.type === 'bridgeAnchor').slot, -3)
  assert.equal(upgraded.buildings.filter((b) => b.slot >= 0).length, ISLANDS.newHaven.plots.length)
  assert.equal(upgraded.resources.wood, 92)
  assert.equal(upgraded.resources.stone, 96)
  const repeated = gameReducer(upgraded, { type: 'BUILD', buildingType: 'bridgeAnchor', island: 'newHaven' })
  assert.deepEqual(repeated.resources, upgraded.resources)
  assert.equal(repeated.buildings.length, upgraded.buildings.length)
})

test('old decorative anchors become plot-free upgrades while retaining bridge access', () => {
  const initial = createInitialState()
  const old = { ...initial, resources: { ...initial.resources, wood: 100 },
    buildings: [...initial.buildings, { id: 'old-anchor', type: 'bridgeAnchor', island: 'newHaven', slot: 4 }],
  }
  const migrated = migrateSave(old)
  assert.equal(migrated.buildings.find((b) => b.id === 'old-anchor').slot, -3)
  const reused = gameReducer(migrated, { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 4 })
  assert.ok(reused.buildings.some((b) => b.type === 'shelter' && b.slot === 4))
  const crossed = gameReducer(migrated, { type: 'BUILD_BRIDGE', routeId: 'verdant-haven', bridgeType: 'rope' })
  assert.equal(crossed.bridges.length, 1)
})
