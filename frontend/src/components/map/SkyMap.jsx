import { ISLANDS, ROUTE_MAP, BUILDINGS } from '../../game/data.js'
import { openRoutes, hasAnchor, bridgeCost, islandAccess } from '../../game/engine.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import Defs from './Defs.jsx'
import Island from './Island.jsx'
import { Bridge, GhostRoute } from './Bridge.jsx'
import { BUILDING_SPRITES, Beacon, Resident } from './sprites.jsx'

const RESIDENT_SPOTS = [[-38, 22], [42, 18], [-20, 40], [24, 40], [60, -6], [-56, -4], [8, -30], [-34, -26], [84, 22], [-86, 18], [0, 48], [36, -26]]

export default function SkyMap() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const access = islandAccess(state)
  const routes = openRoutes(state)
  const anchor = hasAnchor(state)
  const placingDef = ui.placing ? BUILDINGS[ui.placing] : null

  const statusOf = (id) =>
    state.connected.includes(id) ? 'connected' : state.discovered.includes(id) ? 'discovered' : 'hidden'

  const islands = Object.entries(ISLANDS).sort((a, b) => a[1].y - b[1].y)

  const onIslandClick = (id) => {
    if (ui.placing) return
    ui.openIsland(id)
  }

  const place = (island, slot) => {
    dispatch({ type: 'BUILD', buildingType: ui.placing, island, slot })
    ui.setPlacing(null)
  }

  return (
    <svg className={`skymap${ui.placing ? ' is-placing' : ''}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet">
      <Defs />

      {state.bridges.map((b) => (
        <Bridge key={b.route} route={ROUTE_MAP[b.route]} bridge={b} onClick={() => ui.setBridgeRoute(b.route)} />
      ))}

      {islands.map(([id, def]) => {
        const status = statusOf(id)
        const sprites = []
        if (status === 'connected') {
          for (const b of state.buildings.filter((x) => x.island === id)) {
            const [x, y] = def.slots[b.slot] || [0, 0]
            const S = BUILDING_SPRITES[b.type]
            sprites.push({
              y,
              el: (
                <g transform={`translate(${x} ${y})`}>
                  <g className={b.builtTurn === state.turn ? 'pop-in' : undefined}>{S && <S />}</g>
                </g>
              ),
            })
          }
          if (id === 'newHaven') {
            sprites.push({ y: -6, el: <g transform="translate(0 -6)"><Beacon lit={state.beaconRestored} /></g> })
            RESIDENT_SPOTS.slice(0, Math.min(state.population, RESIDENT_SPOTS.length)).forEach(([x, y], i) =>
              sprites.push({ y, el: <g transform={`translate(${x} ${y})`}><Resident i={i} /></g> }),
            )
          }
        }
        const label =
          id === 'newHaven'
            ? null
            : status === 'hidden'
              ? { text: 'Uncharted', w: 110 }
              : { text: def.name, w: def.name.length * 8.6 + 30 }

        const freeSlots =
          placingDef && status === 'connected' && access[id] && (!placingDef.homeOnly || id === 'newHaven')
            ? def.slots.map((_, i) => i).filter((i) => !state.buildings.some((b) => b.island === id && b.slot === i))
            : []

        return (
          <Island
            key={id}
            id={id}
            def={def}
            status={status}
            selected={ui.selected === id && ui.panel === 'island'}
            onClick={() => onIslandClick(id)}
            sprites={sprites}
            label={label}
          >
            {freeSlots.map((i) => {
              const [x, y] = def.slots[i]
              return (
                <g key={i} transform={`translate(${x} ${y})`} className="slot" onClick={() => place(id, i)}>
                  <polygon points="0,-11 22,0 0,11 -22,0" fill="rgba(243,217,143,.28)" stroke="#f3d98f" strokeWidth="1.6" />
                  <path d="M-6 0h12M0 -6v12" stroke="#fff6d6" strokeWidth="2" strokeLinecap="round" transform="translate(0 -18)" />
                </g>
              )
            })}
          </Island>
        )
      })}

      {!ui.placing &&
        routes.map((r) => (
          <GhostRoute
            key={r.id}
            route={r}
            locked={!anchor}
            cost={`${bridgeCost(r, 'rope').wood} wood`}
            onClick={() => ui.setBridgeRoute(r.id)}
          />
        ))}
    </svg>
  )
}
