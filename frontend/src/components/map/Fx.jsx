import { useEffect, useRef } from 'react'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { islandAccess } from '../../game/engine.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import LAYOUT from '../../game/artLayout.json'

const ICON = { wood: 'wood', water: 'water', food: null, energy: 'energy', coins: 'coins' }
const FOOD_COLOR = '#5fae4f'

function ResIcon({ res, size = 26 }) {
  if (ICON[res]) return <image href={`/art/icon-${ICON[res]}.webp`} x={-size / 2} y={-size / 2} width={size} height={size} />
  // food: a little wheat sprig
  return (
    <g transform={`scale(${size / 24}) translate(-12 -12)`}>
      <path d="M12 22V8" stroke="#a5d47b" strokeWidth="1.6" strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <ellipse cx="9.5" cy={9 + i * 4} rx="2.4" ry="1.4" transform={`rotate(-35 9.5 ${9 + i * 4})`} fill={FOOD_COLOR} />
          <ellipse cx="14.5" cy={9 + i * 4} rx="2.4" ry="1.4" transform={`rotate(35 14.5 ${9 + i * 4})`} fill={FOOD_COLOR} />
        </g>
      ))}
    </g>
  )
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
      const box = LAYOUT[`bridge-${b.route}`]
      if (box) out.push({ kind: 'burst', x: box.x + box.w / 2, y: box.y + box.h / 2, ttl: 900 })
      const dest = state.connected.find((id) => !p.connected.includes(id))
      if (dest) {
        const [cx, cy, , ry] = ISLANDS[dest].hit
        out.push({ kind: 'float', x: cx, y: cy - ry * 0.4, text: `${ISLANDS[dest].name} connected!`, ttl: 2200 })
        setTimeout(() => cam?.focusIsland(dest, false, 1.15), 250)
      }
    }

    // wood gathered / harvested (same turn, no build)
    if (state.turn === p.turn && state.resources.wood > p.resources.wood && state.buildings.length === p.buildings.length) {
      const fromForest = state.sustainPenalty > p.sustainPenalty
      const [cx, cy] = ISLANDS[fromForest ? 'verdant' : 'newHaven'].hit
      out.push({ kind: 'float', x: cx + (Math.random() - 0.5) * 60, y: cy - 30, res: 'wood', text: `+${state.resources.wood - p.resources.wood}`, ttl: 1500 })
    }

    // beacon
    if (state.beaconRestored && !p.beaconRestored) {
      out.push({ kind: 'burst', x: 765, y: 287, ttl: 1200 }, { kind: 'float', x: 765, y: 230, text: 'The beacon wakes!', ttl: 2400 })
      cam?.flyTo(765, 380, cam.fitScale * 1.4, { duration: 900 })
    }

    // end of turn → collect bubbles over every island that produced something
    if (state.turn > p.turn) {
      const access = islandAccess(p)
      for (const id of Object.keys(access)) {
        const isl = ISLANDS[id]
        const [cx, cy, rx, ry] = isl.hit
        const yields = { ...(isl.yields || {}) }
        if (id === 'newHaven') {
          for (const b of p.buildings) {
            if (b.island !== 'newHaven') continue
            for (const [k, v] of Object.entries(BUILDINGS[b.type].prod || {})) yields[k] = (yields[k] || 0) + v
          }
        } else {
          for (const b of p.buildings.filter((x) => x.island === id)) {
            for (const [k, v] of Object.entries(BUILDINGS[b.type].prod || {})) yields[k] = (yields[k] || 0) + v
          }
        }
        const entries = Object.entries(yields).filter(([, v]) => v > 0)
        entries.forEach(([res, v], i) => {
          const amount = Math.max(1, Math.round(v * access[id]))
          const spread = (i - (entries.length - 1) / 2) * 56
          out.push({ kind: 'bubble', x: cx + spread + (id === 'newHaven' ? -rx * 0.45 : 0), y: cy - ry * 0.55, res, amount, ttl: 9000 })
        })
      }
    }

    if (out.length) ui.emitFx(out)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps
}

