import { readFileSync } from 'node:fs'

const instructions = readFileSync(new URL('./HOW_TO_PLAY.md', import.meta.url), 'utf8')
export const defaultModel = 'gemini-3.8-flash'
const model = process.env.GEMINI_MODEL || defaultModel
const maxTokens = 30_000
// Per-attempt wait. A slow attempt is retried, so this no longer has to cover Gemini's worst case alone.
export const requestTimeoutMs = 120_000
// Total time one agent step may spend getting an answer, across retries of overloads and slow responses.
export const stepBudgetMs = 300_000
// Overload (503), rate limit (429) and transient server errors are worth retrying; bad keys or requests are not.
export const retryableStatus = new Set([429, 500, 502, 503, 504])
export const retryDelaysMs = [5_000, 15_000, 30_000, 60_000]
// Gemini 3.8 Flash thinks at "medium" by default and rejects "minimal"; "low" is enough to pick one click.
export const thinkingLevel = process.env.GEMINI_THINKING_LEVEL || 'low'

export function parseAction(data, viewport) {
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason !== 'STOP') throw new Error(`Model did not finish normally: ${candidate?.finishReason || 'no candidate'}`)
  const text = candidate.content?.parts?.filter((part) => typeof part.text === 'string').map((part) => part.text).join('')
  const action = JSON.parse(text)
  if (!['click', 'scroll', 'done'].includes(action.action) || typeof action.message !== 'string') {
    throw new Error('Model returned an invalid action')
  }
  if (action.action === 'click') {
    // Gemini points are normalized to 0-1000 on each axis; convert to viewport pixels.
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y) || action.x < 0 || action.y < 0 || action.x > coordScale || action.y > coordScale) {
      throw new Error('Model click is outside the browser viewport')
    }
    return { ...action, x: toPixel(action.x, viewport.width), y: toPixel(action.y, viewport.height), modelX: action.x, modelY: action.y }
  }
  if (action.action === 'scroll' && (!Number.isInteger(action.deltaY) || Math.abs(action.deltaY) > 700)) {
    throw new Error('Model scroll is invalid')
  }
  return action
}

const coordScale = 1000
function toPixel(value, size) {
  return Math.min(size - 1, Math.round((value / coordScale) * size))
}

async function nextAction(page, objective, previous, key) {
  const screenshot = await page.screenshot({ type: 'jpeg', quality: 65 })
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `${instructions}\n\nOnly use the screenshot and your available browser actions. Never guess coordinates without looking at the current screenshot. Respond with one action and a short visible explanation. Give click coordinates as x and y normalized from 0 to 1000 across the screenshot's width and height (0,0 is top-left; 1000,1000 is bottom-right). If an action did not change the screen, try a different target instead of repeating it. Use done only when you believe the objective is met.` }] },
    contents: [{ role: 'user', parts: [
      { text: `Objective: ${objective}\nRecent actions: ${JSON.stringify(previous.slice(-3).map(({ step, action, message, modelX, modelY, deltaY }) => ({ step, action, message, x: modelX, y: modelY, deltaY })))}\nChoose the next action from the screenshot.` },
      { inlineData: { mimeType: 'image/jpeg', data: screenshot.toString('base64') } },
    ] }],
    generationConfig: {
      temperature: 0.2,
      thinkingConfig: { thinkingLevel },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', enum: ['click', 'scroll', 'done'] },
          x: { type: 'INTEGER' },
          y: { type: 'INTEGER' },
          deltaY: { type: 'INTEGER' },
          message: { type: 'STRING' },
        },
        required: ['action', 'x', 'y', 'deltaY', 'message'],
      },
    },
  })
  return requestGemini(body, key, `${screenshot.length} screenshot bytes`)
}

// POSTs one request, retrying overloads, rate limits and slow responses until the step budget runs out.
export async function requestGemini(body, key, label, { budgetMs = stepBudgetMs, timeoutMs = requestTimeoutMs, delaysMs = retryDelaysMs } = {}) {
  const deadline = Date.now() + budgetMs
  const minAttemptMs = Math.min(20_000, budgetMs / 4)
  let lastProblem = ''
  for (let attempt = 0; ; attempt++) {
    const attemptTimeoutMs = Math.max(1, Math.min(timeoutMs, deadline - Date.now()))
    const started = Date.now()
    console.log(`Gemini request started (${model}; thinking ${thinkingLevel}; ${label}${attempt ? `; attempt ${attempt + 1}` : ''})`)
    let response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: AbortSignal.timeout(attemptTimeoutMs),
      })
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error
      lastProblem = `no response within ${Math.round(attemptTimeoutMs / 1000)}s`
      console.log(`Gemini sent ${lastProblem}`)
    }
    if (response) {
      console.log(`Gemini responded HTTP ${response.status} in ${Date.now() - started}ms`)
      if (response.ok) return response.json()
      const detail = await errorDetail(response)
      if (!retryableStatus.has(response.status)) {
        throw new Error(`Gemini request failed (HTTP ${response.status}${detail ? `: ${detail}` : ''}); check key, model access, and free-tier quota`)
      }
      lastProblem = `HTTP ${response.status}${detail ? `: ${detail}` : ''}`
    }
    const delay = delaysMs[Math.min(attempt, delaysMs.length - 1)]
    if (deadline - Date.now() - delay < minAttemptMs) {
      throw new Error(`Gemini gave no usable answer within the ${Math.round(budgetMs / 1000)}s step budget (${attempt + 1} attempts; last: ${lastProblem}). The model is likely overloaded; rerun later or set GEMINI_MODEL to another free model.`)
    }
    console.log(`Gemini is temporarily unavailable (${lastProblem}); retrying in ${delay / 1000}s`)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

async function errorDetail(response) {
  try {
    const data = await response.json()
    return [data.error?.status, data.error?.message].filter(Boolean).join(' - ').slice(0, 300)
  } catch {
    return ''
  }
}

export async function runAgent(page, objective, key, onStep, { maxSteps = 8 } = {}) {
  if (!key) throw new Error('GEMINI_API_KEY is required')
  const transcript = []
  let tokens = 0
  let reason = 'step limit reached'
  for (let step = 1; step <= maxSteps; step++) {
    if (tokens >= maxTokens) { reason = 'token limit reached'; break }
    const data = await nextAction(page, objective, transcript, key)
    tokens += data.usageMetadata?.totalTokenCount || 0
    const action = parseAction(data, page.viewportSize())
    const entry = { step, action: action.action, message: action.message }
    if (action.action === 'click') {
      entry.x = action.x
      entry.y = action.y
      entry.modelX = action.modelX
      entry.modelY = action.modelY
      await page.mouse.click(action.x, action.y)
    } else if (action.action === 'scroll') {
      entry.deltaY = action.deltaY
      await page.mouse.wheel(0, action.deltaY)
    } else {
      reason = 'agent finished'
    }
    transcript.push(entry)
    onStep(entry)
    if (action.action === 'done') break
  }
  return { model, objective, reason, tokens, transcript }
}
