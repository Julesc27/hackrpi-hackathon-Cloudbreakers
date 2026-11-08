import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { STAIRWAYS, stairProjection } from '../src/components/world/stairways.js'
import { ISLANDS, GATHER_SITES } from '../src/game/data.js'
import { INTERACTION_POINTS } from '../src/game/mapLayout.js'

const saveKey = 'cloudbreakers-save-v1'
const checkpoint = (name) => JSON.parse(readFileSync(new URL(`./checkpoints/${name}.json`, import.meta.url), 'utf8'))

async function startAt(page, name, overrides = {}) {
  const save = { ...checkpoint(name), ...overrides }
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem('cloudbreakers-guest', '1')
    localStorage.setItem(key, JSON.stringify(state))
  }, { key: saveKey, state: save })
  await page.goto('/')
  await expect(page.locator('[data-tutorial="hud-level"]')).toBeVisible()
  return save
}

async function savedTown(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey)
}

async function expectSave(page, predicate) {
  await expect.poll(async () => predicate(await savedTown(page)), { timeout: 20_000 }).toBeTruthy()
}

test('building combines carried and stored materials and spends them only after the captain finishes', async ({ page }) => {
  const initial=checkpoint('new-town')
  await startAt(page,'new-town',{resources:{...initial.resources,wood:4,stone:0},backpack:{wood:6,stone:2,fish:2}})
  const startBuild=async()=>{
    await page.locator('[data-tutorial="rail-build"]').click()
    const build=page.locator('[data-tutorial="build-btn-shelter"]')
    await expect(build).toBeEnabled()
    await expect(page.locator('[data-tutorial="build-card-shelter"] .is-short')).toHaveCount(0)
    await build.click();await page.locator('[data-tutorial="plot-newHaven"]').click()
  }
  await startBuild()
  const captain=page.getByRole('button',{name:'Center me',exact:true})
  await expect(captain).toHaveAttribute('data-player-task','build')
  expect((await savedTown(page)).backpack.wood).toBe(6)
  expect((await savedTown(page)).resources.wood).toBe(4)
  await page.keyboard.press('Escape')
  expect((await savedTown(page)).buildings.some(b=>b.type==='shelter')).toBe(false)
  await startBuild()
  await expectSave(page,s=>s.buildings.some(b=>b.type==='shelter'))
  const built=await savedTown(page)
  expect(built.resources.wood).toBe(0);expect(built.resources.stone).toBe(0)
  expect(built.backpack.wood).toBe(0);expect(built.backpack.stone).toBe(0);expect(built.backpack.fish).toBe(2)
  expect(built.buildings.find(b=>b.type==='shelter').paidCost).toEqual({wood:10,stone:2})
  await expect(page.locator('[data-tutorial="rail-backpack"]')).toContainText('2/20')
  const restored=await page.context().newPage();await restored.goto('/')
  await expect(restored.locator('[data-tutorial="rail-backpack"]')).toContainText('2/20')
})

test('a bridge can be planned and built with wood split between the backpack and town', async ({ page }) => {
  const initial=checkpoint('anchor-ready')
  await startAt(page,'anchor-ready',{resources:{...initial.resources,wood:4},backpack:{wood:10}})
  await page.getByRole('button',{name:'Explore Verdant Reach',exact:true}).focus();await page.keyboard.press('Enter')
  await page.getByRole('button',{name:'Plan a bridge',exact:true}).click()
  const option=page.getByRole('dialog',{name:'Bridge to Verdant Reach'}).locator('.bridge-option').filter({hasText:'Rope & Plank'})
  await expect(option.locator('.is-short')).toHaveCount(0)
  const build=option.getByRole('button',{name:'Build bridge',exact:true})
  await expect(build).toBeEnabled();await build.click()
  await expectSave(page,s=>s.bridges.some(b=>b.route==='verdant-haven'))
  const built=await savedTown(page)
  // Connecting the forest produces its normal yield after the bridge cost is paid.
  expect(built.resources.wood).toBe(ISLANDS.verdant.yields.wood)
  expect(built.backpack.wood).toBe(0)
  expect(built.bridges.find(b=>b.route==='verdant-haven').paidCost).toEqual({wood:14})
})

test('a forecast can be prepared for by upgrading a shelter, with cancellable captain work', async ({ page }, testInfo) => {
  const initial = checkpoint('shelter-built')
  const town = await startAt(page,'shelter-built',{ version:7, weather:'clear', forecast:'heavyRain', weatherCycle:{...initial.weatherCycle,phase:'warning',remaining:1} })
  const watch=page.getByRole('button',{name:'Weather and shelter readiness'})
  await expect(watch).toContainText('Heavy Rain in 1 job')
  await watch.click()
  const dialog=page.getByRole('dialog',{name:'Weather readiness',exact:true})
  await expect(dialog.getByRole('status')).toContainText('0 of 1 shelters meet level 2')
  await page.screenshot({path:testInfo.outputPath('weather-warning.png')})
  await dialog.getByRole('button',{name:/Upgrade to level 2/}).click()
  const captain=page.getByRole('button',{name:'Center me',exact:true})
  await expect(captain).toHaveAttribute('data-player-task','repair')
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await page.keyboard.press('Escape')
  expect((await savedTown(page)).weatherCycle.remaining).toBe(1)
  await watch.click()
  await dialog.getByRole('button',{name:/Upgrade to level 2/}).click()
  await expectSave(page,s=>s.buildings.some(b=>b.type==='shelter'&&b.shelterLevel===2))
  let upgraded=await savedTown(page)
  expect(upgraded.resources.wood).toBe(town.resources.wood-6)
  expect(upgraded.resources.stone).toBe(town.resources.stone-3)
  expect(upgraded.weather).toBe('heavyRain')
  await expect(watch).toContainText('1/1 ready')
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  await expectSave(page,s=>s.weatherCycle.remaining===4)
  upgraded=await savedTown(page)
  expect(upgraded.buildings.find(b=>b.type==='shelter').condition).toBe(100)
  const restored=await page.context().newPage();await restored.goto('/')
  await expect(restored.getByRole('button',{name:'Weather and shelter readiness'})).toContainText('Heavy Rain · 4 jobs left')
})

test('an unprepared shelter loses its beds and can be repaired after the event', async ({ page }) => {
  const initial=checkpoint('shelter-built')
  await startAt(page,'shelter-built',{version:7,weather:'heavyRain',forecast:'heavyRain',weatherCycle:{...initial.weatherCycle,phase:'active',remaining:1},buildings:initial.buildings.map(b=>b.type==='shelter'?{...b,shelterLevel:1,condition:20}:b)})
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  await expectSave(page,s=>s.buildings.find(b=>b.type==='shelter').condition===0)
  expect((await savedTown(page)).weather).toBe('clear')
  await page.getByRole('button',{name:'Inspect Shelter',exact:true}).focus();await page.keyboard.press('Enter')
  const dialog=page.getByRole('dialog',{name:'Shelter',exact:true})
  await expect(dialog).toContainText('Provides 0 beds')
  await expect(dialog).toContainText('Uninhabitable')
  await dialog.getByRole('button',{name:/Repair shelter/}).click()
  await expectSave(page,s=>s.buildings.find(b=>b.type==='shelter').condition===100)
  await page.getByRole('button',{name:'Inspect Shelter',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(dialog).toContainText('Provides 4 beds')
})

test('weather preparation is visible and usable on a phone', async ({ page }, testInfo) => {
  await page.setViewportSize({width:390,height:664})
  const initial=checkpoint('shelter-built')
  await startAt(page,'shelter-built',{version:7,weather:'clear',forecast:'crosswind',weatherCycle:{...initial.weatherCycle,phase:'warning',remaining:6}})
  const watch=page.getByRole('button',{name:'Weather and shelter readiness'})
  await expect(watch).toBeInViewport()
  const rail=await page.locator('.left-rail').boundingBox(),box=await watch.boundingBox()
  expect(box.x).toBeGreaterThan(rail.x+rail.width)
  await watch.click()
  const upgrade=page.getByRole('dialog',{name:'Weather readiness',exact:true}).getByRole('button',{name:/Upgrade to level 2/})
  await upgrade.scrollIntoViewIfNeeded();await expect(upgrade).toBeInViewport()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({path:testInfo.outputPath('weather-phone.png')})
  await upgrade.click()
  await expectSave(page,s=>s.buildings.some(b=>b.type==='shelter'&&b.shelterLevel===2))
})

test('removing a shelter previews its materials, can be cancelled, and frees its plot', async ({ page }, testInfo) => {
  const initial = await startAt(page, 'shelter-built')
  const shelter = initial.buildings.find(b => b.type === 'shelter')
  const captain = page.getByRole('button', { name: 'Center me', exact: true })
  const inspect = async () => {
    await page.getByRole('button', { name: 'Inspect Shelter', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Remove Shelter', exact: true }).click()
  }
  await inspect()
  const dialog = page.getByRole('dialog', { name: 'Remove Shelter?', exact: true })
  await expect(dialog.getByText('+5 Wood', { exact: true })).toBeVisible()
  await expect(dialog.getByText('+1 Stone', { exact: true })).toBeVisible()
  await expect(dialog).toContainText('Removes 4 beds')
  await page.screenshot({ path: testInfo.outputPath('remove-shelter.png') })
  await dialog.getByRole('button', { name: 'Keep it' }).click()
  await expect(page.getByRole('dialog', { name: 'Shelter', exact: true })).toBeVisible()
  expect((await savedTown(page)).buildings.some(b => b.id === shelter.id)).toBe(true)
  await page.getByRole('button', { name: 'Remove Shelter', exact: true }).click()
  await dialog.getByRole('button', { name: 'Remove and recover supplies' }).click()
  await expect(captain).toHaveAttribute('data-player-task', 'repair')
  expect((await savedTown(page)).resources.wood).toBe(initial.resources.wood)
  await page.keyboard.press('Escape')
  await expect(captain).toHaveAttribute('data-player-busy', 'false')
  expect((await savedTown(page)).buildings.some(b => b.id === shelter.id)).toBe(true)
  await inspect()
  await dialog.getByRole('button', { name: 'Remove and recover supplies' }).click()
  await expectSave(page, s => !s.buildings.some(b => b.id === shelter.id))
  const removed = await savedTown(page)
  expect(removed.resources.wood).toBe(initial.resources.wood+5)
  expect(removed.resources.stone).toBe(initial.resources.stone+1)
  expect(removed.xp).toBe(initial.xp)
  await expect(page.getByRole('button', { name: 'Inspect Shelter', exact: true })).toHaveCount(0)
  await page.locator('[data-tutorial="rail-build"]').click()
  await page.locator('[data-tutorial="build-btn-shelter"]').click()
  await page.locator('[data-tutorial="plot-newHaven"]').first().click()
  await expectSave(page, s => s.buildings.some(b => b.type === 'shelter' && b.slot === shelter.slot))
})

test('dismantling an island bridge brings the captain home and preserves island buildings', async ({ page }) => {
  test.setTimeout(60_000)
  const initial = checkpoint('all-bridges')
  const town = await startAt(page, 'all-bridges', {
    player: { island: 'verdant', x: INTERACTION_POINTS.forest[0], y: INTERACTION_POINTS.forest[1] },
    buildings: [...initial.buildings, { id: 'forest-garden', type: 'garden', island: 'verdant', slot: 0 }],
  })
  const crossing = page.getByRole('button', { name: 'Manage New Haven ↔ Verdant Reach bridge', exact: true })
  await crossing.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Remove Verdant Reach bridge', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Remove Verdant Reach bridge?', exact: true })
  await expect(dialog).toContainText('Disconnects Verdant Reach')
  await dialog.getByRole('button', { name: 'Remove and recover supplies' }).click()
  expect((await savedTown(page)).bridges.some(b => b.route === 'verdant-haven')).toBe(true)
  await expectSave(page, s => !s.bridges.some(b => b.route === 'verdant-haven'))
  const removed = await savedTown(page)
  expect(removed.player.island).toBe('newHaven')
  expect(removed.connected).not.toContain('verdant')
  expect(removed.buildings.some(b => b.id === 'forest-garden')).toBe(true)
  expect(removed.resources.wood).toBe(town.resources.wood+7)
  expect(removed.xp).toBe(town.xp)
  await expect(crossing).toHaveCount(0)
  await expect(page.locator('.skymap .bridge')).toHaveCount(4)
})

test('the captain and residents walk around a built shelter', async ({ page }) => {
  const plot = ISLANDS.newHaven.plots[0], initial = checkpoint('new-town')
  await startAt(page, 'new-town', { buildings: [...initial.buildings, { id: 'obstacle', type: 'shelter', island: 'newHaven', slot: 0 }], player: { island: 'newHaven', x: plot[0]-55, y: plot[1] } })
  await page.evaluate(async plot => {
    const { Player } = await import('/src/game/player.js')
    const { Crowd } = await import('/src/components/world/people.js')
    window.buildingViolations = 0; window.captainDetoured = false; window.residentSamples = 0
    const inspect = a => {
      if (a.isl !== 'newHaven') return
      if (Math.abs(a.x-plot[0])/26+Math.abs(a.y-plot[1])/13 < 1) window.buildingViolations++
    }
    const updatePlayer = Player.prototype.update, updateCrowd = Crowd.prototype.update
    Player.prototype.update = function(dt) { updatePlayer.call(this,dt); inspect(this.avatar); if (Math.abs(this.avatar.y-plot[1]) > 13) window.captainDetoured = true }
    Crowd.prototype.update = function(dt) { updateCrowd.call(this,dt); for (const a of this.agents) if (a.role !== 'captain') { inspect(a); window.residentSamples++ } }
  }, plot)
  const goal = [plot[0]+65,plot[1]]
  const screen = await page.evaluate(([x,y]) => { const p = new DOMPoint(x,y).matrixTransform(document.querySelector('.skymap').getScreenCTM()); return { x:p.x, y:p.y } }, goal)
  await page.mouse.dblclick(screen.x,screen.y)
  const captain = page.getByRole('button', { name: 'Center me', exact: true })
  await expect(captain).toHaveAttribute('data-player-busy', 'true')
  await expect(captain).toHaveAttribute('data-player-busy', 'false', { timeout: 15_000 })
  expect(Number(await captain.getAttribute('data-player-x'))).toBeGreaterThan(plot[0]+40)
  expect(await page.evaluate(() => window.captainDetoured)).toBe(true)
  expect(await page.evaluate(() => window.residentSamples)).toBeGreaterThan(30)
  expect(await page.evaluate(() => window.buildingViolations)).toBe(0)
})

for (const id of ['newHaven-central-front', 'verdant-bridge', 'prism-west-terrace']) {
  test(`the captain can descend and climb ${id} with arrow keys`, async ({ page }, testInfo) => {
    const stair = STAIRWAYS.find(stair => stair.id === id)
    await startAt(page, 'all-bridges', { player: { island: stair.island, x: stair.from[0], y: stair.from[1] } })
    const controls = page.getByRole('button', { name: 'Center me' })
    await expect(controls).toHaveAttribute('data-player-island', stair.island)
    await page.getByRole('button', { name: 'Center me' }).click()
    const progress = async () => stairProjection(stair, [Number(await controls.getAttribute('data-player-x')), Number(await controls.getAttribute('data-player-y'))]).t
    await page.keyboard.down('ArrowDown')
    await expect.poll(progress, { intervals: [50], timeout: 8_000 }).toBeGreaterThan(.98)
    await page.keyboard.up('ArrowDown')
    await page.screenshot({ path: testInfo.outputPath(`${id}-descended.png`) })
    await page.keyboard.down('ArrowUp')
    await expect.poll(progress, { intervals: [50], timeout: 8_000 }).toBeLessThan(.02)
    await page.keyboard.up('ArrowUp')
  })
}

test('the captain must arrive before harvesting and can interact again with E', async ({ page }) => {
  const town = await startAt(page, 'new-town')
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  const captain = page.getByRole('button', { name: 'Center me' })
  await expect(captain).toHaveAttribute('data-player-busy', 'true')
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await page.keyboard.press('Escape')
  await expect(captain).toHaveAttribute('data-player-busy', 'false')
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  await expect(captain).toHaveAttribute('data-player-task', 'chop')
  await expect.poll(async () => Number(await captain.getAttribute('data-player-progress')), { intervals: [50] }).toBeGreaterThan(0)
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await page.keyboard.press('Escape')
  await expect(captain).toHaveAttribute('data-player-task', '')
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  await expectSave(page, s => s.backpack.wood === 6)
  await expect(captain).toHaveAttribute('data-player-busy', 'false')
  await page.keyboard.press('e')
  await expectSave(page, s => s.backpack.wood === 12)
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
})

test('the side bar backpack is separate from town storage and deposits at the workshop', async ({ page }, testInfo) => {
  const initial = await startAt(page, 'new-town', { player: { island: 'newHaven', x: 580, y: 460 } })
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  await expectSave(page, s => s.backpack.wood === 6)
  const gathered = await savedTown(page)
  expect(gathered.resources.wood).toBe(initial.resources.wood)
  const nav = page.locator('[data-tutorial="rail-backpack"]')
  await expect(nav).toContainText('6/20')
  await nav.click()
  const dialog = page.getByRole('dialog', { name: 'Backpack', exact: true })
  await expect(dialog.getByRole('row').filter({ hasText: 'Wood' })).toContainText('6')
  await page.screenshot({ path: testInfo.outputPath('backpack-storage.png') })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('[data-tutorial="nav-storage"]').click()
  const storage = page.getByRole('dialog', { name: 'Storehouse' })
  await expect(storage.getByRole('row').filter({ hasText: 'Wood' })).toContainText('24')
  await expect(storage.getByRole('button', { name: 'Deposit All' })).toHaveCount(0)
  await expect(storage.getByRole('tab')).toHaveCount(0)
  await storage.getByRole('button', { name: 'Close', exact: true }).click()
  await nav.click()
  await dialog.getByRole('button', { name: 'Deposit All', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Center me' })).toHaveAttribute('data-player-busy', 'true')
  expect((await savedTown(page)).backpack.wood).toBe(6)
  await expectSave(page, s => s.backpack.wood === 0 && s.resources.wood === initial.resources.wood+6)
  const stored = await savedTown(page)
  expect(stored.xp).toBe(gathered.xp)
  for (const key of ['food', 'water', 'energy']) expect(stored.resources[key]).toBe(gathered.resources[key])
  const restored = await page.context().newPage()
  await restored.goto('/')
  await expect(restored.locator('[data-tutorial="rail-backpack"]')).toContainText('0/20')
  const wood = await restored.evaluate(key => JSON.parse(localStorage.getItem(key)).resources.wood, saveKey)
  expect(wood).toBe(initial.resources.wood+6)
})

test('a full backpack blocks materials and can be brought home from another island', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const initial = await startAt(page, 'all-bridges', { backpack: { wood: 17, crystals: 3 }, player: { island: 'verdant', x: INTERACTION_POINTS.forest[0], y: INTERACTION_POINTS.forest[1] } })
  const site = page.locator('.interaction-sites').getByRole('button', { name: /^Harvest timber/ })
  await site.focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.toasts')).toContainText('Backpack full')
  expect((await savedTown(page)).xp).toBe(initial.xp)
  await page.locator('[data-tutorial="rail-backpack"]').click()
  await expect(page.getByRole('progressbar', { name: 'Backpack space' })).toHaveAttribute('value', '20')
  await page.screenshot({ path: testInfo.outputPath('backpack-full.png') })
  await page.getByRole('button', { name: 'Return & deposit all' }).click()
  await expect.poll(async () => (await savedTown(page)).backpack.wood, { timeout: 40_000 }).toBe(0)
  const stored = await savedTown(page)
  expect(stored.player.island).toBe('newHaven')
  expect(stored.resources.wood).toBe(initial.resources.wood+17)
  expect(stored.resources.crystals).toBe(initial.resources.crystals+3)
  expect(stored.xp).toBe(initial.xp)
})

test('the backpack side action and capacity fit on a phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await startAt(page, 'new-town', { backpack: { wood: 8, stone: 3 } })
  const button = page.locator('[data-tutorial="rail-backpack"]')
  await expect(button).toBeInViewport()
  await expect(button).toContainText('11/20')
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'Backpack', exact: true })
  await expect(dialog.getByRole('button', { name: 'Deposit All', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('backpack-phone.png') })
})

test('shared town storage shows used of 250 and refuses a gather when it is full', async ({ page }, testInfo) => {
  const start = await startAt(page, 'new-town')
  const stored = start.resources.wood + start.resources.stone + start.resources.food + start.resources.seeds + start.resources.water
  await expect(page.getByRole('button', { name: `Storage, ${stored} of 250` })).toBeVisible()
  await page.getByRole('button', { name: `Storage, ${stored} of 250` }).click()
  const storehouse = page.getByRole('dialog', { name: 'Storehouse' })
  await expect(storehouse.locator('[data-tutorial="storage-total"]')).toContainText(`${stored}/250`)
  await expect(storehouse.locator('[data-tutorial="storage-total"]')).toContainText('Energy and coins are separate')
  await page.keyboard.press('Escape')
  const fullWood = start.resources.wood + (250 - stored)
  await startAt(page, 'new-town', { resources: { ...start.resources, wood: fullWood } })
  const fullButton = page.getByRole('button', { name: 'Storage, 250 of 250, full' })
  await expect(fullButton).toBeVisible()
  await fullButton.click()
  const fullHouse = page.getByRole('dialog', { name: 'Storehouse' })
  await expect(fullHouse.locator('[data-tutorial="storage-total"]')).toContainText('250/250')
  await expect(fullHouse.locator('[data-tutorial="storage-total"]')).toContainText('Storage is full')
  await page.screenshot({ path: testInfo.outputPath('storage-full.png') })
  await page.keyboard.press('Escape')
  const before = await savedTown(page)
  await page.locator('[data-tutorial="island-newHaven"]').click()
  const island = page.getByRole('dialog', { name: 'New Haven' })
  await expect(island).toContainText('Storage is full (250/250)')
  const water = island.getByRole('button', { name: /Collect fresh water/ })
  await expect(water).toBeDisabled()
  await water.click({ force: true })
  const after = await savedTown(page)
  expect(after.resources).toEqual(before.resources)
  expect(after.xp).toBe(before.xp)
  expect(after.deposits.collector).toEqual(before.deposits.collector)
})

test('a built storage house shows its capacity and accepts supplies directly', async ({ page }, testInfo) => {
  await startAt(page, 'new-town', { xp: 100, backpack: { wood: 20 } })
  await page.locator('[data-tutorial="rail-build"]').click()
  await page.locator('[data-tutorial="build-btn-storageHouse"]').click()
  await page.locator('[data-tutorial="plot-newHaven"]').click()
  await expectSave(page, s => s.buildings.some(b => b.type === 'storageHouse'))
  const built = await savedTown(page)
  const house = page.getByRole('button', { name: 'Inspect Storage House', exact: true })
  await house.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Storage House', exact: true })
  await expect(dialog.getByText('125', { exact: true })).toHaveCount(3)
  await expect(dialog.getByRole('button', { name: 'Deposit All Here' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('storage-house.png') })
  await dialog.getByRole('button', { name: 'Deposit All Here' }).click()
  await expectSave(page, s => s.backpack.wood === 0 && s.resources.wood === built.resources.wood+8)
  expect((await savedTown(page)).xp).toBe(built.xp)
  await house.focus(); await page.keyboard.press('Enter')
  await expect(dialog.getByRole('button', { name: 'Deposit All Here' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'View Town Storage' }).click()
  await expect(page.getByRole('dialog', { name: 'Storehouse' })).toBeVisible()
})

test('an island storage house unloads locally without a trip to New Haven', async ({ page }) => {
  const initial = checkpoint('all-bridges'), point = ISLANDS.verdant.plots[0]
  await startAt(page, 'all-bridges', { buildings: [...initial.buildings, { id: 'forest-storehouse', type: 'storageHouse', island: 'verdant', slot: 0 }], backpack: { wood: 8 }, player: { island: 'verdant', x: point[0], y: point[1] } })
  const house = page.getByRole('button', { name: 'Inspect Storage House', exact: true })
  await house.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Storage House', exact: true })
  await expect(dialog).toContainText('Verdant Reach')
  await dialog.getByRole('button', { name: 'Deposit All Here' }).click()
  await expectSave(page, s => s.backpack.wood === 0)
  const stored = await savedTown(page)
  expect(stored.player.island).toBe('verdant')
  expect(stored.resources.wood).toBe(initial.resources.wood+8)
  expect(stored.xp).toBe(initial.xp)
})

for (const [siteId, kind] of [['stone', 'mine'], ['garden', 'garden'], ['collector', 'collect'], ['crystals', 'crystal'], ['fishing', 'fish']]) {
  test(`the captain shows ${kind} work and progress at ${siteId}`, async ({ page }, testInfo) => {
    const site = GATHER_SITES[siteId], point = INTERACTION_POINTS[siteId]
    await startAt(page, 'all-bridges', { player: { island: site.island, x: point[0], y: point[1] } })
    const captain = page.getByRole('button', { name: 'Center me' })
    await captain.click()
    const target = page.locator('.interaction-sites').getByRole('button', { name: new RegExp(`^${site.label}`) })
    await target.focus(); await page.keyboard.press('Enter')
    await expect(captain).toHaveAttribute('data-player-task', kind)
    await expect.poll(async () => Number(await captain.getAttribute('data-player-progress')), { intervals: [50] }).toBeGreaterThan(.1)
    await page.screenshot({ path: testInfo.outputPath(`captain-${kind}.png`) })
    await expect(captain).toHaveAttribute('data-player-busy', 'false')
    await expect(captain).toHaveAttribute('data-player-task', '')
    expect((await savedTown(page)).lastInteraction.siteId).toBe(siteId)
  })
}

test('WASD moves the captain, saves their position, and does not advance the town', async ({ page }) => {
  const town = await startAt(page, 'new-town')
  const captain = page.getByRole('button', { name: 'Center me' })
  await expect(captain).toBeVisible()
  const startX = Number(await captain.getAttribute('data-player-x'))
  await page.keyboard.down('d')
  await expect.poll(async () => Number(await captain.getAttribute('data-player-x'))).toBeGreaterThan(startX + 4)
  await page.keyboard.up('d')
  await expectSave(page, s => s.player?.x > startX + 4)
  const saved = await savedTown(page)
  expect(saved.xp).toBe(town.xp)
  expect(saved.resources).toEqual(town.resources)
  // A new tab uses the saved town without rerunning this page's checkpoint initializer.
  const restored = await page.context().newPage()
  await restored.goto('/')
  const restoredCaptain = restored.getByRole('button', { name: 'Center me' })
  await expect(restoredCaptain).toHaveAttribute('data-player-island', 'newHaven')
  await expect.poll(async () => Number(await restoredCaptain.getAttribute('data-player-x'))).toBeCloseTo(saved.player.x, 0)
})

test('the captain walks across built bridges to a selected island', async ({ page }, testInfo) => {
  const town = await startAt(page, 'all-bridges')
  const captain = page.getByRole('button', { name: 'Center me' })
  await page.getByRole('button', { name: 'Walk on Verdant Reach', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(captain).toHaveAttribute('data-player-island', 'newHaven')
  await expect(captain).toHaveAttribute('data-player-island', 'verdant', { timeout: 25_000 })
  await expect(captain).toHaveAttribute('data-player-busy', 'false', { timeout: 20_000 })
  const saved = await savedTown(page)
  expect(saved.resources).toEqual(town.resources)
  expect(saved.xp).toBe(town.xp)
  await page.getByRole('button', { name: 'Center me' }).click()
  await page.evaluate(() => new Promise(resolve => { let frames = 30; const next = () => --frames ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next) }))
  await page.screenshot({ path: testInfo.outputPath('captain-on-verdant.png') })
})

test('touch controls fit on a phone and tapping a path moves the captain', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    const town = await startAt(page, 'new-town')
    const controls = page.getByRole('button', { name: 'Center me' })
    await expect(page.getByRole('button', { name: /Walk (up|down|left|right)/ })).toHaveCount(0)
    await expect(controls).toBeVisible()
    await page.waitForFunction(async () => {
      const { PAINTED_ATLASES, getPaintedAtlas } = await import('/src/components/world/paintedArt.js')
      return Object.keys(PAINTED_ATLASES).every(key => getPaintedAtlas(key).ready)
    })
    await page.evaluate(() => new Promise(resolve => { let frames = 20; const next = () => --frames ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next) }))
    await page.screenshot({ path: testInfo.outputPath('captain-mobile-before.png') })
    await page.getByRole('button', { name: 'Walk on New Haven', exact: true }).dblclick({ timeout: 5_000 })
    await expect(controls).toHaveAttribute('data-player-busy', 'true')
    await expect(controls).toHaveAttribute('data-player-busy', 'false', { timeout: 20_000 })
    expect((await savedTown(page)).resources).toEqual(town.resources)
    const box = await controls.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x+box.width).toBeLessThanOrEqual(390)
    expect(box.y+box.height).toBeLessThanOrEqual(844)
    await page.screenshot({ path: testInfo.outputPath('captain-mobile.png') })
  } finally { await context.close() }
})

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`residents keep walking with reduced motion set to ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await startAt(page, 'all-bridges')
    // Observe the crowd updated by the real canvas loop, without advancing it ourselves.
    await page.evaluate(async () => {
      const { Crowd } = await import('/src/components/world/people.js')
      const update = Crowd.prototype.update, positions = new Map()
      window.residentWalkDistance = 0
      Crowd.prototype.update = function(dt) {
        update.call(this, dt)
        for (const person of this.agents) {
          const previous = positions.get(person.id)
          if (previous) window.residentWalkDistance += Math.hypot(person.x - previous[0], person.y - previous[1])
          positions.set(person.id, [person.x, person.y])
        }
      }
    })
    await expect.poll(() => page.evaluate(() => window.residentWalkDistance), { timeout: 12_000 }).toBeGreaterThan(10)
  })
}

for (const checkpointName of ['all-bridges', 'all-reinforced']) {
  test(`the complete bridge network (${checkpointName}) renders and both eastern crossings can be managed`, async ({ page }, testInfo) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startAt(page, checkpointName)
    await expect(page.locator('.skymap .bridge')).toHaveCount(5)
    await page.getByRole('button', { name: 'Fold Cloud away' }).click()
    await page.waitForFunction(async () => {
      const { PAINTED_ATLASES, getPaintedAtlas } = await import('/src/components/world/paintedArt.js')
      return Object.keys(PAINTED_ATLASES).every(key => getPaintedAtlas(key).ready)
    })
    // The world fills its sprite cache over several animation frames after decoding.
    await page.evaluate(() => new Promise(resolve => {
      let frames = 20
      const painted = () => --frames ? requestAnimationFrame(painted) : resolve()
      requestAnimationFrame(painted)
    }))
    await page.screenshot({ path: testInfo.outputPath('complete-network.png') })
    for (const island of ['Hearthside', 'Prism Shelf']) {
      const crossing = page.getByRole('button', { name: `Manage New Haven ↔ ${island} bridge`, exact: true })
      await crossing.focus()
      await crossing.press('Enter')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await page.mouse.move(915, 480)
    await page.mouse.wheel(0, -400)
    await page.screenshot({ path: testInfo.outputPath('eastern-landings.png') })
    await page.keyboard.press('0')
    await page.evaluate(() => new Promise(resolve => {
      let frames = 30
      const painted = () => --frames ? requestAnimationFrame(painted) : resolve()
      requestAnimationFrame(painted)
    }))
    await page.mouse.move(520, 465)
    await page.mouse.wheel(0, -600)
    await page.screenshot({ path: testInfo.outputPath('western-landings.png') })
    expect(errors).toEqual([])
  })
}

test('the tutorial advances through gathering, building and the quest book', async ({ page }) => {
  const fresh = checkpoint('new-town')
  await page.addInitScript(({ key, state }) => {
    localStorage.setItem('cloudbreakers-guest', '1')
    localStorage.setItem(key, JSON.stringify({ ...state, seenIntro: false }))
  }, { key: saveKey, state: fresh })
  await page.goto('/')
  await page.getByRole('button', { name: "Let's begin", exact: true }).click()
  await page.getByRole('dialog', { name: 'Tutorial - Welcome' }).getByRole('button', { name: /Let's Begin/ }).click()
  await page.locator('[data-tutorial="island-newHaven"]').click()
  await page.locator('[data-tutorial="gather-wood-btn"]').click()
  await expect(page.getByRole('dialog', { name: 'Tutorial Step 2' })).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-tutorial="rail-build"]').click()
  await expect(page.getByRole('dialog', { name: 'Tutorial Step 3' })).toBeVisible()
  await page.locator('[data-tutorial="build-btn-shelter"]').click()
  await expect(page.getByRole('dialog', { name: 'Tutorial Step 4' })).toBeVisible()
  await page.locator('[data-tutorial="plot-newHaven"]').click()
  const workingCaptain = page.getByRole('button', { name: 'Center me' })
  await expect(workingCaptain).toHaveAttribute('data-player-task', 'build', { timeout: 15_000 })
  await expect.poll(async () => Number(await workingCaptain.getAttribute('data-player-progress')), { timeout: 15_000 }).toBeGreaterThan(0)
  await expectSave(page, (town) => town.completed.includes('firstSteps'))
  await expect(page.getByRole('dialog', { name: 'Tutorial Step 5' })).toBeVisible()
  await page.locator('[data-tutorial="rail-quests"]').click()
  await expect(page.getByRole('dialog', { name: "Captain's Log" })).toBeVisible()
})

test('Cloud can offer a route and open its bridge plan', async ({ page }) => {
  await startAt(page, 'anchor-ready')
  await page.locator('[data-tutorial="rail-advisor"]').click()
  const notes = page.getByRole('dialog', { name: "Cloud's Notes" })
  await expect(notes).toBeVisible()
  const first = await notes.locator('.suggestion strong').textContent()
  await notes.getByRole('button', { name: /Ask again/ }).click()
  await expect(notes.locator('.suggestion strong')).not.toHaveText(first)
  for (let i = 0; i < 10 && !(await notes.getByRole('button', { name: /Show route/ }).isEnabled()); i++) {
    await notes.getByRole('button', { name: /Ask again/ }).click()
  }
  await notes.getByRole('button', { name: /Show route/ }).click()
  await expect(page.getByRole('dialog', { name: /^Bridge to / })).toBeVisible()
})

test('new town can gather wood through the island panel', async ({ page }) => {
  const start = await startAt(page, 'new-town')
  await page.locator('[data-tutorial="island-newHaven"]').click()
  await expect(page.getByRole('dialog', { name: 'New Haven' })).toBeVisible()
  await page.locator('[data-tutorial="gather-wood-btn"]').click()
  await expectSave(page, (town) => town.xp > start.xp && town.backpack.wood > start.backpack.wood)
})

test('new town can build a shelter and finish First Steps', async ({ page }) => {
  await startAt(page, 'new-town')
  await page.locator('[data-tutorial="rail-build"]').click()
  await page.locator('[data-tutorial="build-btn-shelter"]').click()
  await page.locator('[data-tutorial="plot-newHaven"]').click()
  await expectSave(page, (town) => town.completed.includes('firstSteps') && town.buildings.some((b) => b.type === 'shelter'))
  const captain = page.getByRole('button', { name: 'Center me' })
  await expect(captain).toHaveAttribute('data-player-busy', 'false')
  const start = [Number(await captain.getAttribute('data-player-x')), Number(await captain.getAttribute('data-player-y'))]
  const town = await savedTown(page), shelter = town.buildings.find(b => b.type === 'shelter')
  const plot = ISLANDS[shelter.island].plots[shelter.slot], dx = start[0]-plot[0], dy = start[1]-plot[1]
  const key = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'ArrowRight' : 'ArrowLeft' : dy > 0 ? 'ArrowDown' : 'ArrowUp'
  await page.keyboard.down(key)
  try {
    await expect.poll(async () => Math.hypot(Number(await captain.getAttribute('data-player-x'))-start[0], Number(await captain.getAttribute('data-player-y'))-start[1])).toBeGreaterThan(4)
  } finally { await page.keyboard.up(key) }
  await expectSave(page, s => Math.hypot(s.player.x-start[0], s.player.y-start[1]) > 4)
  expect((await savedTown(page)).resources).toEqual(town.resources)
  await page.locator('[data-tutorial="rail-quests"]').click()
  await expect(page.getByRole('dialog', { name: "Captain's Log" }).getByText('First Steps')).toBeVisible()
})

test('after First Steps the player can unlock bridges without placing an anchor', async ({ page }) => {
  await startAt(page, 'shelter-built')
  await page.locator('[data-tutorial="rail-build"]').click()
  await page.locator('[data-tutorial="build-btn-bridgeAnchor"]').click()
  await expect(page.getByRole('dialog', { name: 'Bridge routes' })).toBeVisible()
  await expect(page.locator('.skymap .slot')).toHaveCount(0)
  await expectSave(page, (town) => town.completed.includes('anchor') && town.buildings.some((b) => b.type === 'bridgeAnchor' && b.slot === -3))
})

test('after the anchor the player can connect Verdant Reach', async ({ page }) => {
  await startAt(page, 'anchor-ready')
  await page.locator('.skymap .isle-hit').nth(1).locator('.isle-label').click()
  await page.getByRole('button', { name: 'Plan a bridge' }).click()
  const bridge = page.getByRole('dialog', { name: 'Bridge to Verdant Reach' })
  await expect(bridge).toBeVisible()
  await bridge.locator('.bridge-option').filter({ hasText: 'Rope & Plank' }).getByRole('button', { name: 'Build bridge' }).click()
  await expectSave(page, (town) => town.connected.includes('verdant') && town.completed.includes('firstBridge'))
})
