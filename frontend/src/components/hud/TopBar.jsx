import { useEffect, useRef, useState, useCallback } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { caps, projectProduction } from '../../game/engine.js'
import { RES_ICON } from '../icons.jsx'

function Delta({ v }) {
  if (!v) return <span className="delta zero">±0</span>
  return <span className={`delta ${v > 0 ? 'up' : 'down'}`}>{v > 0 ? `+${v}` : v}</span>
}

/**
 * Briefly shown "+X" badge that floats up and fades when resources are gained.
 * Uses a unique key so React re-mounts it and restarts the CSS animation each time
 * the same resource is gained multiple times in quick succession.
 */
function GainFlash({ amount, epoch }) {
  if (!amount) return null
  return (
    <span key={epoch} className="gain-flash" aria-live="polite">
      +{amount}
    </span>
  )
}

function Meter({ k, label, value, max, net, color, gain }) {
  const Icon = RES_ICON[k]
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const low = pct < 20

  return (
    <div
      data-resource={k}
      className={`res res-meter${low ? ' is-low' : ''}`}
      title={`${label}: ${value}/${max}${net != null ? ` (${net >= 0 ? '+' : ''}${net} next action)` : ''}`}
    >
      <Icon size={30} className="res-icon" />
      <div className="res-body">
        <div className="res-label">
          {label}
          {net != null && <Delta v={net} />}
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <div className="res-num">
          {value} / {max}
          {gain ? <GainFlash amount={gain.amount} epoch={gain.epoch} /> : null}
        </div>
      </div>
    </div>
  )
}

function Count({ k, label, value, net, gain }) {
  const Icon = RES_ICON[k]

  return (
    <div data-resource={k} className="res res-count" title={`${label}: ${value}`}>
      <Icon size={32} className="res-icon" />
      <div className="res-body">
        <div className="res-label">
          {label}
          {net ? <Delta v={net} /> : null}
        </div>
        <div className="res-big">
          {value.toLocaleString()}
          {gain ? <GainFlash amount={gain.amount} epoch={gain.epoch} /> : null}
        </div>
      </div>
    </div>
  )
}

export default function TopBar() {
  const { state } = useGame()
  const ui = useUI()
  const cap = caps(state)
  const { net } = projectProduction(state)
  const r = state.resources

  // gains: { [res]: { amount, epoch } } — only tracks explicit rewards & tapped bubbles,
  // NOT passive background production.
  const prevInteractionRef = useRef(state.lastInteraction)
  const gainTimers = useRef({})
  const epochRef = useRef(0)
  const [gains, setGains] = useState({})

  const triggerGain = useCallback((key, diff) => {
    const epoch = ++epochRef.current
    setGains((g) => ({
      ...g,
      [key]: { amount: (g[key]?.amount || 0) + diff, epoch },
    }))
    clearTimeout(gainTimers.current[key])
    gainTimers.current[key] = setTimeout(() => {
      setGains((g) => {
        const next = { ...g }
        delete next[key]
        return next
      })
    }, 1600)
  }, [])

  useEffect(() => {
    const prev = prevInteractionRef.current
    prevInteractionRef.current = state.lastInteraction

    // Only react to a brand-new interaction (different id)
    if (!state.lastInteraction || state.lastInteraction.id === prev?.id) return

    const reward = state.lastInteraction.reward || {}
    const gained = Object.entries(reward).filter(([, v]) => v > 0)
    if (gained.length === 0) return

    for (const [key, diff] of gained) {
      triggerGain(key, diff)
    }
  }, [state.lastInteraction, triggerGain])

  useEffect(() => {
    const onBubbleArrive = (e) => {
      if (!e.detail?.fromBubble || !e.detail?.isLast) return
      triggerGain(e.detail.res, e.detail.totalAmount || e.detail.amount)
    }
    window.addEventListener('cloudbreakers:resource-token-arrive', onBubbleArrive)
    return () => window.removeEventListener('cloudbreakers:resource-token-arrive', onBubbleArrive)
  }, [triggerGain])

  return (
    <div className="topbar panel" data-tutorial="hud-resources" onClick={() => ui.setPanel('storage')} role="button" tabIndex={0} aria-label="Resources — open storage">
      <Meter k="energy"    label="Energy"    value={r.energy}        max={cap.energy}  net={net.energy}    gain={gains.energy}    color="linear-gradient(90deg,#f0c53c,#ffe28a)" />
      <Meter k="water"     label="Water"     value={r.water}         max={cap.water}   net={net.water}     gain={gains.water}     color="linear-gradient(90deg,#3aa2f0,#8fd3ff)" />
      <Meter k="happiness" label="Happiness" value={state.happiness} max={100}                             gain={gains.happiness}  color="linear-gradient(90deg,#b796f0,#e6d4ff)" />
      <Meter k="food"      label="Food"      value={r.food}          max={cap.food}    net={net.food}      gain={gains.food}      color="linear-gradient(90deg,#5fb24f,#a8e08a)" />
      <Count k="wood"      label="Wood"      value={r.wood}          net={net.wood}    gain={gains.wood} />
      <Count k="stone"     label="Stone"     value={r.stone}         net={net.stone}   gain={gains.stone} />
      <Count k="coins"     label="Coins"     value={r.coins}         net={net.coins}   gain={gains.coins} />
    </div>
  )
}
