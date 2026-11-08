import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const saveKey = 'cloudbreakers-save-v1'
const checkpoint = (name) => JSON.parse(readFileSync(new URL(`./checkpoints/${name}.json`, import.meta.url), 'utf8'))

async function startAt(page, name) {
  const save = checkpoint(name)
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
  await expectSave(page, s => s.resources.wood === town.resources.wood + 6)
  await expect(captain).toHaveAttribute('data-player-busy', 'false')
  await page.keyboard.press('e')
  await expectSave(page, s => s.resources.wood === town.resources.wood + 12)
})

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
  await expectSave(page, (town) => town.xp > start.xp && town.resources.wood > start.resources.wood)
})

test('new town can build a shelter and finish First Steps', async ({ page }) => {
  await startAt(page, 'new-town')
  await page.locator('[data-tutorial="rail-build"]').click()
  await page.locator('[data-tutorial="build-btn-shelter"]').click()
  await page.locator('[data-tutorial="plot-newHaven"]').click()
  await expectSave(page, (town) => town.completed.includes('firstSteps') && town.buildings.some((b) => b.type === 'shelter'))
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
