import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { gradeGatherWood, runAgent } from './agent.mjs'

const saveKey = 'cloudbreakers-save-v1'
const objective = 'Gather wood at New Haven.'

test('a browser agent can gather wood from a new town', async ({ page }, testInfo) => {
  const start = JSON.parse(readFileSync(new URL('../e2e/checkpoints/new-town.json', import.meta.url), 'utf8'))
  const report = { objective, checkpoint: 'new-town', model: process.env.GEMINI_MODEL || 'gemini-3.8-flash', transcript: [], passed: false }
  try {
    await page.addInitScript(({ key, state }) => {
      localStorage.setItem('cloudbreakers-guest', '1')
      localStorage.setItem(key, JSON.stringify(state))
    }, { key: saveKey, state: start })
    await page.goto('/')
    await expect(page.locator('[data-tutorial="hud-level"]')).toBeVisible()

    const run = await runAgent(page, objective, process.env.GEMINI_API_KEY, (entry) => {
      report.transcript.push(entry)
      console.log(`Agent step ${entry.step}: ${entry.message} [${entry.action}${entry.action === 'click' ? ` ${entry.x},${entry.y}` : ''}]`)
    })
    report.reason = run.reason
    report.tokens = run.tokens
    const end = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey)
    report.passed = gradeGatherWood(start, end)
    report.outcome = { startingWood: start.resources.wood, finalWood: end?.resources?.wood, startingXp: start.xp, finalXp: end?.xp }
    console.log(`Agent result: ${report.passed ? 'PASS' : 'FAIL'} (${run.reason}; ${run.tokens} tokens)`)
    expect(report.passed, 'wood, grove deposit, XP, and gathering action should change through play').toBe(true)
  } catch (error) {
    report.error = error.message
    throw error
  } finally {
    writeFileSync(testInfo.outputPath('transcript.json'), `${JSON.stringify(report, null, 2)}\n`)
  }
})
