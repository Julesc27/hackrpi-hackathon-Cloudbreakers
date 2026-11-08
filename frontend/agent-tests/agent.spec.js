import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { defaultModel, requestTimeoutMs, runAgent } from './agent.mjs'
import { scenarios } from './scenarios.mjs'

const saveKey = 'cloudbreakers-save-v1'

for (const scenario of scenarios) {
  test(`[${scenario.id}] a browser agent can: ${scenario.objective}`, async ({ page }, testInfo) => {
    // Every step may wait the full Gemini timeout; leave two minutes for page setup and grading.
    test.setTimeout(scenario.maxSteps * requestTimeoutMs + 120_000)
    const start = JSON.parse(readFileSync(new URL(`../e2e/checkpoints/${scenario.checkpoint}.json`, import.meta.url), 'utf8'))
    const report = { scenario: scenario.id, objective: scenario.objective, checkpoint: scenario.checkpoint, model: process.env.GEMINI_MODEL || defaultModel, transcript: [], passed: false }
    try {
      await page.addInitScript(({ key, state }) => {
        localStorage.setItem('cloudbreakers-guest', '1')
        localStorage.setItem(key, JSON.stringify(state))
      }, { key: saveKey, state: start })
      await page.goto('/')
      await expect(page.locator('[data-tutorial="hud-level"]')).toBeVisible()

      const run = await runAgent(page, scenario.objective, process.env.GEMINI_API_KEY, (entry) => {
        report.transcript.push(entry)
        console.log(`Agent step ${entry.step}: ${entry.message} [${entry.action}${entry.action === 'click' ? ` ${entry.x},${entry.y}` : ''}]`)
      }, { maxSteps: scenario.maxSteps })
      report.reason = run.reason
      report.tokens = run.tokens
      const end = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey)
      report.passed = scenario.grade(start, end)
      report.outcome = scenario.outcome(start, end)
      console.log(`Agent result: ${report.passed ? 'PASS' : 'FAIL'} (${run.reason}; ${run.tokens} tokens)`)
      expect(report.passed, scenario.expectation).toBe(true)
    } catch (error) {
      report.error = error.message
      throw error
    } finally {
      writeFileSync(testInfo.outputPath('transcript.json'), `${JSON.stringify(report, null, 2)}\n`)
    }
  })
}
