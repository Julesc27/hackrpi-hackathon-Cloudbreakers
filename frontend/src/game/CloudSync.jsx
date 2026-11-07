// "Call home": keeps the logged-in player's town backed up on the server.
//
// localStorage is still written on every change (GameContext). On top of that, while
// logged in we upload the save to PUT /town:
//   - every SYNC_MS if anything changed,
//   - right after each successful gameplay action,
//   - when the tab is hidden/closed (keepalive request).
// On login we reconcile the device's save with the account's save (see reconcile()).

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useGame } from './GameContext.jsx'
import { getLevelInfo, migrateSave } from './engine.js'

const SYNC_MS = 30_000
const OWNER_KEY = 'cloudbreakers-save-owner' // username the local save belongs to (absent = guest save)
const DIRTY_KEY = 'cloudbreakers-save-dirty' // local changes not yet on the server

const ls = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } },
}
const toSave = ({ toasts, ...rest }) => rest // toasts are UI-only
const isFresh = (s) => s.xp === 0 && s.completed.length === 0

const SyncCtx = createContext(null)

export function SyncProvider({ children }) {
  const { state, dispatch } = useGame()
  const auth = useAuth()
  const authRef = useRef(auth) // context value changes every render; read it via a ref
  authRef.current = auth
  const username = auth.status === 'authed' ? auth.player?.username : null

  const [sync, setSync] = useState({ status: 'off', savedAt: null, error: null })

  const stateRef = useRef(state)
  stateRef.current = state
  const prevState = useRef(state)
  const dirty = useRef(ls.get(DIRTY_KEY) === '1')
  const ready = useRef(false) // login reconcile finished; safe to upload
  const reconciling = useRef(null) // username currently being reconciled
  const inFlight = useRef(false)
  const pushAfterRender = useRef(false)

  const setDirty = (v) => { dirty.current = v; ls.set(DIRTY_KEY, v ? '1' : null) }

  const handleError = useCallback((e) => {
    if (e.status === 401) {
      ready.current = false
      authRef.current.logout('Your session expired. Log in again to keep saving to the cloud.')
    } else {
      setSync((s) => ({ ...s, status: 'error', error: e.message }))
    }
  }, [])

  const push = useCallback(async ({ keepalive = false, force = false } = {}) => {
    if (!username || !ready.current || inFlight.current) return
    if (!dirty.current && !force) return
    inFlight.current = true
    // Clear only the in-memory flag; the persisted one is cleared after the server confirms,
    // so a save cut off by a page unload isn't forgotten.
    dirty.current = false
    setSync((s) => ({ ...s, status: 'saving' }))
    try {
      const res = await api.saveTown(toSave(stateRef.current), { keepalive })
      ls.set(DIRTY_KEY, dirty.current ? '1' : null)
      setSync({ status: 'saved', savedAt: res.saved_at, error: null })
      authRef.current.setPlayer(res.player)
    } catch (e) {
      setDirty(true)
      handleError(e)
    } finally {
      inFlight.current = false
    }
  }, [username, handleError])

  // Decide whose save wins when a player logs in on this device.
  const reconcile = useCallback(async () => {
    if (!username || reconciling.current === username) return
    reconciling.current = username
    setSync({ status: 'loading', savedAt: null, error: null })
    try {
      const res = await api.loadTown()
      const town = [2, 3, 4, 5].includes(res.town?.version) ? migrateSave(res.town) : null
      const saved_at = res.saved_at
      const local = stateRef.current
      const owner = ls.get(OWNER_KEY)
      let action // 'load' server save | 'upload' this device's save | 'new' fresh game then upload

      if (owner && owner !== username) {
        // Device holds another account's town: never hand it to this account.
        action = town ? 'load' : 'new'
      } else if (owner === username) {
        action = town && !dirty.current ? 'load' : 'upload'
      } else if (!town) {
        action = 'upload' // first login: guest progress moves into the new account
      } else if (isFresh(local)) {
        action = 'load'
      } else {
        action = window.confirm(
          `Your account already has a saved town: "${town.townName}" (level ${getLevelInfo(town.xp).level}).\n\n` +
          `OK: load your account's town.\n` +
          `Cancel: replace it with this device's guest town "${local.townName}" (level ${getLevelInfo(local.xp).level}).`,
        ) ? 'load' : 'upload'
      }

      ls.set(OWNER_KEY, username)
      if (action === 'load') {
        prevState.current = null // let the effect below see the LOAD without marking dirty
        dispatch({ type: 'LOAD', state: { ...town, toasts: [] } })
        setDirty(false)
        ready.current = true
        setSync({ status: 'saved', savedAt: saved_at, error: null })
      } else {
        setDirty(true)
        ready.current = true
        setSync({ status: 'idle', savedAt: saved_at, error: null })
        if (action === 'new') {
          pushAfterRender.current = true // upload once the fresh game has rendered
          dispatch({ type: 'NEW_GAME' })
        } else {
          await push({ force: true })
        }
      }
    } catch (e) {
      reconciling.current = null // retry on the next tick
      handleError(e)
    }
  }, [username, dispatch, handleError, push])

  // Login / logout transitions
  useEffect(() => {
    if (username) {
      reconcile()
    } else {
      ready.current = false
      reconciling.current = null
      setSync({ status: 'off', savedAt: null, error: null })
    }
  }, [username, reconcile])

  // Track local changes; upload right away after a successful gameplay action.
  useEffect(() => {
    const prev = prevState.current
    prevState.current = state
    if (prev === state) return
    if (prev === null) { // came from a server LOAD
      return
    }
    setDirty(true)
    if (pushAfterRender.current || prev.xp !== state.xp) {
      pushAfterRender.current = false
      push()
    }
  }, [state, push])

  // Periodic save (and retry of a failed login reconcile)
  useEffect(() => {
    if (!username) return
    const id = setInterval(() => {
      if (ready.current) push()
      else reconcile()
    }, SYNC_MS)
    return () => clearInterval(id)
  }, [username, push, reconcile])

  // Last-chance save when the tab is hidden or closed
  useEffect(() => {
    if (!username) return
    const onHide = () => { if (document.visibilityState === 'hidden') push({ keepalive: true }) }
    const onPageHide = () => push({ keepalive: true })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [username, push])

  // Explicit "Log out": save, then wipe this device's copy so the next person starts fresh.
  const logout = useCallback(async () => {
    await push()
    ready.current = false
    ls.set(OWNER_KEY, null)
    setDirty(false)
    prevState.current = null
    dispatch({ type: 'NEW_GAME' })
    authRef.current.logout()
  }, [push, dispatch])

  return (
    <SyncCtx.Provider value={{ ...sync, saveNow: () => push({ force: true }), logout }}>
      {children}
    </SyncCtx.Provider>
  )
}

export const useSync = () => useContext(SyncCtx)
