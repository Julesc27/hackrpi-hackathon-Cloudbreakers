// Talks to the FastAPI backend. Set VITE_API_URL (docker-compose does this locally;
// on Railway it's a variable on the frontend service, read at build time).
// Without it the game still runs fully offline, saving to localStorage only.

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

async function request(path, { method = 'GET', body, keepalive = false } = {}) {
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

// Not implemented on the backend yet.
// The advisor should return: { situation, recommendation, reason, tradeoff, confidence, alternative }
export const getAdvice = (summary) => request('/advisor', { method: 'POST', body: summary })
