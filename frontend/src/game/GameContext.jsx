import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { createInitialState, gameReducer } from './engine.js'

const SAVE_KEY = 'cloudbreakers-save-v1'

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw)
      if (s?.version === 2) return { ...s, toasts: [] }
    }
  } catch { /* storage unavailable — start fresh */ }
  return createInitialState()
}

const GameCtx = createContext(null)
const UICtx = createContext(null)

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadSave)

  // Local save for now. Swap for api/client.js saveTown() once the backend exists.
  useEffect(() => {
    try {
      const { toasts, ...rest } = state
      localStorage.setItem(SAVE_KEY, JSON.stringify(rest))
    } catch { /* ignore */ }
  }, [state])

  return <GameCtx.Provider value={{ state, dispatch }}>{children}</GameCtx.Provider>
}

// UI-only state (which panel is open, what is being placed, tutorial, etc.)
export function UIProvider({ children }) {
  const { state, dispatch } = useContext(GameCtx)
  const [panel, setPanel] = useState(null) // quests | build | advisor | island | journal | storage | map | settings
  const [selected, setSelected] = useState(null) // island id
  const [placing, setPlacing] = useState(null) // building type
  const [bridgeRoute, setBridgeRoute] = useState(null) // route id for the bridge modal
  const [seenQuests, setSeenQuests] = useState([]) // mission ids the player has looked at

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
  const closeAll = () => { setPanel(null); setSelected(null); setPlacing(null); setBridgeRoute(null) }
  const toggle = (name) => setPanel((p) => (p === name ? null : name))

  return (
    <UICtx.Provider
      value={{
        panel,
        setPanel,
        toggle,
        selected,
        setSelected,
        openIsland,
        placing,
        setPlacing,
        bridgeRoute,
        setBridgeRoute,
        seenQuests,
        setSeenQuests,
        closeAll,
        tutorialActive,
        setTutorialActive,
        tutorialStep,
        setTutorialStep,
        startTutorial,
        endTutorial,
      }}
    >
      {children}
    </UICtx.Provider>
  )
}

export const useGame = () => useContext(GameCtx)
export const useUI = () => useContext(UICtx)
