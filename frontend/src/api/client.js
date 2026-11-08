// Talks to the FastAPI backend. Set VITE_API_URL (docker-compose does this locally;
// on Vercel it's an environment variable on the frontend project, read at build time).
// Without it the game still runs fully offline, saving to localStorage only.

import { possibleMoves } from '../game/possibleMoves.js'
import { localOracle } from '../game/localOracle.js'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const TOKEN_KEY = 'cloudbreakers-token'

export const hasBackend = () => Boolean(API_URL)

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, keepalive = false, timeoutMs = 0 } = {}) {
  if (!API_URL) throw new ApiError(0, 'VITE_API_URL is not set')
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Can’t reach the server')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // FastAPI errors: {detail: "msg"} or {detail: [{msg, loc}, ...]} for validation
    const d = data?.detail
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? d.map((e) => e.msg).join('; ') : res.statusText
    throw new ApiError(res.status, msg || `Request failed (${res.status})`)
  }
  return data
}

// -> { access_token, player }
export const login = (username, password) => request('/auth/login', { method: 'POST', body: { username, password } })
export const register = (username, password) => request('/auth/register', { method: 'POST', body: { username, password } })
export const getMe = () => request('/me')

// -> { town: <game state> | null, saved_at }
export const loadTown = () => request('/town')
// keepalive lets the request finish while the tab is closing
export const saveTown = (state, { keepalive = false } = {}) => request('/town', { method: 'PUT', body: state, keepalive })

// Consult the Gods (store item). Sends the live town; the journal is left out to save tokens.
// -> { poem }
// The gods may only advise moves the player can actually make right now (see possibleMoves.js).
export const consultGods = async (state) => {
  if (!hasBackend() || !getToken()) return localOracle(state)
  const { journal, toasts, lastInteraction, ...town } = state
  try {
    const result = await request('/advisor', { method: 'POST', body: { ...town, possibleMoves: possibleMoves(state) }, timeoutMs: 20_000 })
    if (typeof result?.poem !== 'string' || !result.poem.trim()) return localOracle(state)
    return result
  } catch (error) {
    if ([0, 401, 429, 500, 502, 503, 504].includes(error.status)) return localOracle(state)
    throw error
  }
}
