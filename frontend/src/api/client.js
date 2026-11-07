// Placeholder for the backend. Nothing here is called yet — the game runs
// fully in the browser and saves to localStorage (see game/GameContext.jsx).
//
// When the backend exists, set VITE_API_URL (e.g. in docker-compose) and
// implement these against it. Keep secrets (MongoDB, AI keys) on the backend only.

const API_URL = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  if (!API_URL) throw new Error('VITE_API_URL is not set')
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

// Suggested endpoints (rename freely):
export const login = (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
export const register = (username, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) })
export const loadTown = () => request('/town')
export const saveTown = (state) => request('/town', { method: 'PUT', body: JSON.stringify(state) })
// The advisor should return: { situation, recommendation, reason, tradeoff, confidence, alternative }
export const getAdvice = (summary) => request('/advisor', { method: 'POST', body: JSON.stringify(summary) })

export const hasBackend = () => Boolean(API_URL)
