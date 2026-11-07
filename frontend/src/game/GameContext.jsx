import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react'
import { createInitialState, gameReducer, migrateSave } from './engine.js'

const SAVE_KEY = 'cloudbreakers-save-v1'

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if ([2, 3].includes(s?.version)) return migrateSave(s)
    }
  } catch { /* storage unavailable — start fresh */ }
  return createInitialState()
}

const GameCtx = createContext(null)
const UICtx = createContext(null)

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadSave)

  // Local backup on every change; CloudSync also saves logged-in towns to the server.
  useEffect(() => {
    try {
      const { toasts, ...rest } = state
      localStorage.setItem(SAVE_KEY, JSON.stringify(rest))
    } catch { /* ignore */ }
  }, [state])

  return <GameCtx.Provider value={{ state, dispatch }}>{children}</GameCtx.Provider>
}

// UI-only state (which panel is open, what is being placed, etc.)
export function UIProvider({ children }) {
  const [panel, setPanel] = useState(null) // quests | build | advisor | island | journal | storage | map | settings
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

  const openIsland = (id) => { setSelected(id); setPanel('island') }
  const closeAll = () => { setPanel(null); setSelected(null); setPlacing(null); setPlaceFocus(null); setBridgeRoute(null) }
  const toggle = (name) => setPanel((p) => (p === name ? null : name))

  return (
    <UICtx.Provider value={{ panel, setPanel, toggle, selected, setSelected, openIsland, placing, setPlacing, placeFocus, setPlaceFocus, bridgeRoute, setBridgeRoute, seenQuests, setSeenQuests, closeAll, fx, emitFx, clearFx, camera }}>
      {children}
    </UICtx.Provider>
  )
}

export const useGame = () => useContext(GameCtx)
export const useUI = () => useContext(UICtx)
