import { useMemo } from 'react'
import { THEMES } from './Defs.jsx'
import { Tree, Windmill, Tank, Crystal, Greenhouse, Observatory, GardenPlot } from './sprites.jsx'

// Deterministic pseudo-random numbers so each island always looks the same.
function seeded(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function usePuffs(id, rx, ry) {
  return useMemo(() => {
    const rnd = seeded(id)
    const back = [], front = [], under = []
    for (let i = 0; i <= 9; i++) {
      const a = Math.PI + (i / 9) * Math.PI
      back.push({ x: Math.cos(a) * rx * 0.95, y: Math.sin(a) * ry * 0.85 + 6, r: rx * (0.15 + rnd() * 0.08) })
    }
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI
      front.push({ x: Math.cos(a) * rx * 1.02, y: Math.sin(a) * ry + ry * 0.38, r: rx * (0.17 + rnd() * 0.1) })
    }
    for (let i = 0; i < 7; i++) {
      under.push({ x: (rnd() - 0.5) * rx * 1.5, y: ry * (0.9 + rnd() * 0.9), r: rx * (0.13 + rnd() * 0.1) })
    }
    return { back, front, under }
  }, [id, rx, ry])
}

// Hand-placed decor per island theme, in island-local coordinates scaled by rx.
function Decor({ theme, rx, ry, id }) {
  const rnd = useMemo(() => seeded(id + 'decor'), [id])
  const k = rx / 130
  const items = []
  const tree = (x, y, s = 1, pine = false) => items.push({ y, el: <g transform={`translate(${x * k} ${y * k})`}><Tree s={s} pine={pine} tone={Math.floor(rnd() * 3)} /></g> })

  switch (theme) {
    case 'haven':
      [[-112, -32], [-98, 28], [104, 18], [92, -40], [-30, -62], [70, -58], [128, 4], [-128, 6], [10, 66], [-58, 60]].forEach(([x, y], i) => tree(x * 0.92, y * 0.92, 0.8 + (i % 3) * 0.1, i % 2 === 0))
      break
    case 'forest':
      for (let i = 0; i < 18; i++) {
        const a = rnd() * Math.PI * 2, d = 0.25 + rnd() * 0.65
        const x = Math.cos(a) * 110 * d, y = Math.sin(a) * 55 * d
        if (Math.abs(x + 30) < 18 && Math.abs(y - 22) < 14) continue
        if (Math.abs(x - 48) < 18 && Math.abs(y - 8) < 14) continue
        tree(x, y, 0.85 + rnd() * 0.45, rnd() > 0.45)
      }
      break
    case 'rain':
      items.push({ y: -18, el: <g transform={`translate(${-22 * k} ${-18 * k})`}><Tank r={26} h={16} /></g> })
      items.push({ y: -4, el: <g transform={`translate(${30 * k} ${-4 * k})`}><Tank r={20} h={24} /></g> })
      ;[[-86, -10], [92, -14], [-6, 34], [70, 30]].forEach(([x, y], i) => tree(x, y, 0.8, i % 2 === 0))
      break
    case 'crystal':
      ;[[-50, -20, 1.2, 0], [-8, -30, 1.5, 1], [34, -18, 1.1, 2], [70, 6, 0.9, 0], [-80, 10, 0.8, 1], [0, 30, 0.7, 2]].forEach(([x, y, s, h]) =>
        items.push({ y, el: <g transform={`translate(${x * k} ${y * k})`}><Crystal s={s} hue={h} /></g> }),
      )
      break
    case 'wind':
      ;[[-60, -18], [-4, -32], [54, -12]].forEach(([x, y], i) => items.push({ y, el: <g transform={`translate(${x * k} ${y * k})`}><Windmill h={60 + i * 6} speed={5 + i} /></g> }))
      ;[[-90, 10], [86, 14], [0, 40]].forEach(([x, y]) => tree(x, y, 0.75, true))
      break
    case 'gardens':
      items.push({ y: -20, el: <g transform={`translate(${-6 * k} ${-24 * k})`}><Greenhouse /></g> })
      ;[[-62, 10], [56, 0]].forEach(([x, y]) => items.push({ y, el: <g transform={`translate(${x * k} ${y * k})`}><GardenPlot big /></g> }))
      ;[[-96, -6], [92, -24], [6, 38]].forEach(([x, y]) => tree(x, y, 0.8))
      break
    case 'observatory':
      items.push({ y: -10, el: <g transform={`translate(0 ${-14 * k})`}><Observatory /></g> })
      ;[[-70, 0], [72, -6], [-30, 34]].forEach(([x, y], i) => tree(x, y, 0.8, i === 1))
      break
    default:
  }
  return items
}

export default function Island({ id, def, status, selected, onClick, sprites = [], label, children }) {
  const { rx, theme } = def
  const ry = rx / 2
  const { back, front, under } = usePuffs(id, rx, ry)
  const decor = Decor({ theme, rx, ry, id })
  const layered = [...decor, ...sprites].sort((a, b) => a.y - b.y)
  const hasFall = theme === 'rain' || theme === 'haven'
  const filter = status === 'hidden' ? 'url(#hidden)' : status === 'connected' ? undefined : 'url(#locked)'

  return (
    <g transform={`translate(${def.x} ${def.y})`} className={`island island-${status}${selected ? ' is-selected' : ''}`}>
      <g className="island-bob" style={{ animationDelay: `${(def.x % 7) * -0.6}s` }}>
        <g filter={filter} onClick={onClick} className="island-hit">
          {/* underside */}
          <path
            d={`M${-rx * 0.82},${ry * 0.3} C${-rx * 0.7},${ry * 1.5} ${-rx * 0.28},${ry * 2.3} 0,${ry * 2.55} C${rx * 0.28},${ry * 2.3} ${rx * 0.7},${ry * 1.5} ${rx * 0.82},${ry * 0.3} Z`}
            fill="url(#rock)"
          />
          <path d={`M${-rx * 0.8},${ry * 0.35} C${-rx * 0.6},${ry * 1.4} ${-rx * 0.3},${ry * 2} ${-rx * 0.05},${ry * 2.4} L${-rx * 0.2},${ry * 0.35}Z`} fill="url(#rockLight)" />
          {under.map((p, i) => <circle key={`u${i}`} cx={p.x} cy={p.y} r={p.r} fill="url(#cloudPuffDim)" opacity=".75" />)}
          {hasFall && (
            <g className="waterfall">
              <rect x={rx * 0.18} y={ry * 0.6} width={rx * 0.09} height={ry * 3.2} fill="url(#waterfall)" />
              <line x1={rx * 0.205} y1={ry * 0.6} x2={rx * 0.205} y2={ry * 3.4} stroke="#e8f6ff" strokeWidth="1.4" strokeDasharray="10 14" className="fall-line" />
              <line x1={rx * 0.245} y1={ry * 0.6} x2={rx * 0.245} y2={ry * 3.4} stroke="#e8f6ff" strokeWidth="1" strokeDasharray="6 18" className="fall-line slow" />
            </g>
          )}
          {back.map((p, i) => <circle key={`b${i}`} cx={p.x} cy={p.y} r={p.r} fill="url(#cloudPuff)" />)}
          {/* ground */}
          <ellipse cx="0" cy="6" rx={rx * 0.93} ry={ry * 0.93} fill={THEMES[theme].rim} />
          <ellipse cx="0" cy="0" rx={rx * 0.93} ry={ry * 0.93} fill={`url(#ground-${theme})`} />
          {theme === 'haven' && <ellipse cx="0" cy="0" rx={rx * 0.62} ry={ry * 0.62} fill="none" stroke="#d9cfbb" strokeWidth="9" opacity=".55" strokeDasharray="14 5" />}
          {layered.map((it, i) => <g key={i}>{it.el}</g>)}
          {front.map((p, i) => <circle key={`f${i}`} cx={p.x} cy={p.y} r={p.r} fill="url(#cloudPuff)" />)}
        </g>
        {status !== 'connected' && (
          <ellipse cx="0" cy={ry * 0.4} rx={rx * 1.05} ry={ry * 1.4} fill="url(#fog)" pointerEvents="none" className="island-fog" opacity={status === 'hidden' ? 1 : 0.45} />
        )}
        {selected && (
          <ellipse cx="0" cy="0" rx={rx * 1.02} ry={ry * 1.02} fill="none" stroke="#f3d98f" strokeWidth="2.5" strokeDasharray="8 8" className="select-ring" pointerEvents="none" />
        )}
        {children}
      </g>
      {label && (
        <g className="island-label" transform={`translate(0 ${-ry - 42})`} onClick={onClick}>
          <rect x={-label.w / 2} y="-13" width={label.w} height="26" rx="13" fill="rgba(12,19,58,.85)" stroke="#b8924a" />
          <text textAnchor="middle" y="5" className="island-label-text">{label.text}</text>
        </g>
      )}
    </g>
  )
}
