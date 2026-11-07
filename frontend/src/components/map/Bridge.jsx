import { ISLANDS } from '../../game/data.js'

// Point on island A's ellipse rim in the direction of island B
function edge(a, b, inset = 0.86) {
  const rx = a.rx * inset, ry = (a.rx / 2) * inset
  const dx = b.x - a.x, dy = b.y - a.y
  const t = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
  return { x: a.x + dx * t, y: a.y + dy * t }
}

export function routeGeometry(route, sagFactor = 0.08) {
  const A = ISLANDS[route.a], B = ISLANDS[route.b]
  const p1 = edge(A, B), p2 = edge(B, A)
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 + len * sagFactor }
  const nx = -(p2.y - p1.y) / len, ny = (p2.x - p1.x) / len
  const d = (o = 0) =>
    `M${p1.x + nx * o},${p1.y + ny * o} Q${mid.x + nx * o},${mid.y + ny * o} ${p2.x + nx * o},${p2.y + ny * o}`
  // true midpoint of the quadratic curve
  const center = { x: 0.25 * p1.x + 0.5 * mid.x + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * mid.y + 0.25 * p2.y }
  return { d, center, len }
}

export function Bridge({ route, bridge, onClick }) {
  const reinforced = bridge.type === 'reinforced'
  const { d, center } = routeGeometry(route, reinforced ? 0.03 : 0.08)
  const status = bridge.condition <= 0 ? 'closed' : bridge.condition < 40 ? 'strained' : 'good'
  const plank = reinforced ? '#d8d0c2' : '#c08a52'
  const base = reinforced ? '#8f8678' : '#6b4426'
  const rail = reinforced ? '#e3c27a' : '#5a3a20'
  const maskId = `m-${route.id}`

  return (
    <g className={`bridge bridge-${status}`} onClick={onClick}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
        <path d={d()} stroke="#fff" strokeWidth="70" fill="none" pathLength="1" className="draw-in" />
      </mask>
      <g mask={`url(#${maskId})`} opacity={status === 'closed' ? 0.45 : 1}>
        <path d={d()} transform="translate(0 10)" stroke="rgba(8,12,40,.45)" strokeWidth="20" fill="none" filter="url(#softShadow)" />
        <path d={d()} stroke={base} strokeWidth="17" fill="none" strokeLinecap="round" />
        <path d={d()} stroke={plank} strokeWidth="13" fill="none" strokeDasharray={reinforced ? '14 1.5' : '6 2.2'} />
        {[-8.5, 8.5].map((o) => (
          <g key={o}>
            <path d={d(o)} transform="translate(0 -6)" stroke={rail} strokeWidth="1.8" fill="none" />
            <path d={d(o)} stroke={rail} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="0.1 22" transform="translate(0 -3)" />
          </g>
        ))}
        {status !== 'good' && (
          <path d={d()} stroke="#ff8a5b" strokeWidth="13" fill="none" strokeDasharray="3 16" opacity=".7" />
        )}
      </g>
      {status !== 'good' && (
        <g transform={`translate(${center.x} ${center.y - 22})`} className="warn-badge">
          <circle r="13" fill="#2a1630" stroke="#ff8a5b" strokeWidth="2" />
          <text textAnchor="middle" y="5" fill="#ffb38f" fontWeight="800" fontSize="16">!</text>
        </g>
      )}
      <path d={d()} stroke="transparent" strokeWidth="26" fill="none" className="bridge-hit" />
    </g>
  )
}

export function GhostRoute({ route, cost, locked, onClick }) {
  const { d, center } = routeGeometry(route, 0.06)
  return (
    <g className={`ghost-route${locked ? ' is-locked' : ''}`} onClick={onClick}>
      <path d={d()} stroke="rgba(243,217,143,.55)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="1 11" className="ghost-dash" />
      <path d={d()} stroke="transparent" strokeWidth="26" fill="none" />
      <g transform={`translate(${center.x} ${center.y})`} className="route-btn">
        <circle r="21" fill="#121a4a" stroke="#e3c27a" strokeWidth="2" />
        <circle r="26" fill="none" stroke="rgba(227,194,122,.35)" strokeWidth="1.5" className="route-pulse" />
        {locked ? (
          <g transform="translate(-9 -10) scale(.75)">
            <rect x="5" y="10.5" width="14" height="10" rx="2" fill="#e3c27a" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#e3c27a" strokeWidth="2.2" />
          </g>
        ) : (
          <path d="M-8 0h16M0 -8v16" stroke="#f3d98f" strokeWidth="3" strokeLinecap="round" />
        )}
        <g transform="translate(0 36)">
          <rect x="-34" y="-11" width="68" height="22" rx="11" fill="rgba(12,19,58,.9)" stroke="#8a6a35" />
          <text textAnchor="middle" y="4.5" className="route-cost">{cost}</text>
        </g>
      </g>
    </g>
  )
}
