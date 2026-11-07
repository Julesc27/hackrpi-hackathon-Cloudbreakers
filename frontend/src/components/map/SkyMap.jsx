import { useEffect, useRef, useState } from 'react'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { openRoutes, hasAnchor, bridgeCost, islandAccess, bridgeStatus } from '../../game/engine.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import Defs from './Defs.jsx'
import Camera, { WORLD } from './Camera.jsx'
import Backdrop from './Backdrop.jsx'
import { CloudDefs, Cloud } from './Life.jsx'
import { FxLayer, useWorldEvents } from './Fx.jsx'
import WorldCanvas from '../world/WorldCanvas.jsx'
import { bridgeMid } from '../world/layout.js'

// The world itself is drawn every frame by <WorldCanvas>. This SVG layer on top only holds
// what you interact with: island hit areas and labels, bridge buttons, building plots and effects.
export default function SkyMap() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const access = islandAccess(state)
  const routes = openRoutes(state)
  const anchor = hasAnchor(state)
  const placingDef = ui.placing ? BUILDINGS[ui.placing] : null
  const [hover, setHover] = useState(null)
  const hoverRef = useRef(null)
  hoverRef.current = hover

  const statusOf = (id) =>
    state.connected.includes(id) ? 'connected' : state.discovered.includes(id) ? 'discovered' : 'hidden'

  const place = (island, slot) => {
    dispatch({ type: 'BUILD', buildingType: ui.placing, island, slot })
    ui.setPlacing(null)
  }

  useWorldEvents()

  // Fly the camera to an island whenever its panel opens (from the map, the chart, a quest…)
  useEffect(() => {
    if (ui.panel === 'island' && ui.selected) ui.camera.current?.focusIsland(ui.selected)
  }, [ui.panel, ui.selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // While placing a building, pull back so every free plot is in view
  useEffect(() => {
    if (!ui.placing) return
    if (BUILDINGS[ui.placing]?.homeOnly) ui.camera.current?.focusIsland('newHaven', false)
    else ui.camera.current?.home()
  }, [ui.placing]) // eslint-disable-line react-hooks/exhaustive-deps

  const ids = Object.keys(ISLANDS)

  const near = (
    <svg className="near-clouds" viewBox={`${WORLD.x} ${WORLD.y} ${WORLD.w} ${WORLD.h}`} width="100%" height="100%" aria-hidden="true">
      <defs><CloudDefs /></defs>
      {/* a few big soft clouds that slide past in front of the world for depth */}
      {[[-470, -220, 420, 1], [2050, -160, 460, 2], [-470, 1040, 520, 3], [2060, 1020, 480, 4], [-520, 420, 360, 5], [2110, 460, 380, 6]].map(([x, y, w, seed]) => (
        <g key={seed} className="drift slow"><Cloud x={x} y={y} w={w} seed={seed * 31} opacity={0.7} /></g>
      ))}
    </svg>
  )

  return (
    <Camera apiRef={ui.camera} far={<Backdrop />} mid={<WorldCanvas hoverRef={hoverRef} />} near={near}>
      <svg className={`skymap${ui.placing ? ' is-placing' : ''}`} viewBox={`${WORLD.x} ${WORLD.y} ${WORLD.w} ${WORLD.h}`} width="100%" height="100%">
        <defs><CloudDefs /></defs>
        <Defs />

        {/* click targets + labels */}
        {ids.map((id) => {
          const st = statusOf(id)
          const [cx, cy, rx, ry] = ISLANDS[id].hit
          const selected = ui.selected === id && ui.panel === 'island'
          const label = id === 'newHaven' ? null : st === 'hidden' ? 'Uncharted' : ISLANDS[id].name
          const lw = label ? label.length * 8.4 + 34 : 0
          return (
            <g key={id} className={`isle-hit isle-hit-${st}`}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="transparent" onClick={() => !ui.placing && ui.openIsland(id)}
                onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover((h) => (h === id ? null : h))} />
              {selected && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#f3d98f" strokeWidth="2.5" strokeDasharray="8 8" className="select-ring" pointerEvents="none" />}
              {label && st !== 'connected' && (
                <g className="isle-label" transform={`translate(${cx} ${cy - ry * 0.15})`} onClick={() => !ui.placing && ui.openIsland(id)}><g className="ui-scale">
                  <rect x={-lw / 2} y="-14" width={lw} height="28" rx="14" fill="rgba(12,19,58,.82)" stroke="#d6b36a" strokeWidth="1.2" />
                  {st === 'discovered' && (
                    <g transform={`translate(${-lw / 2 + 10} -8) scale(.6)`}>
                      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="#e3c27a" />
                      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#e3c27a" strokeWidth="2.4" />
                    </g>
                  )}
                  <text textAnchor="middle" x={st === 'discovered' ? 7 : 0} y="5" className="isle-label-text">{label}</text>
                </g></g>
              )}
            </g>
          )
        })}

        {/* built bridges: invisible click strip + a warning badge when damaged */}
        {state.bridges.map((b) => {
          const s = bridgeStatus(b)
          const [mx, my] = bridgeMid(b.route)
          return (
            <g key={b.route} className={`bridge bridge-${s}`} onClick={() => ui.setBridgeRoute(b.route)}>
              <circle cx={mx} cy={my} r="26" fill="transparent" />
              {s !== 'good' && (
                <g transform={`translate(${mx} ${my - 26})`}><g className="warn-badge ui-scale">
                  <circle r="13" fill="#2a1630" stroke="#ff8a5b" strokeWidth="2" />
                  <text textAnchor="middle" y="5" fill="#ffb38f" fontWeight="800" fontSize="16">!</text>
                </g></g>
              )}
            </g>
          )
        })}

        {/* bridges you could build */}
        {!ui.placing && routes.map((r) => {
          const [mx, my] = bridgeMid(r.id)
          return (
            <g key={r.id} className={`ghost-route${anchor ? '' : ' is-locked'}`} onClick={() => ui.setBridgeRoute(r.id)}>
              <g transform={`translate(${mx} ${my})`}><g className="route-btn">
                <circle r="27" fill="none" stroke="rgba(243,217,143,.5)" strokeWidth="1.5" className="route-pulse" />
                <circle r="20" fill="url(#goldBtn)" stroke="#fff1c4" strokeWidth="1.5" />
                {anchor ? (
                  <path d="M-7 0h14M0 -7v14" stroke="#4a3208" strokeWidth="3.4" strokeLinecap="round" />
                ) : (
                  <g transform="translate(-8 -9) scale(.68)">
                    <rect x="5" y="10.5" width="14" height="10" rx="2" fill="#4a3208" />
                    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#4a3208" strokeWidth="2.4" />
                  </g>
                )}
                <g transform="translate(0 34)">
                  <rect x="-36" y="-11" width="72" height="22" rx="11" fill="rgba(12,19,58,.9)" stroke="#b8924a" />
                  <text textAnchor="middle" y="4.5" className="route-cost">{bridgeCost(r, 'rope').wood} wood</text>
                </g>
              </g></g>
            </g>
          )
        })}

        {/* plots while placing a building */}
        {placingDef && ids.map((id) => {
          if (statusOf(id) !== 'connected' || !access[id]) return null
          if (placingDef.homeOnly && id !== 'newHaven') return null
          return ISLANDS[id].plots.map(([x, y], i) => {
            if (state.buildings.some((b) => b.island === id && b.slot === i)) return null
            return (
              <g key={`${id}-${i}`} transform={`translate(${x} ${y})`} className="slot" onClick={() => place(id, i)}>
                <polygon points="0,-12 24,0 0,12 -24,0" fill="rgba(243,217,143,.35)" stroke="#fff1c4" strokeWidth="1.8" />
                <path d="M-6 0h12M0 -6v12" stroke="#fff6d6" strokeWidth="2.2" strokeLinecap="round" transform="translate(0 -22)" />
              </g>
            )
          })
        })}

        <FxLayer />
      </svg>
    </Camera>
  )
}
