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

for (const id of ['newHaven-central-front', 'verdant-bridge', 'prism-west-terrace']) {
  test(`the captain can descend and climb ${id} with arrow keys`, async ({ page }, testInfo) => {
    const stair = STAIRWAYS.find(stair => stair.id === id)
    await startAt(page, 'all-bridges', { player: { island: stair.island, x: stair.from[0], y: stair.from[1] } })
    const controls = page.getByRole('region', { name: 'Captain controls' })
    await expect(controls).toHaveAttribute('data-player-island', stair.island)
    await page.getByRole('button', { name: 'Find my avatar' }).click()
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
  const captain = page.getByRole('region', { name: 'Captain controls' })
  await expect(captain).toHaveAttribute('data-player-busy', 'true')
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await captain.getByRole('button', { name: 'Cancel task' }).click()
  await expect(captain).toHaveAttribute('data-player-busy', 'false')
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await page.locator('[data-tutorial="gather-wood-site"]').click()
  await expect(captain).toHaveAttribute('data-player-task', 'chop')
  await expect(captain.getByRole('progressbar')).toBeVisible()
  expect((await savedTown(page)).resources.wood).toBe(town.resources.wood)
  await captain.getByRole('button', { name: 'Cancel task' }).click()
  await expect(captain.getByRole('progressbar')).toHaveCount(0)
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
  await expect(page.getByRole('region', { name: 'Captain controls' })).toHaveAttribute('data-player-busy', 'true')
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
  const captain = page.getByRole('region', { name: 'Captain controls' })
  await expect(captain.getByRole('status')).toContainText('Backpack full')
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

for (const [siteId, kind] of [['stone', 'mine'], ['garden', 'garden'], ['collector', 'collect'], ['crystals', 'crystal'], ['fishing', 'fish']]) {
  test(`the captain shows ${kind} work and progress at ${siteId}`, async ({ page }, testInfo) => {
    const site = GATHER_SITES[siteId], point = INTERACTION_POINTS[siteId]
    await startAt(page, 'all-bridges', { player: { island: site.island, x: point[0], y: point[1] } })
    const captain = page.getByRole('region', { name: 'Captain controls' })
    await page.getByRole('button', { name: 'Find my avatar' }).click()
    const target = page.locator('.interaction-sites').getByRole('button', { name: new RegExp(`^${site.label}`) })
    await target.focus(); await page.keyboard.press('Enter')
    await expect(captain).toHaveAttribute('data-player-task', kind)
    const progress = captain.getByRole('progressbar', { name: site.label })
    await expect(progress).toBeVisible()
    await expect.poll(async () => Number(await progress.getAttribute('value')), { intervals: [50] }).toBeGreaterThan(.1)
    await page.screenshot({ path: testInfo.outputPath(`captain-${kind}.png`) })
    await expect(captain).toHaveAttribute('data-player-busy', 'false')
    await expect(progress).toHaveCount(0)
    expect((await savedTown(page)).lastInteraction.siteId).toBe(siteId)
  })
}

test('WASD moves the captain, saves their position, and does not advance the town', async ({ page }) => {
  const town = await startAt(page, 'new-town')
  const captain = page.getByRole('region', { name: 'Captain controls' })
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
  const restoredCaptain = restored.getByRole('region', { name: 'Captain controls' })
  await expect(restoredCaptain).toHaveAttribute('data-player-island', 'newHaven')
  await expect.poll(async () => Number(await restoredCaptain.getAttribute('data-player-x'))).toBeCloseTo(saved.player.x, 0)
})

test('the captain walks across built bridges to a selected island', async ({ page }, testInfo) => {
  const town = await startAt(page, 'all-bridges')
  const captain = page.getByRole('region', { name: 'Captain controls' })
  await page.getByRole('button', { name: 'Walk on Verdant Reach', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(captain).toHaveAttribute('data-player-island', 'newHaven')
  await expect(captain).toHaveAttribute('data-player-island', 'verdant', { timeout: 25_000 })
  await expect(captain).toHaveAttribute('data-player-busy', 'false', { timeout: 20_000 })
  const saved = await savedTown(page)
  expect(saved.resources).toEqual(town.resources)
  expect(saved.xp).toBe(town.xp)
  await page.getByRole('button', { name: 'Find my avatar' }).click()
  await page.evaluate(() => new Promise(resolve => { let frames = 30; const next = () => --frames ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next) }))
  await page.screenshot({ path: testInfo.outputPath('captain-on-verdant.png') })
})

test('touch controls fit on a phone and tapping a path moves the captain', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    const town = await startAt(page, 'new-town')
    const controls = page.getByRole('region', { name: 'Captain controls' })
    await expect(controls.getByRole('button', { name: 'Walk right', exact: true })).toBeVisible()
    await page.waitForFunction(async () => {
      const { PAINTED_ATLASES, getPaintedAtlas } = await import('/src/components/world/paintedArt.js')
      return Object.keys(PAINTED_ATLASES).every(key => getPaintedAtlas(key).ready)
    })
    await page.evaluate(() => new Promise(resolve => { let frames = 20; const next = () => --frames ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next) }))
    await page.screenshot({ path: testInfo.outputPath('captain-mobile-before.png') })
    await page.getByRole('button', { name: 'Walk on New Haven', exact: true }).tap({ timeout: 5_000 })
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
  const workingCaptain = page.getByRole('region', { name: 'Captain controls' })
  await expect(workingCaptain).toHaveAttribute('data-player-task', 'build', { timeout: 15_000 })
  await expect(workingCaptain.getByRole('progressbar')).toBeVisible()
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
  const captain = page.getByRole('region', { name: 'Captain controls' })
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
