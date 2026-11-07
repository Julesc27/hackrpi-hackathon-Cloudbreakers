import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../api/client.js'

const GUEST_KEY = 'cloudbreakers-guest' // player chose "play as guest" on this device

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const backend = api.hasBackend()
  // loading: checking a stored token | guest: not logged in | authed: logged in
  const [status, setStatus] = useState(() => (backend && api.getToken() ? 'loading' : 'guest'))
  const [player, setPlayer] = useState(null)
  const [notice, setNotice] = useState(null) // e.g. "session expired"
  const [guestChosen, setGuestChosen] = useState(() => {
    try { return localStorage.getItem(GUEST_KEY) === '1' } catch { return false }
  })
  const [showLogin, setShowLogin] = useState(false)

  // Validate a token left over from a previous visit.
  useEffect(() => {
    if (status !== 'loading') return
    api.getMe()
      .then((p) => { setPlayer(p); setStatus('authed') })
      .catch((e) => {
        if (e.status === 401) api.setToken(null)
        // Server unreachable: stay logged out for now, keep the token to retry next visit.
        setStatus('guest')
      })
  }, [status])

  const finish = (res) => {
    api.setToken(res.access_token)
    setPlayer(res.player)
    setStatus('authed')
    setNotice(null)
    setShowLogin(false)
  }
  const login = async (u, p) => finish(await api.login(u, p))
  const register = async (u, p) => finish(await api.register(u, p))

  const logout = useCallback((message = null) => {
    api.setToken(null)
    setPlayer(null)
    setStatus('guest')
    setNotice(message)
  }, [])

  const playAsGuest = () => {
    try { localStorage.setItem(GUEST_KEY, '1') } catch { /* ignore */ }
    setGuestChosen(true)
    setShowLogin(false)
  }

  // Login screen: first visit (until they log in or pick guest), or when asked for.
  const loginOpen = backend && status === 'guest' && (!guestChosen || showLogin)

  return (
    <AuthCtx.Provider
      value={{
        backend, status, player, setPlayer, notice, login, register, logout, playAsGuest,
        loginOpen, openLogin: () => setShowLogin(true), closeLogin: () => setShowLogin(false), guestChosen,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
