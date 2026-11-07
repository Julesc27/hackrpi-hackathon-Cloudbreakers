import { useEffect, useRef } from 'react'
import { INTERACTION_POINTS, STARTER_BEACON } from '../../game/mapLayout.js'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { islandAccess } from '../../game/engine.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { RES_ICON } from '../icons.jsx'
import { bridgeMid } from '../world/layout.js'
import { WORLD } from './Camera.jsx'

function ResIcon({ res, size = 26 }) {
  const Icon = RES_ICON[res]
  return Icon ? <g transform={`translate(${-size / 2} ${-size / 2})`}><Icon size={size} /></g> : null
}

/** Renders floating numbers, sparkle bursts and tap-to-collect bubbles (world coordinates). */
export function FxLayer() {
  const ui = useUI()
  return (
    <g className="fx-layer">
      {ui.fx.map((f) => {
        if (f.kind === 'float') {
          return (
            <g key={f.id} transform={`translate(${f.x} ${f.y})`} pointerEvents="none">
              <g className="fx-float">
                {f.res && <g transform="translate(-30 0)"><ResIcon res={f.res} size={24} /></g>}
                <text x={f.res ? -14 : 0} y="7" textAnchor={f.res ? 'start' : 'middle'} className="fx-text">{f.text}</text>
              </g>
            </g>
          )
        }
        if (f.kind === 'harvest') {
          const color = { wood: '#b1dc8b', garden: '#d2ec92', stone: '#d5dfed', water: '#94e9ff', crystal: '#a0eaff' }[f.material] || '#f0d598'
          return <g key={f.id} transform={`translate(${f.x} ${f.y})`} pointerEvents="none" className={`harvest-effect harvest-${f.material}`}>
            <ellipse className="harvest-flash" cy="10" rx="42" ry="24" fill={color} />
            <ellipse className="harvest-ring" cy="12" rx="28" ry="12" fill="none" stroke={color} strokeWidth="2.5" />
            {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30})`}>
              <g className="harvest-particle" style={{ animationDelay: `${i % 3 * .035}s`, '--travel': `${60 + i % 3 * 16}px` }}>
                {['wood', 'garden'].includes(f.material) ? <ellipse cy="-9" rx="4" ry="8" fill={color} transform="rotate(25)" /> : f.material === 'water' ? <path d="M0-19Q-9-9 0-5Q9-9 0-19" fill={color} /> : <path d="M0-20 5-12 0-4-5-12Z" fill={color} stroke="#e9f7ff" strokeWidth=".8" />}
              </g>
            </g>)}
          </g>
        }
        if (f.kind === 'burst') {
          return (
            <g key={f.id} transform={`translate(${f.x} ${f.y})`} className="fx-burst" pointerEvents="none">
              <circle r="10" className="burst-ring" />
              {Array.from({ length: 10 }, (_, i) => (
                <g key={i} transform={`rotate(${i * 36})`}>
                  <path d="M0 -4 L1.4 0 L0 4 L-1.4 0Z" fill="#fff3c2" className="burst-spark" style={{ animationDelay: `${(i % 3) * 0.04}s` }} />
                </g>
              ))}
            </g>
          )
        }
        if (f.kind === 'bubble') {
          const collect = () => {
            ui.clearFx(f.id)
            ui.emitFx({ kind: 'float', x: f.x, y: f.y - 10, text: `+${f.amount}`, res: f.res, ttl: 1400 })
          }
          return (
            <g key={f.id} transform={`translate(${f.x} ${f.y})`} onClick={collect}>
              <g className="fx-bubble" style={{ animationDelay: `${(f.id % 5) * 0.12}s` }}>
              <g className="bubble-bob" style={{ animationDelay: `${(f.id % 7) * -0.4}s` }}>
                <path d="M0 26 L -7 14 A 22 22 0 1 1 7 14 Z" fill="url(#bubbleFill)" stroke="#c9962f" strokeWidth="2" />
                <ResIcon res={f.res} size={26} />
                <g transform="translate(15 -15)">
                  <rect x="-13" y="-10" width="30" height="20" rx="10" fill="#1f2a5a" stroke="#f3d98f" strokeWidth="1.2" />
                  <text x="2" y="4.5" textAnchor="middle" className="bubble-num">{f.amount}</text>
                </g>
              </g>
              </g>
            </g>
          )
        }
        return null
      })}
    </g>
  )
}

/**
 * Watches game state and turns changes into world effects:
 * new building → burst · new bridge → burst + fly to island · end of turn → collect bubbles ·
 * gathered wood → floating number · beacon restored → big glow.
 */
export function useWorldEvents() {
  const { state } = useGame()
  const ui = useUI()
  const prev = useRef(state)

  useEffect(() => {
    const p = prev.current
    prev.current = state
    if (p === state) return
    const cam = ui.camera.current
    const out = []

    // new buildings
    if (state.buildings.length > p.buildings.length) {
      for (const b of state.buildings.slice(p.buildings.length)) {
        const plot = ISLANDS[b.island]?.plots?.[b.slot]
        if (!plot) continue
        out.push({ kind: 'burst', x: plot[0], y: plot[1] - 10, ttl: 900 })
        out.push({ kind: 'float', x: plot[0], y: plot[1] - 40, text: BUILDINGS[b.type].name, ttl: 1500 })
      }
    }

    // new bridges
    if (state.bridges.length > p.bridges.length) {
      const b = state.bridges[state.bridges.length - 1]
      const [mx, my] = bridgeMid(b.route)
      out.push({ kind: 'burst', x: mx, y: my, ttl: 900 })
      const dest = state.connected.find((id) => !p.connected.includes(id))
      if (dest) {
        const [cx, cy, , ry] = ISLANDS[dest].hit
        out.push({ kind: 'float', x: cx, y: cy - ry * 0.4, text: `${ISLANDS[dest].name} connected!`, ttl: 2200 })
        setTimeout(() => cam?.focusIsland(dest, false, 1.15), 250)
      }
    }

    // Direct interaction receipts use the validated reward, so rejected clicks never animate gains.
    const interaction = state.lastInteraction
    if (interaction && interaction.id !== p.lastInteraction?.id) {
      const point = INTERACTION_POINTS[interaction.siteId]
      if (point) {
        out.push({ kind: 'harvest', material: interaction.kind, x: point[0], y: point[1], ttl: 1700 })
        Object.entries(interaction.reward).filter(([, value]) => value > 0).forEach(([res, amount], i) => {
          out.push({ kind: 'float', x: point[0] + i * 26, y: point[1] - 35 - i * 26, res, text: `+${amount}`, ttl: 1450 })

          // Convert world coordinates to screen coordinates and fire flying tokens
          const camEl = document.querySelector('.camera')
          const cr = camEl ? camEl.getBoundingClientRect() : { left: 0, top: 0 }
          const camState = cam?.view?.() || { x: 0, y: 0, s: 1 }
          const { x: camX, y: camY, s } = camState
          const screenX = cr.left + (point[0] - WORLD.x) * s + camX
          const screenY = cr.top + (point[1] - WORLD.y) * s + camY
          window.dispatchEvent(new CustomEvent('cloudbreakers:fly-resource', {
            detail: { res, amount, startX: screenX, startY: screenY, delayOffset: i * 120 },
          }))
        })
      }
    }

    // beacon
    if (state.beaconRestored && !p.beaconRestored) {
      out.push({ kind: 'burst', x: STARTER_BEACON[0], y: STARTER_BEACON[1], ttl: 1200 }, { kind: 'float', x: STARTER_BEACON[0], y: STARTER_BEACON[1] - 45, text: 'The beacon wakes!', ttl: 2400 })
      cam?.flyTo(STARTER_BEACON[0], STARTER_BEACON[1] + 80, cam.fitScale * 1.4, { duration: 900 })
    }

    // every action moves the settlement forward (the engine awards XP and applies production):
    // show what each island produced as resource bubbles you can tap
    if (state.xp > p.xp) {
      const access = islandAccess(p)
      for (const id of Object.keys(access)) {
        const isl = ISLANDS[id]
        const [cx, cy, rx, ry] = isl.hit
        const yields = { ...(isl.yields || {}) }
        for (const b of p.buildings.filter((x) => x.island === id)) {
          for (const [k, v] of Object.entries(BUILDINGS[b.type].prod || {})) yields[k] = (yields[k] || 0) + v
        }
        const entries = Object.entries(yields).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2)
        entries.forEach(([res, v], i) => {
          const amount = Math.max(1, Math.round(v * access[id]))
          const spread = (i - (entries.length - 1) / 2) * 56
          out.push({ kind: 'bubble', x: cx + spread + (id === 'newHaven' ? -rx * 0.45 : 0), y: cy - ry * 0.55, res, amount, ttl: 2400 })
        })
      }
    }

    if (out.length) ui.emitFx(out)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}
