import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { createInitialState, gameReducer, migrateSave } from './engine.js'
import { Player, isPlayerTask } from './player.js'

const SAVE_KEY = 'cloudbreakers-save-v1'

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if ([2, 3, 4, 5, 6].includes(s?.version)) return migrateSave(s)
    }
  } catch { /* storage unavailable — start fresh */ }
  return createInitialState()
}

const GameCtx = createContext(null)
const UICtx = createContext(null)

export function GameProvider({ children }) {
  const [state, rawDispatch] = useReducer(gameReducer, undefined, loadSave)
  const stateRef = useRef(state)
  stateRef.current = state
  const player = useRef(null)
  const resetPlayer = useRef(false)
  if (!player.current) player.current = new Player(state)
  player.current.state = state
  player.current.dispatchTask = rawDispatch
  player.current.onSave = position => {
    const saved = stateRef.current.player
    if (!saved || saved.island !== position.island || saved.x !== position.x || saved.y !== position.y) {
      rawDispatch({ type: 'PLAYER_POSITION', position })
    }
  }
  const dispatch = useCallback(action => {
    if (action.type === 'LOAD' || action.type === 'NEW_GAME') {
      player.current.cancel()
      resetPlayer.current = true
    }
    if (isPlayerTask(action)) {
      // The Captain says why a task can't start (backpack full, no bridge…): the HUD no longer
      // shows the Captain's status line, so this is the only place the player would see it.
      if (!player.current.request(action, rawDispatch) && player.current.status) rawDispatch({ type: 'NOTICE', text: player.current.status })
    } else rawDispatch(action)
  }, [])
  useEffect(() => {
    if (resetPlayer.current) { Object.assign(player.current, new Player(state)); resetPlayer.current = false }
    else player.current.sync(state)
  }, [state.bridges, state.connected, state.buildings, state.avatar])

  // Local backup on every change; CloudSync also saves logged-in towns to the server.
  useEffect(() => {
    try {
      const { toasts, ...rest } = state
      localStorage.setItem(SAVE_KEY, JSON.stringify(rest))
    } catch { /* ignore */ }
  }, [state])

  return <GameCtx.Provider value={{ state, dispatch, player }}>{children}</GameCtx.Provider>
}

// UI-only state (which panel is open, what is being placed, tutorial, etc.)
export function UIProvider({ children }) {
  const { state, dispatch, player } = useContext(GameCtx)
  const [panel, setPanel] = useState(null) // quests | build | backpack | advisor | island | journal | storage | store | map | settings
  const [selected, setSelected] = useState(null) // island id
  const [placing, setPlacing] = useState(null) // building type
  const [placeFocus, setPlaceFocus] = useState(null) // island the player asked to build on
  const [bridgeRoute, setBridgeRoute] = useState(null) // route id for the bridge modal
  const [seenQuests, setSeenQuests] = useState([]) // mission ids the player has looked at
  // Short-lived world effects (floating numbers, sparkle bursts, collect bubbles), in map coordinates
  const [fx, setFx] = useState([])
  const fxId = useRef(0)
  const emitFx = useCallback((items) => {
    const list = (Array.isArray(items) ? items : [items]).map((f) => ({ ...f, id: ++fxId.current }))
    setFx((cur) => [...cur, ...list].slice(-40))
    for (const f of list) {
      if (f.ttl !== 0) setTimeout(() => setFx((cur) => cur.filter((x) => x.id !== f.id)), f.ttl || 1600)
    }
  }, [])
  const clearFx = useCallback((id) => setFx((cur) => cur.filter((x) => x.id !== id)), [])
  // The camera registers itself here so panels can ask it to fly somewhere
  const camera = useRef(null)
  useEffect(() => {
    player.current.onTaskStart = () => {
      setPanel(null); setBridgeRoute(null); setPlacing(null)
      const a = player.current.avatar, cam = camera.current
      if (cam) cam.flyTo(a.x, a.y, Math.max(1.05, cam.view().s), { duration: 350 })
    }
    player.current.onOpenBuild = () => { setPlaceFocus(player.current.avatar.isl); setPanel('build') }
    player.current.onOpenBridge = route => setBridgeRoute(route)
  }, [player])

  // Tutorial state
  const [tutorialActive, setTutorialActive] = useState(!state.seenIntro)
  const [tutorialStep, setTutorialStep] = useState(1)

  useEffect(() => {
    if (!state.seenIntro) {
      setTutorialActive(true)
      setTutorialStep(1)
    }
  }, [state.seenIntro])

  const startTutorial = () => {
    setTutorialActive(true)
    setTutorialStep(1)
  }

  const endTutorial = (markSeen = true) => {
    setTutorialActive(false)
    if (markSeen && !state.seenIntro) {
      dispatch({ type: 'SEEN_INTRO' })
    }
  }

  const openIsland = (id) => { setSelected(id); setPanel('island') }
  const closeAll = () => { setPanel(null); setSelected(null); setPlacing(null); setPlaceFocus(null); setBridgeRoute(null) }
  const toggle = (name) => setPanel((p) => (p === name ? null : name))

  return (
    <UICtx.Provider value={{
      panel, setPanel, toggle, selected, setSelected, openIsland,
      placing, setPlacing, placeFocus, setPlaceFocus, bridgeRoute, setBridgeRoute,
      seenQuests, setSeenQuests, closeAll, fx, emitFx, clearFx, camera,
      tutorialActive, setTutorialActive, tutorialStep, setTutorialStep, startTutorial, endTutorial,
    }}>
      {children}
    </UICtx.Provider>
  )
}

export const useGame = () => useContext(GameCtx)
export const useUI = () => useContext(UICtx)
