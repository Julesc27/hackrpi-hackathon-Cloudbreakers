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
  await expect.poll(async () => predicate(await savedTown(page))).toBeTruthy()
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
  await expect(page.getByRole('dialog', { name: 'Tutorial Step 2' })).toBeVisible()
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
