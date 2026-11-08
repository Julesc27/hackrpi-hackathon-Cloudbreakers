import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('failed logout preserves the town and a successful retry saves it before clearing the device', async ({ page }) => {
  const town = { ...JSON.parse(readFileSync(new URL('./checkpoints/shelter-built.json', import.meta.url), 'utf8')), avatarSet: true }
  const player = { username: 'test-captain' }
  let failSave = true
  const uploads = []
  await page.route('**/api/me', route => route.fulfill({ json: player }))
  await page.route('**/api/town', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { town, saved_at: '2026-11-08T12:00:00Z' } })
    uploads.push(route.request().postDataJSON())
    if (failSave) return route.fulfill({ status: 503, json: { detail: 'Temporary save outage' } })
    return route.fulfill({ json: { saved_at: '2026-11-08T12:01:00Z', player } })
  })
  await page.addInitScript(({ town, player }) => {
    localStorage.setItem('cloudbreakers-guest', '1')
    localStorage.setItem('cloudbreakers-token', 'mock-session')
    localStorage.setItem('cloudbreakers-save-owner', player.username)
    localStorage.setItem('cloudbreakers-save-v1', JSON.stringify(town))
  }, { town, player })
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(settings).toContainText('Saved to the cloud')
  await settings.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(settings).toContainText('Temporary save outage')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cloudbreakers-save-v1')).xp)).toBe(town.xp)
  expect(await page.evaluate(() => localStorage.getItem('cloudbreakers-save-owner'))).toBe(player.username)
  expect(await page.evaluate(() => localStorage.getItem('cloudbreakers-save-dirty'))).toBe('1')
  expect(await page.evaluate(() => localStorage.getItem('cloudbreakers-token'))).toBe('mock-session')
  failSave = false
  await settings.getByRole('button', { name: 'Log out', exact: true }).click()
  await expect(settings).toHaveCount(0)
  expect(uploads.length).toBeGreaterThanOrEqual(2)
  expect(uploads.at(-1).xp).toBe(town.xp)
  expect(uploads.at(-1).buildings.some(b => b.type === 'shelter')).toBe(true)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cloudbreakers-token'))).toBeNull()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudbreakers-save-v1')).xp)).toBe(0)
})

test('logout includes a captain job that finishes while an older upload is pending', async ({ page }) => {
  test.setTimeout(45_000)
  const town = { ...JSON.parse(readFileSync(new URL('./checkpoints/shelter-built.json', import.meta.url), 'utf8')), avatarSet: true }
  const player = { username: 'test-captain' }
  const uploads = []
  let releaseUpload, firstUpload
  const blocked = new Promise(resolve => { releaseUpload = resolve })
  const started = new Promise(resolve => { firstUpload = resolve })
  await page.route('**/api/me', route => route.fulfill({ json: player }))
  await page.route('**/api/town', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { town, saved_at: '2026-11-08T12:00:00Z' } })
    const snapshot = route.request().postDataJSON()
    uploads.push(snapshot)
    if (uploads.length === 1) { firstUpload(snapshot); await blocked }
    return route.fulfill({ json: { saved_at: '2026-11-08T12:01:00Z', player } })
  })
  await page.addInitScript(({ town, player }) => {
    localStorage.setItem('cloudbreakers-guest', '1')
    localStorage.setItem('cloudbreakers-token', 'mock-session')
    localStorage.setItem('cloudbreakers-save-owner', player.username)
    localStorage.setItem('cloudbreakers-save-v1', JSON.stringify(town))
  }, { town, player })
  try {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toContainText('Saved to the cloud')
    await page.keyboard.press('Escape')
    const wood = page.locator('.interaction-sites').getByRole('button', { name: /^Gather wood/ })
    await wood.focus(); await page.keyboard.press('Enter')
    const captain = page.getByRole('button', { name: 'Center me', exact: true })
    await expect(captain).toHaveAttribute('data-player-task', 'chop', { timeout: 20_000 })
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('dialog', { name: 'Settings', exact: true }).getByRole('button', { name: 'Log out', exact: true }).click()
    const older = await started
    expect(older.xp).toBe(town.xp)
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cloudbreakers-save-v1')).xp), { timeout: 15_000 }).toBeGreaterThan(town.xp)
    releaseUpload()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('cloudbreakers-token')), { timeout: 15_000 }).toBeNull()
    expect(uploads.at(-1).xp).toBeGreaterThan(town.xp)
    expect(uploads.at(-1).lastInteraction.siteId).toBe('grove')
  } finally { releaseUpload() }
})
