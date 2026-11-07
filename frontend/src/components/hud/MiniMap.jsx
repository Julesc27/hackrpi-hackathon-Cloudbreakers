import { useEffect, useState } from 'react'
import { ISLANDS, ROUTE_MAP } from '../../game/data.js'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { WORLD } from '../map/Camera.jsx'

export default function MiniMap() {
  const { state } = useGame()
  const ui = useUI()
  const [view, setView] = useState(null)
  useEffect(() => {
    const update = () => {
      const v = ui.camera.current?.view()
      if (!v) return
      setView({ x: WORLD.x - v.x / v.s, y: WORLD.y - v.y / v.s, w: window.innerWidth / v.s, h: window.innerHeight / v.s })
    }
    const id = setInterval(update, 150)
    update()
    return () => clearInterval(id)
  }, [ui.camera])

  return (
    <div className="minimap panel">
      <div className="minimap-heading"><span>The skyways</span><span>N ↑</span></div>
      <svg viewBox="-80 -80 1940 1280" role="group" aria-label="Island navigation">
        <defs><clipPath id="miniFrame"><rect x="-80" y="-80" width="1940" height="1280" rx="80" /></clipPath></defs>
        <g clipPath="url(#miniFrame)">
          {state.bridges.map((b) => {
            const r = ROUTE_MAP[b.route], a = ISLANDS[r.a].hit, c = ISLANDS[r.b].hit
            return <path key={b.route} d={`M${a[0]} ${a[1]}L${c[0]} ${c[1]}`} stroke="#d8c58c" strokeWidth="14" strokeDasharray="18 16" fill="none" />
          })}
          {Object.entries(ISLANDS).map(([id, island]) => {
            const [x, y, rx] = island.hit
            return <g key={id} role="button" tabIndex="0" aria-label={`Go to ${island.name}`} className="mini-island" onClick={() => ui.openIsland(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.openIsland(id) } }}>
              <ellipse cx={x} cy={y} rx={rx * 0.7} ry="65" fill={state.connected.includes(id) ? '#9bc1cb' : '#5e729d'} stroke={ui.selected === id ? '#ffe6a3' : '#9caecb'} strokeWidth="10" />
              <ellipse cx={x - 20} cy={y - 22} rx={rx * 0.42} ry="44" fill={state.connected.includes(id) ? '#d8e3eb' : '#899ac1'} />
              {id === 'newHaven' && <circle cx={x} cy={y - 10} r="22" fill="#f3d087" />}
            </g>
          })}
          {view && <rect x={view.x} y={view.y} width={view.w} height={view.h} rx="30" fill="rgba(171,213,244,.04)" stroke="#bfe4f3" strokeWidth="8" pointerEvents="none" />}
        </g>
      </svg>
      <div className="minimap-caption">Choose your next horizon</div>
    </div>
  )
}
