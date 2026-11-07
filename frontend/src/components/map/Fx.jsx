import { useEffect, useRef } from 'react'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { islandAccess } from '../../game/engine.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { bridgeMid } from '../world/layout.js'

function ResIcon({ res, size = 26 }) {
  const s = size / 24
  const mark = {
    energy: <polygon points="13,2 6,13 11,13 10,22 18,10 13,10" fill="#f6cf4b" />,
    water: <path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z" fill="#4db4ff" />,
    wood: <rect x="4" y="9" width="12" height="7" rx="3.5" fill="#c98d55" />,
    coins: <circle cx="12" cy="12" r="7" fill="#f4c34f" stroke="#a87d1e" />,
    food: <><path d="M12 20V8" stroke="#86cf6a" strokeWidth="1.6" /><ellipse cx="9" cy="10" rx="2" ry="1.2" fill="#86cf6a" /><ellipse cx="15" cy="12" rx="2" ry="1.2" fill="#86cf6a" /></>,
  }[res]
  if (!mark) return null
  return <g transform={`translate(${-size / 2} ${-size / 2}) scale(${s})`}>{mark}</g>
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

    // wood gathered / harvested: the engine adds a 'gain' toast for these actions
    const fresh = state.toasts.filter((t) => !p.toasts.some((o) => o.id === t.id))
    for (const t of fresh) {
      if (t.kind !== 'gain') continue
      const m = /\+(\d+) wood/.exec(t.text)
      if (!m) continue
      const fromForest = /Verdant/.test(t.text)
      const [cx, cy] = ISLANDS[fromForest ? 'verdant' : 'newHaven'].hit
      out.push({ kind: 'float', x: cx + (Math.random() - 0.5) * 60, y: cy - 30, res: 'wood', text: `+${m[1]}`, ttl: 1500 })
    }

    // beacon
    if (state.beaconRestored && !p.beaconRestored) {
      out.push({ kind: 'burst', x: 765, y: 299, ttl: 1200 }, { kind: 'float', x: 765, y: 250, text: 'The beacon wakes!', ttl: 2400 })
      cam?.flyTo(765, 380, cam.fitScale * 1.4, { duration: 900 })
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
        const entries = Object.entries(yields).filter(([, v]) => v > 0)
        entries.forEach(([res, v], i) => {
          const amount = Math.max(1, Math.round(v * access[id]))
          const spread = (i - (entries.length - 1) / 2) * 56
          out.push({ kind: 'bubble', x: cx + spread + (id === 'newHaven' ? -rx * 0.45 : 0), y: cy - ry * 0.55, res, amount, ttl: 5000 })
        })
      }
    }

    if (out.length) ui.emitFx(out)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}

