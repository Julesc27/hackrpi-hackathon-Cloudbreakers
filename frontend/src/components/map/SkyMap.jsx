import { useEffect, useRef, useState } from 'react'
import { pointerPastDragThreshold, shouldHintTravel, shouldTravelFromMapClick } from '../../game/travelInput.js'
import { ISLANDS, BUILDINGS, GATHER_AMOUNT } from '../../game/data.js'
import { openRoutes, hasAnchor, bridgeCost, islandAccess, bridgeStatus, bridgeLabel } from '../../game/engine.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import InteractionSites from './InteractionSites.jsx'
import Defs from './Defs.jsx'
import Camera, { WORLD } from './Camera.jsx'
import Backdrop from './Backdrop.jsx'
import { CloudDefs, Cloud } from './Life.jsx'
import { FxLayer, useWorldEvents } from './Fx.jsx'
import WorldCanvas from '../world/WorldCanvas.jsx'
import { buildingSprite, PAINTED_ATLASES } from '../world/paintedArt.js'
import { buildingLayout } from '../world/buildingLayout.js'
import { usePaintedAtlas } from '../PaintedSprite.jsx'
import { bridgeCurve } from '../world/people.js'
import { bridgeMid } from '../world/layout.js'

// The world itself is drawn every frame by <WorldCanvas>. This SVG layer on top only holds
// what you interact with: island hit areas and labels, bridge buttons, building plots and effects.
export default function SkyMap() {
  const { state, dispatch, player } = useGame()
  const ui = useUI()
  const access = islandAccess(state)
  const routes = openRoutes(state)
  const anchor = hasAnchor(state)
  const placingDef = ui.placing ? BUILDINGS[ui.placing] : null
  const buildingsAtlas = usePaintedAtlas('buildings')
  const sheltersAtlas = usePaintedAtlas('shelters')
  const footprint = (type, island, slot) => {
    const { sheet, cell } = buildingSprite(type, slot)
    return buildingLayout(type, island, slot, PAINTED_ATLASES[sheet].cells[cell])
  }
  const [hover, setHover] = useState(null)
  const [hint, setHint] = useState(null)
  const hoverRef = useRef(null)
  const hintTimer = useRef(null)
  const press = useRef(null)
  const lastTap = useRef(null)
  hoverRef.current = hover
  const uiBusy = Boolean(ui.placing || ui.panel || ui.bridgeRoute)

  const statusOf = (id) =>
    state.connected.includes(id) ? 'connected' : state.discovered.includes(id) ? 'discovered' : 'hidden'

  const worldPoint = (event) => {
    const svg = event.currentTarget.ownerSVGElement
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
  }
  const showHint = (event) => {
    const point = worldPoint(event)
    const coarse = window.matchMedia?.('(hover: none), (pointer: coarse), (any-pointer: coarse)').matches
    setHint({ x: point.x, y: point.y, text: coarse ? 'Double-tap to walk' : 'Double-click to walk' })
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), 1400)
  }
  useEffect(() => () => clearTimeout(hintTimer.current), [])
  const movedSincePress = (event) => press.current ? pointerPastDragThreshold(event.clientX - press.current.x, event.clientY - press.current.y) : false
  const walk = (island, event, detail = event.detail) => {
    event.stopPropagation()
    const gesture = { detail, moved: movedSincePress(event), uiBusy }
    if (!shouldTravelFromMapClick(gesture)) {
      if (shouldHintTravel(gesture)) showHint(event)
      return
    }
    setHint(null)
    const point = worldPoint(event)
    player.current.go(island, [point.x, point.y])
  }

  const place = (island, slot) => {
    dispatch({ type: 'BUILD', buildingType: ui.placing, island, slot })
    if (ui.placing === 'bridgeAnchor') ui.setPanel('bridges')
    ui.setPlacing(null)
  }

  useWorldEvents()

  // Fly the camera to an island whenever its panel opens (from the map, the chart, a quest…)
  useEffect(() => {
    if (ui.panel === 'island' && ui.selected) ui.camera.current?.focusIsland(ui.selected)
  }, [ui.panel, ui.selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // While placing, frame the island the player chose. Home-only buildings stay on New Haven.
  // Otherwise show that island's plots up close; with no focus, pull back so every connected plot is visible.
  useEffect(() => {
    if (!ui.placing) return
    const cam = ui.camera.current
    if (BUILDINGS[ui.placing]?.homeOnly) cam?.focusIsland('newHaven', false, 1.35)
    else if (ui.placeFocus && state.connected.includes(ui.placeFocus)) cam?.focusIsland(ui.placeFocus, false, 1.65)
    else cam?.home()
  }, [ui.placing, ui.placeFocus]) // eslint-disable-line react-hooks/exhaustive-deps

  const ids = Object.keys(ISLANDS)

  // Big soft clouds that slide past in front of the world. Each cloud is its own small element
  // so its drift is a GPU transform, instead of one huge SVG repainted every frame.
  const near = (
    <>
      {[[-470, -220, 420, 1], [2050, -160, 460, 2], [-470, 1040, 520, 3], [2060, 1020, 480, 4], [-520, 420, 360, 5], [2110, 460, 380, 6]].map(([x, y, w, seed]) => (
        <svg key={seed} className="near-cloud drift slow" aria-hidden="true"
          viewBox={`${-w * 0.6} ${-w * 0.45} ${w * 1.2} ${w * 0.62}`}
          style={{ left: x - WORLD.x - w * 0.6, top: y - WORLD.y - w * 0.45, width: w * 1.2, height: w * 0.62 }}>
          <Cloud x={0} y={0} w={w} seed={seed * 31} opacity={0.7} />
        </svg>
      ))}
    </>
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
          const label = st === 'hidden' ? 'Uncharted' : ISLANDS[id].name
          const lw = label ? label.length * 8.4 + 34 : 0
          return (
            <g key={id} className={`isle-hit isle-hit-${st}`}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} role="button" tabIndex="0" aria-label={`Walk on ${ISLANDS[id].name}`} title="Double-click to walk here" onKeyDown={(e) => { if (!uiBusy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); player.current.go(id, [cx, cy]) } }} fill="transparent" onPointerDown={(e) => { press.current = { x: e.clientX, y: e.clientY } }} onClick={(e) => {
                const now = performance.now()
                const prev = lastTap.current
                const repeat = prev?.island === id && now - prev.t < 450 && !pointerPastDragThreshold(e.clientX - prev.x, e.clientY - prev.y, 24)
                lastTap.current = { t: now, x: e.clientX, y: e.clientY, island: id }
                walk(id, e, repeat ? Math.max(2, e.detail) : e.detail)
              }}
                onPointerEnter={() => setHover(id)} onPointerLeave={() => setHover((h) => (h === id ? null : h))} />
              {selected && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#f3d98f" strokeWidth="2.5" strokeDasharray="8 8" className="select-ring" pointerEvents="none" />}
              {label && (
                <g className="isle-label" data-tutorial={id === 'newHaven' ? 'island-newHaven' : undefined} role="button" tabIndex="0" aria-label={`Explore ${ISLANDS[id].name}`} transform={`translate(${cx} ${cy + ry * 0.55})`} onClick={() => !ui.placing && ui.openIsland(id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.openIsland(id) } }}><g className="ui-scale">
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

        {!ui.placing && <InteractionSites />}

        {/* built bridges: invisible click strip + a warning badge when damaged */}
        {state.bridges.map((b) => {
          const s = bridgeStatus(b)
          const [mx, my] = bridgeMid(b.route)
          return (
            <g key={b.route} role="button" tabIndex="0" aria-label={`Manage ${bridgeLabel(b.route)} bridge`} className={`bridge bridge-${s}`} onClick={() => ui.setBridgeRoute(b.route)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.setBridgeRoute(b.route) } }}>
              <path d={bridgeCurve(b.route, 20, b.type).map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ')} fill="none" stroke="transparent" strokeWidth="30" />
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
            <g role="button" tabIndex="0" aria-label={`Plan bridge to ${ISLANDS[state.connected.includes(r.a) ? r.b : r.a].name}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.setBridgeRoute(r.id) } }} key={r.id} className={`ghost-route${anchor ? '' : ' is-locked'}`} onClick={() => ui.setBridgeRoute(r.id)}>
              <g transform={`translate(${mx} ${my})`}><g className="route-btn">
                <circle r="34" fill="transparent" />{/* a finger-sized hit area */}
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

        {/* built player buildings can be inspected */}
        {state.buildings.map((b) => {
          if (b.slot < 0 || BUILDINGS[b.type].infrastructure) return null
          const plot = ISLANDS[b.island]?.plots?.[b.slot]
          if (!plot) return null
          const shape = footprint(b.type, b.island, b.slot)
          return (
            <g key={b.id} className="building-hit" role="button" tabIndex="0"
              aria-label={`Inspect ${BUILDINGS[b.type].name}`}
              transform={`translate(${plot[0]} ${plot[1]})`}
              onClick={(e) => { e.stopPropagation(); if (!ui.placing) ui.openIsland(b.island) }}
              onKeyDown={(e) => { if (!ui.placing && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ui.openIsland(b.island) } }}>
              <title>{BUILDINGS[b.type].name}</title>
              <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx="7" fill="transparent" />

            </g>
          )
        })}

        {/* plots while placing a building — every connected island, not only New Haven */}
        {placingDef && ids.map((id) => {
          if (statusOf(id) !== 'connected' || !access[id]) return null
          if (placingDef.homeOnly && id !== 'newHaven') return null
          const occupied = (slot) => state.buildings.some((b) => !BUILDINGS[b.type].infrastructure && b.island === id && b.slot === slot)
          const firstFreePlot = ISLANDS[id].plots.findIndex((_, slot) => !occupied(slot))
          return ISLANDS[id].plots.map(([x, y], i) => {
            if (occupied(i)) return null
            const shape = footprint(ui.placing, id, i)
            const sprite = buildingSprite(ui.placing, i)
            const atlas = sprite.sheet === 'shelters' ? sheltersAtlas : buildingsAtlas
            return (
              <g key={`${id}-${i}`} transform={`translate(${x} ${y})`} className="slot" data-tutorial={id === 'newHaven' && i === firstFreePlot ? 'plot-newHaven' : undefined} role="button" tabIndex="0" aria-label={`Place ${placingDef.name} on ${ISLANDS[id].name} plot ${i + 1}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(id, i) } }} onClick={() => place(id, i)}>
                <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill="transparent" />
                <polygon points={`0,${-shape.groundDepth} ${shape.groundWidth},0 0,${shape.groundDepth} ${-shape.groundWidth},0`} fill="rgba(243,217,143,.28)" stroke="#fff1c4" strokeWidth="1.5" />
                {atlas?.cells[sprite.cell] && <>
                  <defs><pattern id={`preview-${id}-${i}`} patternUnits="userSpaceOnUse" x={shape.x} y={shape.y} width={shape.width} height={shape.height} viewBox={atlas.cells[sprite.cell].join(' ')}>
                    <image href={PAINTED_ATLASES[sprite.sheet].src} width={atlas.image.naturalWidth} height={atlas.image.naturalHeight} />
                  </pattern></defs>
                  <rect className="plot-preview" x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={`url(#preview-${id}-${i})`} pointerEvents="none" />
                </>}
                <path d="M-6 0h12M0 -6v12" stroke="#fff6d6" strokeWidth="2.2" strokeLinecap="round" transform={`translate(0 ${-shape.groundDepth - 10})`} pointerEvents="none" />
              </g>
            )
          })
        })}

        {hint && (
          <g className="travel-hint" transform={`translate(${hint.x} ${hint.y - 22})`}>
            <g className="ui-scale">
              <rect x="-86" y="-16" width="172" height="28" rx="14" fill="rgba(12,19,58,.92)" stroke="#d6b36a" />
              <text textAnchor="middle" y="4" className="travel-hint-text">{hint.text}</text>
            </g>
          </g>
        )}

        <FxLayer />
      </svg>
    </Camera>
  )
}
