import test from 'node:test'
import assert from 'node:assert/strict'
import { GATHER_SITES, ISLANDS, ROUTES } from './data.js'
import { createInitialState, gameReducer, getLevelInfo, isUnlocked, migrateSave, gatherAvailability, projectProduction, caps } from './engine.js'
import { Player, centerCameraOnAvatar } from './player.js'
import { INTERACTION_POINTS } from './mapLayout.js'
import { STAIRWAYS, stairProjection } from '../components/world/stairways.js'

test('centering the camera keeps the current zoom and does not move the captain', () => {
  const avatar = { x: 120.5, y: 40.25, isl: 'verdant' }
  const calls = []
  const camera = {
    view: () => ({ s: 0.62 }),
    flyTo: (...args) => calls.push(args),
    home: () => { throw new Error('must not fly home to New Haven') },
  }
  assert.equal(centerCameraOnAvatar(camera, avatar), true)
  assert.deepEqual(calls[0], [120.5, 40.25, 0.62, { duration: 300 }])
  assert.deepEqual(avatar, { x: 120.5, y: 40.25, isl: 'verdant' })
  centerCameraOnAvatar({ view: () => ({ s: 1.8 }), flyTo: (...args) => calls.push(args) }, avatar)
  assert.equal(calls[1][2], 1.8)
  assert.equal(centerCameraOnAvatar({ view: () => ({ s: 1 }), flyTo() {} }, null), false)
})

test('every painted stair flight is walkable in both directions using up and down controls', () => {
  const state = { ...createInitialState(), connected: ['newHaven','verdant','prism'], bridges: [
    { route: 'verdant-haven', type: 'rope', condition: 100 }, { route: 'prism-haven', type: 'rope', condition: 100 },
  ] }
  const player = new Player(state)
  for (const stair of STAIRWAYS) {
    assert.equal(player.canStep(stair.island, stair.from, stair.to), true, `${stair.id} has a blocked tread`)
    assert.equal(player.canStep(stair.island, stair.to, stair.from), true, `${stair.id} has a blocked return`)
    Object.assign(player.avatar, { isl: stair.island, x: stair.from[0], y: stair.from[1], legs: [], leg: null })
    player.setInput(0, 1)
    for (let i = 0; i < 200 && stairProjection(stair, [player.avatar.x,player.avatar.y]).t < .99; i++) player.update(.02)
    assert.ok(stairProjection(stair, [player.avatar.x,player.avatar.y]).t >= .99, `${stair.id} cannot be descended`)
    if (stair.id === 'verdant-bridge') {
      for (let i = 0; i < 8; i++) player.update(.02)
      assert.equal(player.avatar.isl, 'verdant', 'Descending the stairs must not accidentally enter the bridge')
    }
    player.setInput(0, -1)
    for (let i = 0; i < 200 && stairProjection(stair, [player.avatar.x,player.avatar.y]).t > .01; i++) player.update(.02)
    assert.ok(stairProjection(stair, [player.avatar.x,player.avatar.y]).t <= .01, `${stair.id} cannot be climbed`)
    player.setInput(0, 0)
  }
  assert.equal(player.canStep('newHaven', [780,760], [780,765]), false, 'Cliffs must remain blocked')
})

test('Prism stairs remain reversible after landing overshoot at different frame rates', () => {
  const state = { ...createInitialState(), connected: ['newHaven', 'prism'], bridges: [
    { route: 'prism-haven', type: 'rope', condition: 100 },
  ] }
  const stair = STAIRWAYS.find(stair => stair.id === 'prism-west-terrace')
  for (const frames of [[1/60], [1/30], [.05], [.1], [.016, .1, .033]]) {
    for (const extraFrames of [0, 2, 8]) {
      const player = new Player(state), a = player.avatar
      Object.assign(a, { isl: stair.island, x: stair.from[0], y: stair.from[1], legs: [], leg: null })
      let frame = 0
      const tick = () => player.update(frames[frame++ % frames.length])
      const progress = () => stairProjection(stair, [a.x, a.y]).t
      const context = `frames ${frames}, landing delay ${extraFrames}`
      player.setInput(0, 1)
      for (let i = 0; i < 300 && progress() < .98; i++) tick()
      assert.ok(progress() >= .98, `Cannot descend: ${context}`)
      // Browser polling/key release can arrive several frames after the foot.
      for (let i = 0; i < extraFrames; i++) tick()
      player.setInput(0, -1)
      for (let i = 0; i < 500 && progress() > .02; i++) tick()
      assert.ok(progress() <= .02, `Cannot return from the lower landing: ${context}`)
      for (let i = 0; i < extraFrames; i++) tick()
      player.setInput(0, 1)
      for (let i = 0; i < 500 && progress() < .98; i++) tick()
      assert.ok(progress() >= .98, `Cannot return from the upper landing: ${context}`)
      assert.equal(a.isl, 'prism')
    }
  }
})

test('the captain walks to a task before gathering, and movement itself grants no resources or XP', () => {
  let state = createInitialState()
  const player = new Player(state), before = { ...state.resources }, start = [player.avatar.x, player.avatar.y]
  assert.equal(player.request({ type: 'GATHER_WOOD' }, action => { state = gameReducer(state, action); player.sync(state) }), true)
  assert.deepEqual(state.resources, before)
  assert.equal(state.xp, 0)
  player.update(.1)
  assert.deepEqual(state.resources, before)
  for (let i = 0; player.pending && i < 1000; i++) player.update(.1)
  assert.equal(player.pending, null)
  assert.equal(state.resources.wood, before.wood + 6)
  assert.ok(Math.hypot(player.avatar.x-start[0], player.avatar.y-start[1]) > 30)
})

test('task tools animate only after arrival and dispatch once after visible work completes', () => {
  const actions = [
    ...['grove', 'stone', 'garden', 'collector', 'forest', 'forage', 'lumber', 'falls', 'fishing', 'crystals', 'salvage'].map(siteId => ({ type: 'GATHER_AT_SITE', siteId })),
    { type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 },
    { type: 'RESTORE_BEACON' }, { type: 'BUILD_BRIDGE', routeId: 'verdant-haven' },
    { type: 'REPAIR_BRIDGE', routeId: 'verdant-haven' }, { type: 'UPGRADE_BRIDGE', routeId: 'verdant-haven' },
  ]
  for (const action of actions) {
    const state = { ...createInitialState(), connected: Object.keys(ISLANDS), bridges: ROUTES.map(route => ({ route: route.id, type: 'rope', condition: 100 })) }
    const player = new Player(state), task = player.task(action), point = player.walkPoint(task.island, ...task.point)
    Object.assign(player.avatar, { isl: task.island, x: point[0], y: point[1] })
    let dispatched = 0
    assert.equal(player.request(action, () => dispatched++), true)
    assert.equal(player.avatar.task, null, 'No work animation while travelling')
    for (let i=0; !player.avatar.task && i<100; i++) player.update(.05)
    assert.ok(player.avatar.task, `Missing work animation for ${JSON.stringify(action)}`)
    const work = player.avatar.task
    assert.ok(work.duration >= 1.5, 'Give the work animation time to be seen')
    const before = work.progress
    player.update(.1)
    assert.ok(work.progress > before && work.progress < 1)
    assert.equal(dispatched, 0, 'No reward until the animation completes')
    for (let i=0; player.pending && i<100; i++) player.update(.1)
    assert.equal(dispatched, 1)
    assert.equal(player.avatar.task, null)
    for (let i=0; i<20; i++) player.update(.1)
    assert.equal(dispatched, 1, 'Animation completion cannot repeat rewards')
  }
})

test('cancelling or walking away during work removes tools and grants no reward', () => {
  for (const interrupt of [p => p.cancel(), p => p.setInput(1, 0)]) {
    const player = new Player(createInitialState()), point = player.walkPoint('newHaven', ...INTERACTION_POINTS.grove)
    Object.assign(player.avatar, { x: point[0], y: point[1] })
    let dispatched = 0
    player.request({ type: 'GATHER_WOOD' }, () => dispatched++)
    for (let i=0; !player.avatar.task && i<100; i++) player.update(.05)
    assert.ok(player.avatar.task)
    interrupt(player)
    assert.equal(player.avatar.task, null)
    for (let i=0; i<100; i++) player.update(.1)
    assert.equal(dispatched, 0)
    assert.equal(player.pending, null)
  }
})

test('keyboard movement stops on release and cancels a queued task without spending resources', () => {
  const state = createInitialState(), player = new Player(state)
  let dispatched = false
  player.request({ type: 'GATHER_WOOD' }, () => { dispatched = true })
  const start = [player.avatar.x, player.avatar.y]
  player.setInput(1, 0)
  for (let i = 0; i < 20; i++) player.update(.1)
  player.setInput(0, 0)
  const stopped = [player.avatar.x, player.avatar.y]
  assert.notDeepEqual(stopped, start)
  for (let i = 0; i < 20; i++) player.update(.1)
  assert.deepEqual([player.avatar.x, player.avatar.y], stopped)
  assert.equal(player.pending, null)
  assert.equal(dispatched, false)
})

test('the captain crosses a working bridge to reach tasks and cannot reach disconnected islands', () => {
  const initial = createInitialState(), player = new Player(initial)
  assert.equal(player.go('verdant', INTERACTION_POINTS.forest), false)
  const state = { ...initial, connected: ['newHaven', 'verdant'], bridges: [{ route: 'verdant-haven', type: 'reinforced', condition: 100 }] }
  player.sync(state)
  assert.equal(player.go('verdant', INTERACTION_POINTS.forest), true)
  let crossed = false
  for (let i = 0; player.pending && i < 2000; i++) { player.update(.1); if (!player.avatar.isl) crossed = true }
  assert.equal(player.pending, null)
  assert.equal(player.avatar.isl, 'verdant')
  assert.equal(crossed, true)
})

test('saved captain positions restore without advancing the town', () => {
  const initial = createInitialState(), player = new Player(initial)
  const position = { island: player.avatar.isl, x: player.avatar.x + .1, y: player.avatar.y + .1 }
  const saved = gameReducer(initial, { type: 'PLAYER_POSITION', position })
  assert.equal(saved.xp, initial.xp)
  assert.deepEqual(saved.resources, initial.resources)
  const restored = new Player(migrateSave(saved))
  assert.deepEqual([restored.avatar.isl, restored.avatar.x, restored.avatar.y], [position.island, position.x, position.y])
})

test('manual bridge landings save island coordinates without adding the floating offset twice', async () => {
  const { WORLD_ISLANDS, bridgePoints } = await import('../components/world/layout.js')
  const state = { ...createInitialState(), connected: ['newHaven', 'verdant'], bridges: [{ route: 'verdant-haven', type: 'rope', condition: 100 }] }
  const player = new Player(state), ends = bridgePoints('verdant-haven')
  const previous = WORLD_ISLANDS.verdant._bob
  try {
    WORLD_ISLANDS.verdant._bob = 2.2
    player.manualBridge = { route: 'verdant-haven', from: 1, toIsl: 'verdant', u: .995 }
    player.avatar.isl = null
    player.input = [ends.a[0]-ends.b[0], ends.a[1]-ends.b[1]]
    player.update(.1)
    assert.equal(player.avatar.isl, 'verdant')
    assert.deepEqual([player.avatar.x, player.avatar.y], ends.a)
    assert.deepEqual(player.safePosition, { island: 'verdant', x: ends.a[0], y: ends.a[1] })
  } finally { WORLD_ISLANDS.verdant._bob = previous }
})

test('building through the captain waits for arrival and leaves the captain outside the new footprint', () => {
  let state = createInitialState()
  const player = new Player(state), wood = state.resources.wood
  let workingPosition
  assert.equal(player.request({ type: 'BUILD', buildingType: 'shelter', island: 'newHaven', slot: 0 }, action => {
    workingPosition = [player.avatar.x, player.avatar.y]
    state = gameReducer(state, action); player.sync(state)
  }), true)
  assert.equal(state.resources.wood, wood)
  assert.equal(state.buildings.some(b => b.type === 'shelter'), false)
  for (let i = 0; player.pending && i < 1000; i++) player.update(.1)
  assert.ok(state.buildings.some(b => b.type === 'shelter'))
  const a = player.avatar
  assert.equal(player.canStep(a.isl, [a.x,a.y], [a.x,a.y]), true)
  assert.deepEqual([a.x, a.y], workingPosition, 'The captain should already be clear when the building appears')
  assert.ok(player.gridLeg(a.isl, a.x, a.y, 635, 610), 'There must be a path back to the workshop')
})

test('construction leaves a clear working spot and exit on crowded islands', async () => {
  const { bridgePoints } = await import('../components/world/layout.js')
  for (const [island, def] of Object.entries(ISLANDS)) {
    for (const type of ['shelter', 'communityHall']) for (let slot = 0; slot < def.plots.length; slot++) {
      const state = { ...createInitialState(), connected: Object.keys(ISLANDS), bridges: ROUTES.map(route => ({ route: route.id, type: 'reinforced', condition: 100 })) }
      state.buildings = [...state.buildings, ...def.plots.flatMap((_, index) => index === slot ? [] : [{ id: `neighbor${index}`, type: 'shelter', island, slot: index }])]
      const player = new Player(state), point = player.constructionPoint(type, island, slot)
      const context = `${type} on ${island} plot ${slot}`
      assert.ok(point, `No clear working spot for ${context}`)
      Object.assign(player.avatar, { isl: island, x: point[0], y: point[1] })
      player.sync({ ...state, buildings: [...state.buildings, { id: 'new-building', type, island, slot }] })
      assert.deepEqual([player.avatar.x, player.avatar.y], point, `Construction overlaps the captain: ${context}`)
      const exit = island === 'newHaven' ? [635, 610] : bridgePoints(ROUTES.find(route => route.b === island).id).a
      assert.ok(player.gridLeg(island, ...point, ...exit), `Construction blocks the exit: ${context}`)
    }
  }
})

test('a building appearing under the captain recovers and saves a usable position', () => {
  const state = createInitialState(), player = new Player(state), plot = ISLANDS.newHaven.plots[0]
  Object.assign(player.avatar, { isl: 'newHaven', x: plot[0], y: plot[1] })
  player.remember()
  let saved
  player.onSave = position => { saved = position }
  const built = { ...state, buildings: [...state.buildings, { id: 'new-building', type: 'shelter', island: 'newHaven', slot: 0 }] }
  player.sync(built)
  const a = player.avatar, safe = [a.x, a.y]
  assert.notDeepEqual(safe, plot)
  assert.equal(player.canStep(a.isl, safe, safe), true)
  assert.deepEqual(saved, { island: a.isl, x: a.x, y: a.y })
  assert.ok(player.gridLeg(a.isl, ...safe, 635, 610))
  assert.equal(player.go('newHaven', [635, 610]), true)
  for (let i = 0; player.pending && i < 1000; i++) player.update(.1)
  assert.equal(player.pending, null)
  assert.ok(Math.hypot(a.x-safe[0], a.y-safe[1]) > 10, 'The captain must be able to leave after recovery')
  const restored = new Player({ ...built, player: { island: 'newHaven', x: plot[0], y: plot[1] } })
  assert.notDeepEqual([restored.avatar.x, restored.avatar.y], plot, 'Old saves inside buildings must also recover')
  assert.ok(restored.gridLeg('newHaven', restored.avatar.x, restored.avatar.y, 635, 610))
})

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
  assert.equal(state.version, 6)
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


test('starter timber, stone, water and food deplete; rejected harvesting grants neither XP nor effects', () => {
  let state = createInitialState()
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove' })
  assert.equal(state.deposits.grove.stock, 0)
  const rejected = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove' })
  assert.equal(rejected.xp, state.xp)
  assert.equal(rejected.resources.wood, state.resources.wood)
  assert.equal(rejected.lastInteraction, state.lastInteraction)
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'stone' })
  assert.equal(state.deposits.stone.stock, 0)
  assert.match(gatherAvailability(state, 'stone'), /depleted/i)
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'collector' })
  assert.equal(state.deposits.collector.stock, 0)
  assert.match(gatherAvailability(state, 'collector'), /depleted/i)
  for (let i = 0; i < 2; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'garden' })
  assert.equal(state.deposits.garden.stock, 0)
  assert.match(gatherAvailability(state, 'garden'), /depleted/i)
  state = { ...state, connected: [...state.connected, 'verdant'], bridges: [{ route: 'verdant-haven', type: 'reinforced', condition: 100 }] }
  state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'forage' })
  assert.ok(state.resources.seeds > 0)
  assert.equal(state.deposits.garden.stock, 0)
  assert.match(gatherAvailability(state, 'garden'), /depleted/i)
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
  assert.ok(state.deposits.grove.stock > 0)
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
  const { bridgeCurve, Crowd } = await import('../components/world/people.js')
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
  const crowd = new Crowd()
  crowd.setState(initial, { newHaven: true }, 1)
  assert.deepEqual(crowd.links, {})
  const connected = ['newHaven', 'verdant', 'rain', 'prism', 'mercy', 'hearth']
  const state = { ...initial, connected, bridges: ROUTES.map(r => ({ route: r.id, type: 'rope', condition: 100 })) }
  crowd.setState(state, Object.fromEntries(connected.map(id => [id, true])), 1)
  const { bridgePoints } = await import('../components/world/layout.js')
  for (const route of ROUTES) {
    assert.ok(crowd.links[route.a].some(link => link.to === route.b && link.route === route.id))
    assert.ok(crowd.links[route.b].some(link => link.to === route.a && link.route === route.id))
    const ends = bridgePoints(route.id)
    for (const [island, end] of [[route.b, ends.a], [route.a, ends.b]]) {
      const [x, y] = ISLANDS[island].hit
      assert.ok(crowd.gridLeg(island, x, y, ...end), `Residents must reach the ${island} bridge landing`)
    }
  }
})

test('residents follow the live rope and reinforced decks when bridges are upgraded', async () => {
  const { Crowd, bridgeAt } = await import('../components/world/people.js')
  const crowd = new Crowd(), access = { newHaven: true, verdant: true }
  let state = { ...createInitialState(), connected: ['newHaven', 'verdant'],
    bridges: [{ route: 'verdant-haven', type: 'rope', condition: 100 }] }
  crowd.setState(state, access, 1)
  const person = crowd.agents[0]
  Object.assign(person, { isl: null, wait: 0, speed: 0, legs: [],
    leg: { route: 'verdant-haven', from: 0, toIsl: 'newHaven', u: .5 } })
  crowd.update(.1)
  assert.deepEqual([person.x, person.y], bridgeAt('verdant-haven', .5, 'rope'))
  state = { ...state, bridges: [{ ...state.bridges[0], type: 'reinforced' }] }
  crowd.setState(state, access, 1)
  crowd.update(.1)
  assert.deepEqual([person.x, person.y], bridgeAt('verdant-haven', .5, 'reinforced'))
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

test('consulting the gods charges energy and coins and writes the poem to the journal', () => {
  const rich = { ...createInitialState(), resources: { ...createInitialState().resources, energy: 30, coins: 60 } }
  const s = gameReducer(rich, { type: 'CONSULT_GODS', poem: '  Line one\nLine two  ' })
  assert.equal(s.resources.energy, 5)
  assert.equal(s.resources.coins, 10)
  const entry = s.journal.at(-1)
  assert.equal(entry.type, 'oracle')
  assert.equal(entry.text, 'Line one\nLine two')
  assert.equal(s.journalUnread, rich.journalUnread + 1)
  assert.equal(s.xp, rich.xp)
})

test('the gods take nothing without a poem or the full price', () => {
  const poor = createInitialState() // 12 energy, 40 coins
  const refused = gameReducer(poor, { type: 'CONSULT_GODS', poem: 'A riddle' })
  assert.deepEqual(refused.resources, poor.resources)
  assert.equal(refused.journal.length, poor.journal.length)
  assert.equal(gameReducer(poor, { type: 'CONSULT_GODS', poem: '   ' }), poor)
})

test('Friendly Cloud points to the Store and notices when the gods disagree', async () => {
  const { getAdvice, godsWord, GODS_FRESH_XP } = await import('./advisor.js')
  const start = { ...createInitialState(), resources: { ...createInitialState().resources, energy: 30, coins: 60 } }
  const tip = getAdvice(start)[0]
  assert.equal(tip.focus, 'shelter')
  assert.equal(godsWord(start, tip).kind, 'nudge')
  assert.match(godsWord(start, tip).link, /Store/)

  const differ = gameReducer(start, { type: 'CONSULT_GODS', poem: 'riddle', focus: 'verdant' })
  assert.deepEqual(differ.oracle, { focus: 'verdant', xp: start.xp })
  assert.equal(godsWord(differ, tip).kind, 'differ')
  assert.match(godsWord(differ, tip).link, /Store/)

  const agree = gameReducer(start, { type: 'CONSULT_GODS', poem: 'riddle', focus: 'shelter' })
  assert.equal(godsWord(agree, tip).kind, 'agree')
  assert.equal(godsWord({ ...agree, xp: agree.xp + GODS_FRESH_XP }, tip).kind, 'nudge') // stale
  assert.ok(getAdvice(start).every((t) => t.focus))
})

test('happiness depletion: food or water below 25% causes -1 per action', () => {
  // cap=100; 25% threshold; clear weather adds +1
  // After action net water=-1, so water=24 -> nextRes=23 (23% < 25%) -> lowSupplies: -1 + weather(+1) = 0
  const base = createInitialState()

  // Low water (24->23, 23% < 25%)
  const lowWater = { ...base, happiness: 60, resources: { ...base.resources, water: 24, food: 60, energy: 50 } }
  assert.equal(projectProduction(lowWater).net.happiness, 0)   // -1 penalty + 1 clear weather
  assert.equal(gameReducer(lowWater, { type: 'GATHER_WOOD' }).happiness, 60)

  // Low food (24->23, 23% < 25%)
  const lowFood = { ...base, happiness: 60, resources: { ...base.resources, water: 60, food: 24, energy: 50 } }
  assert.equal(projectProduction(lowFood).net.happiness, 0)
  assert.equal(gameReducer(lowFood, { type: 'GATHER_WOOD' }).happiness, 60)
})

test('happiness depletion: food and water at 25%+ follow normal rules', () => {
  // water=26->25 (25% = not < 25%), food=60->59 (59%) => no depletion
  // normal: needs met (+1) + clear weather (+1) = +2; happiness 60->62
  const base = createInitialState()
  const ok = { ...base, happiness: 60, resources: { ...base.resources, water: 26, food: 60, energy: 50 } }
  assert.equal(projectProduction(ok).net.happiness, 2)
  assert.equal(gameReducer(ok, { type: 'GATHER_WOOD' }).happiness, 62)
})

test('each gather node depletes on its own and grants nothing until its own timer', () => {
  const t0 = 1_700_000_000_000
  let state = createInitialState()
  const seeds = state.resources.seeds
  for (let i = 0; i < 6; i++) state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove', now: t0 })
  assert.equal(state.deposits.grove.stock, 0)
  assert.equal(state.deposits.grove.regrowAt, t0 + GATHER_SITES.grove.regrowMs)
  assert.equal(state.deposits.stone.stock, GATHER_SITES.stone.stock)
  assert.equal(state.deposits.forest.stock, GATHER_SITES.forest.stock)
  const empty = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove', now: t0 + 1 })
  assert.equal(empty.resources.wood, state.resources.wood)
  assert.equal(empty.xp, state.xp)
  assert.equal(empty.deposits.grove.stock, 0)
  const early = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove', now: state.deposits.grove.regrowAt - 1 })
  assert.equal(early.resources.wood, state.resources.wood)
  const refilled = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'grove', now: state.deposits.grove.regrowAt })
  assert.equal(refilled.resources.wood, state.resources.wood + 6)
  assert.equal(refilled.deposits.grove.stock, GATHER_SITES.grove.stock - 6)
  assert.equal(refilled.deposits.grove.regrowAt, 0)
  assert.equal(refilled.resources.seeds, seeds)
})

test('plants and stone regrow without spending inventory, and a reload cannot skip the wait', () => {
  const t0 = Date.now()
  let state = createInitialState()
  state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'garden', now: t0 })
  state = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'garden', now: t0 })
  assert.equal(state.deposits.garden.stock, 0)
  assert.equal(state.resources.seeds, 0)
  const waiting = gameReducer(state, { type: 'GATHER_AT_SITE', siteId: 'garden', now: t0 + 1_000 })
  assert.equal(waiting.resources.seeds, 0)
  assert.equal(waiting.resources.food, state.resources.food)
  assert.equal(waiting.xp, state.xp)
  const saved = JSON.parse(JSON.stringify(state))
  const reloaded = migrateSave(saved)
  assert.equal(reloaded.deposits.garden.stock, 0)
  assert.equal(reloaded.deposits.garden.regrowAt, state.deposits.garden.regrowAt)
  const skipped = gameReducer(reloaded, { type: 'GATHER_AT_SITE', siteId: 'garden', now: reloaded.deposits.garden.regrowAt - 1 })
  assert.equal(skipped.resources.food, reloaded.resources.food)
  let mined = gameReducer(reloaded, { type: 'GATHER_AT_SITE', siteId: 'stone', now: t0 })
  assert.equal(mined.deposits.garden.stock, 0)
  assert.equal(mined.resources.seeds, 0)
  for (let i = 0; i < 5; i++) mined = gameReducer(mined, { type: 'GATHER_AT_SITE', siteId: 'stone', now: t0 })
  assert.equal(mined.deposits.stone.stock, 0)
  assert.equal(mined.deposits.garden.regrowAt, reloaded.deposits.garden.regrowAt)
  const rested = gameReducer(mined, { type: 'GATHER_AT_SITE', siteId: 'stone', now: mined.deposits.stone.regrowAt })
  assert.equal(rested.resources.stone, mined.resources.stone + 3)
  assert.equal(rested.resources.seeds, 0)
})

test('old saves keep partial world stock and outer nodes start full', () => {
  const legacy = {
    ...createInitialState(), version: 5,
    deposits: { wood: 12, stone: 0, water: 18, food: 10 },
  }
  const loaded = migrateSave(legacy)
  assert.equal(loaded.version, 6)
  assert.equal(loaded.deposits.grove.stock, 12)
  assert.equal(loaded.deposits.stone.stock, 0)
  assert.ok(loaded.deposits.stone.regrowAt > Date.now())
  assert.equal(loaded.deposits.collector.stock, 18)
  assert.equal(loaded.deposits.garden.stock, 10)
  assert.equal(loaded.deposits.forest.stock, GATHER_SITES.forest.stock)
  const again = migrateSave(JSON.parse(JSON.stringify(loaded)))
  assert.equal(again.deposits.grove.stock, 12)
  assert.equal(again.deposits.stone.stock, 0)
  assert.equal(again.deposits.stone.regrowAt, loaded.deposits.stone.regrowAt)
  const partial = gameReducer(again, { type: 'GATHER_AT_SITE', siteId: 'grove', now: 1_700_000_000_000 })
  assert.equal(partial.resources.wood, again.resources.wood + 6)
  assert.equal(partial.deposits.grove.stock, 6)
})

test('the Captain avatar can be changed, is sanitised, and survives old saves', () => {
  const initial = createInitialState()
  assert.equal(initial.avatar.body, 'woman')
  const man = gameReducer(initial, { type: 'SET_AVATAR', avatar: { ...initial.avatar, body: 'man', beard: 'beard', top: '#5f9e4f', hat: 'straw' } })
  assert.deepEqual([man.avatar.body, man.avatar.beard, man.avatar.top, man.avatar.hat], ['man', 'beard', '#5f9e4f', 'straw'])
  assert.equal(man.xp, initial.xp)
  // unknown values fall back to the default; beards only for the man body
  const odd = gameReducer(initial, { type: 'SET_AVATAR', avatar: { body: 'woman', beard: 'beard', top: 'javascript:alert(1)', hat: 'crown' } })
  assert.equal(odd.avatar.beard, 'none')
  assert.equal(odd.avatar.top, initial.avatar.top)
  assert.equal(odd.avatar.hat, initial.avatar.hat)
  // a save from before avatars existed gets the default Captain
  const { avatar, ...old } = initial
  assert.deepEqual(migrateSave(old).avatar, initial.avatar)
  assert.equal(migrateSave(man).avatar.beard, 'beard')
})

test('Captain eyes are a style and a colour from the editor', () => {
  const s = gameReducer(createInitialState(), { type: 'SET_AVATAR', avatar: { body: 'man', eyes: 'happy', eyeColor: '#3a6fb8' } })
  assert.deepEqual([s.avatar.eyes, s.avatar.eyeColor], ['happy', '#3a6fb8'])
  const bad = gameReducer(createInitialState(), { type: 'SET_AVATAR', avatar: { eyes: 'laser', eyeColor: 'red' } })
  assert.deepEqual([bad.avatar.eyes, bad.avatar.eyeColor], ['lashes', '#5a3a24'])
})

test('designing the Captain marks it as set, and that survives saving and loading', () => {
  const fresh = createInitialState()
  assert.equal(fresh.avatarSet, false)
  const set = gameReducer(fresh, { type: 'SET_AVATAR', avatar: fresh.avatar })
  assert.equal(set.avatarSet, true)
  assert.equal(migrateSave(JSON.parse(JSON.stringify(set))).avatarSet, true)
  const { avatarSet, ...old } = fresh
  assert.equal(migrateSave(old).avatarSet, false)
})
