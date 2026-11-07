// Isometric SVG sprites. Each sprite is drawn with its ground point at (0, 0).
// P(x, y, z) projects a 3D point to 2:1 isometric screen space.
const P = (x, y, z = 0) => [x - y, (x + y) / 2 - z]
const pts = (...ps) => ps.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')
const EDGE = 'rgba(30,25,50,.35)'

export function Shadow({ rx = 16, ry = 6 }) {
  return <ellipse cx="0" cy="2" rx={rx} ry={ry} fill="rgba(18,24,60,.28)" />
}

export function IsoBox({ a, b, h, z = 0, top, left, right }) {
  const A = a / 2, B = b / 2
  return (
    <g>
      <polygon points={pts(P(-A, B, z), P(A, B, z), P(A, B, z + h), P(-A, B, z + h))} fill={left} stroke={EDGE} strokeWidth=".6" />
      <polygon points={pts(P(A, B, z), P(A, -B, z), P(A, -B, z + h), P(A, B, z + h))} fill={right} stroke={EDGE} strokeWidth=".6" />
      {top && <polygon points={pts(P(-A, -B, z + h), P(A, -B, z + h), P(A, B, z + h), P(-A, B, z + h))} fill={top} stroke={EDGE} strokeWidth=".6" />}
    </g>
  )
}

export function GableRoof({ a, b, h, rh, color, dark, wall }) {
  const A = a / 2 + 2.5, B = b / 2 + 2.5
  return (
    <g>
      <polygon points={pts(P(-A, -B, h), P(A, -B, h), P(A, 0, h + rh), P(-A, 0, h + rh))} fill={dark} stroke={EDGE} strokeWidth=".6" />
      <polygon points={pts(P(a / 2, b / 2, h), P(a / 2, -b / 2, h), P(a / 2, 0, h + rh))} fill={wall} stroke={EDGE} strokeWidth=".6" />
      <polygon points={pts(P(-A, B, h), P(A, B, h), P(A, 0, h + rh), P(-A, 0, h + rh))} fill={color} stroke={EDGE} strokeWidth=".6" />
    </g>
  )
}

const face = (x1, x2, y, z1, z2) => pts(P(x1, y, z1), P(x2, y, z1), P(x2, y, z2), P(x1, y, z2))
const sideFace = (x, y1, y2, z1, z2) => pts(P(x, y1, z1), P(x, y2, z1), P(x, y2, z2), P(x, y1, z2))

export function House({ roof = '#3e5bb0', roofDark = '#2c4182', lit = true, s = 1 }) {
  const a = 22, b = 18, h = 13
  return (
    <g transform={`scale(${s})`}>
      <Shadow rx={22} ry={9} />
      <IsoBox a={a} b={b} h={h} left="#f1e4c4" right="#cdb88f" />
      <polygon points={face(-7, -2, b / 2, 4, 9)} fill={lit ? '#ffd66b' : '#59608a'} />
      <polygon points={face(3, 8, b / 2, 4, 9)} fill={lit ? '#ffe28f' : '#59608a'} />
      <polygon points={sideFace(a / 2, 3, -3, 0, 8)} fill="#7a4b2a" />
      <GableRoof a={a} b={b} h={h} rh={10} color={roof} dark={roofDark} wall="#d8c49c" />
      {lit && <circle cx={P(-5, b / 2, 7)[0]} cy={P(-5, b / 2, 7)[1]} r="7" fill="url(#windowGlow)" />}
    </g>
  )
}

export function Shelter() {
  return <House roof="#b8573a" roofDark="#8c3f29" />
}

export function Tree({ s = 1, pine = false, tone = 0 }) {
  const dark = ['#2c5e46', '#2f6a4a', '#3a6e3e'][tone % 3]
  const light = ['#3f8a5c', '#4c9a5f', '#5aa04f'][tone % 3]
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx="0" cy="1" rx="8" ry="3" fill="rgba(18,24,60,.25)" />
      <rect x="-1.6" y="-8" width="3.2" height="8" fill="#6b4428" />
      {pine ? (
        <>
          <polygon points="0,-30 10,-7 -10,-7" fill={dark} />
          <polygon points="0,-36 7.5,-17 -7.5,-17" fill={light} />
          <polygon points="0,-40 5,-27 -5,-27" fill={light} />
        </>
      ) : (
        <>
          <circle cx="0" cy="-15" r="9" fill={dark} />
          <circle cx="-3" cy="-18" r="5.6" fill={light} />
          <circle cx="4" cy="-13" r="4" fill={light} opacity=".7" />
        </>
      )}
    </g>
  )
}

export function Windmill({ h = 62, s = 1, speed = 6 }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx="0" cy="1" rx="8" ry="3" fill="rgba(18,24,60,.25)" />
      <polygon points={`-3,0 3,0 1.4,${-h} -1.4,${-h}`} fill="#f4efe6" stroke="#bdb3a2" strokeWidth=".5" />
      <g transform={`translate(0 ${-h})`}>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur={`${speed}s`} repeatCount="indefinite" />
          {[0, 120, 240].map((r) => (
            <path key={r} d="M0,0 C 5,-8 5,-24 1,-32 C -3,-24 -3,-8 0,0Z" fill="#f2e3c0" stroke="#c9a96b" strokeWidth=".6" transform={`rotate(${r})`} />
          ))}
        </g>
        <circle r="3" fill="#c9a24f" />
      </g>
    </g>
  )
}

export function SolarFarm() {
  const panel = (ox, oy) => {
    const a = 16, b = 9
    const p = (x, y, z) => P(x + ox, y + oy, z)
    return (
      <g key={`${ox}${oy}`}>
        <line x1={p(-6, 3, 0)[0]} y1={p(-6, 3, 0)[1]} x2={p(-6, 3, 4)[0]} y2={p(-6, 3, 4)[1]} stroke="#6b5b45" strokeWidth="1.2" />
        <line x1={p(6, 3, 0)[0]} y1={p(6, 3, 0)[1]} x2={p(6, 3, 4)[0]} y2={p(6, 3, 4)[1]} stroke="#6b5b45" strokeWidth="1.2" />
        <polygon points={pts(p(-a / 2, -b / 2, 9), p(a / 2, -b / 2, 9), p(a / 2, b / 2, 3), p(-a / 2, b / 2, 3))} fill="#2a4db5" stroke="#d9c58f" strokeWidth=".8" />
        <line x1={p(0, -b / 2, 9)[0]} y1={p(0, -b / 2, 9)[1]} x2={p(0, b / 2, 3)[0]} y2={p(0, b / 2, 3)[1]} stroke="#7fa2ff" strokeWidth=".5" />
        <line x1={p(-a / 2, 0, 6)[0]} y1={p(-a / 2, 0, 6)[1]} x2={p(a / 2, 0, 6)[0]} y2={p(a / 2, 0, 6)[1]} stroke="#7fa2ff" strokeWidth=".5" />
      </g>
    )
  }
  return (
    <g>
      <Shadow rx={26} ry={10} />
      {panel(-9, -8)}{panel(9, -8)}{panel(-9, 8)}{panel(9, 8)}
    </g>
  )
}

export function Tank({ r = 13, h = 15, rim = '#e2dccd', body = 'url(#stoneSide)' }) {
  return (
    <g>
      <ellipse cx="0" cy="2" rx={r + 4} ry={(r + 4) / 2} fill="rgba(18,24,60,.25)" />
      <path d={`M${-r},${-h} L${-r},0 A${r} ${r / 2} 0 0 0 ${r},0 L${r},${-h} Z`} fill={body} stroke={EDGE} strokeWidth=".6" />
      <ellipse cx="0" cy={-h} rx={r} ry={r / 2} fill={rim} stroke={EDGE} strokeWidth=".6" />
      <ellipse cx="0" cy={-h + 0.6} rx={r * 0.78} ry={r * 0.36} fill="url(#waterSurface)" />
    </g>
  )
}

export function WaterCollector() {
  return (
    <g>
      <Tank r={9} h={13} />
      <polygon points="-14,-26 14,-26 4,-15 -4,-15" fill="#e9e1cf" stroke="#bfb196" strokeWidth=".6" opacity=".95" />
      <line x1="-14" y1="-26" x2="-10" y2="-6" stroke="#8a6a45" strokeWidth="1" />
      <line x1="14" y1="-26" x2="10" y2="-6" stroke="#8a6a45" strokeWidth="1" />
    </g>
  )
}

export function RainBarrel() {
  return (
    <g>
      <Tank r={7} h={11} rim="#a8774a" body="#8a5a2e" />
      <path d="M-7,-4 A7 3.5 0 0 0 7,-4" stroke="#5d3a1c" fill="none" strokeWidth="1" />
    </g>
  )
}

export function GardenPlot({ big = false }) {
  const a = big ? 34 : 26, b = big ? 24 : 18
  return (
    <g>
      <IsoBox a={a} b={b} h={2.5} top="#7a5236" left="#5e3d25" right="#4d321e" />
      {[-2, -1, 0, 1, 2].map((i) => {
        const y = i * (b / 6)
        const [x1, y1] = P(-a / 2 + 3, y, 2.5)
        const [x2, y2] = P(a / 2 - 3, y, 2.5)
        return <line key={i} x1={x1} y1={y1 - 1} x2={x2} y2={y2 - 1} stroke={i % 2 ? '#7cc96a' : '#5fae4f'} strokeWidth="3" strokeLinecap="round" strokeDasharray="2.5 2" />
      })}
    </g>
  )
}

export function Anchor() {
  return (
    <g>
      <Shadow rx={18} ry={7} />
      <IsoBox a={22} b={14} h={4} top="#b98552" left="#8a5a2e" right="#6e4522" />
      {[[-8, -5], [8, -5], [-8, 5], [8, 5]].map(([x, y], i) => {
        const [sx, sy] = P(x, y, 4)
        return <rect key={i} x={sx - 1.5} y={sy - 12} width="3" height="12" fill="#6e4522" />
      })}
      <path d={`M${P(-8, -5, 16).join(',')} Q ${P(0, 0, 10).join(',')} ${P(8, 5, 16).join(',')}`} stroke="#e3c27a" strokeWidth="1.2" fill="none" />
      <path d={`M${P(8, -5, 16).join(',')} Q ${P(0, 0, 10).join(',')} ${P(-8, 5, 16).join(',')}`} stroke="#e3c27a" strokeWidth="1.2" fill="none" />
    </g>
  )
}

export function StorageHouse() {
  return (
    <g>
      <Shadow rx={22} ry={9} />
      <IsoBox a={24} b={18} h={12} left="#a87445" right="#8a5a2e" />
      <GableRoof a={24} b={18} h={12} rh={7} color="#6b7fa8" dark="#4b5d84" wall="#8a5a2e" />
      <polygon points={face(-5, 5, 9, 0, 8)} fill="#5d3a1c" />
    </g>
  )
}

export function Market() {
  const stripe = (i) => (i % 2 ? '#f4efe6' : '#d9534f')
  return (
    <g>
      <Shadow rx={22} ry={9} />
      <IsoBox a={22} b={14} h={9} top="#c9a46b" left="#a87445" right="#8a5a2e" />
      {[0, 1, 2, 3].map((i) => {
        const x1 = -13 + i * 6.5, x2 = x1 + 6.5
        return <polygon key={i} points={pts(P(x1, 11, 12), P(x2, 11, 12), P(x2, 2, 18), P(x1, 2, 18))} fill={stripe(i)} stroke={EDGE} strokeWidth=".5" />
      })}
      {[[-6, 4], [0, 4], [6, 4]].map(([x, y], i) => {
        const [sx, sy] = P(x, y, 9)
        return <circle key={i} cx={sx} cy={sy - 2} r="2.2" fill={['#f2a33a', '#86cf6a', '#d9534f'][i]} />
      })}
    </g>
  )
}

export function Clinic() {
  const [cx, cy] = P(0, 10, 9)
  return (
    <g>
      <Shadow rx={24} ry={10} />
      <IsoBox a={26} b={20} h={16} top="#f7f4ee" left="#f2eee6" right="#d6d0c4" />
      <rect x={cx - 1.8} y={cy - 5} width="3.6" height="10" fill="#d23a3a" />
      <rect x={cx - 5} y={cy - 1.8} width="10" height="3.6" fill="#d23a3a" />
      <polygon points={sideFace(13, 4, -4, 0, 7)} fill="#9fc3e8" />
    </g>
  )
}

export function Battery() {
  return (
    <g>
      <Shadow rx={18} ry={7} />
      <IsoBox a={18} b={14} h={5} top="#b8b1d8" left="#8f88b8" right="#746d9c" />
      <Crystal s={0.7} />
    </g>
  )
}

export function CommunityHall() {
  return (
    <g>
      <Shadow rx={28} ry={11} />
      <IsoBox a={30} b={20} h={14} left="#efe2c2" right="#cdb88f" />
      <GableRoof a={30} b={20} h={14} rh={11} color="#3e5bb0" dark="#2c4182" wall="#d8c49c" />
      <polygon points={face(-10, -5, 10, 4, 10)} fill="#ffd66b" />
      <polygon points={face(-1, 4, 10, 4, 10)} fill="#ffd66b" />
      <polygon points={face(8, 12, 10, 4, 10)} fill="#ffd66b" />
      <line x1={P(0, 0, 25)[0]} y1={P(0, 0, 25)[1]} x2={P(0, 0, 25)[0]} y2={P(0, 0, 25)[1] - 12} stroke="#c9a24f" strokeWidth="1.2" />
      <rect x={P(0, 0, 25)[0]} y={P(0, 0, 25)[1] - 12} width="9" height="5" fill="#3e5bb0" />
    </g>
  )
}

export function Crystal({ s = 1, hue = 0 }) {
  const main = ['#c6a8ff', '#a8c8ff', '#e0b0ff'][hue % 3]
  return (
    <g transform={`scale(${s})`} filter="url(#glow)">
      <ellipse cx="0" cy="1" rx="10" ry="3.5" fill="rgba(18,24,60,.25)" />
      <polygon points="0,-34 7,-14 3,0 -4,0 -7,-14" fill={main} stroke="#f3eaff" strokeWidth=".6" />
      <polygon points="0,-34 7,-14 3,0 0,-12" fill="#ffffff" opacity=".35" />
      <polygon points="-9,-18 -5,-8 -6,0 -11,0 -13,-9" fill={main} opacity=".85" />
      <polygon points="9,-20 13,-9 11,0 7,0 6,-10" fill={main} opacity=".85" />
    </g>
  )
}

export function Greenhouse() {
  return (
    <g>
      <Shadow rx={30} ry={12} />
      <IsoBox a={34} b={22} h={4} top="#d9d1c1" left="#bdb3a0" right="#a59b88" />
      <path d="M-26,-10 C -24,-40 24,-40 26,-10 L 18,-2 C 16,-24 -16,-24 -18,-2Z" fill="rgba(200,235,255,.35)" />
      <path d="M-24,-6 C -22,-38 22,-38 24,-6" fill="rgba(200,235,255,.45)" stroke="#e8f4ff" strokeWidth="1" />
      {[-14, -5, 5, 14].map((x) => (
        <path key={x} d={`M${x * 1.6},-6 C ${x * 1.2},-30 ${x * 0.6},-34 0,-35`} stroke="#e8f4ff" strokeWidth=".7" fill="none" opacity=".8" />
      ))}
      <ellipse cx="-6" cy="-12" rx="6" ry="4" fill="#5fae4f" opacity=".8" />
      <ellipse cx="7" cy="-11" rx="5" ry="3.5" fill="#7cc96a" opacity=".8" />
    </g>
  )
}

export function Observatory() {
  return (
    <g>
      <Tank r={16} h={22} rim="#e9e4d8" body="url(#stoneSide)" />
      <path d="M-16,-22 A16 16 0 0 1 16,-22 Z" fill="#3e5bb0" stroke="#2c4182" />
      <rect x="-2" y="-42" width="4" height="12" fill="#1b2766" />
      <g transform="translate(4 -36) rotate(-35)">
        <rect x="0" y="-3" width="22" height="6" rx="2" fill="#e3c27a" stroke="#8a6a35" strokeWidth=".6" />
      </g>
    </g>
  )
}

export function Beacon({ lit }) {
  return (
    <g>
      <ellipse cx="0" cy="4" rx="50" ry="25" fill="#cfc5b2" stroke="#a89c86" />
      <ellipse cx="0" cy="2" rx="40" ry="20" fill="#e2d9c6" />
      <ellipse cx="0" cy="2" rx="28" ry="14" fill="none" stroke="#c4b8a1" strokeWidth="1.5" />
      {lit && <ellipse cx="0" cy="2" rx="18" ry="9" fill="url(#waterSurface)" />}
      {/* banners */}
      {[-26, 26].map((x) => (
        <g key={x} transform={`translate(${x} -2)`}>
          <line x1="0" y1="0" x2="0" y2="-46" stroke="#c9a24f" strokeWidth="1.4" />
          <path d="M0,-44 h10 v16 l-5,-3 l-5,3z" fill="#2c4fb0" stroke="#e3c27a" strokeWidth=".6" />
          <circle cx="5" cy="-35" r="2" fill="#fff" />
        </g>
      ))}
      {/* tower */}
      <path d="M-12,-74 L-14,-6 A14 7 0 0 0 14,-6 L12,-74 Z" fill="url(#towerSide)" stroke={EDGE} strokeWidth=".6" />
      <ellipse cx="0" cy="-74" rx="12" ry="6" fill="#efe7d6" />
      {[-24, -48].map((y) => <path key={y} d={`M-13.2,${y} A13.2 6.6 0 0 0 13.2,${y}`} stroke="#c9a24f" strokeWidth="2" fill="none" />)}
      <rect x="-3" y="-40" width="6" height="10" rx="3" fill={lit ? '#ffd66b' : '#59608a'} />
      {/* armillary */}
      <g transform="translate(0 -92)">
        {lit && (
          <circle r="34" fill="url(#beaconGlow)">
            <animate attributeName="r" values="30;38;30" dur="3s" repeatCount="indefinite" />
          </circle>
        )}
        <line x1="0" y1="18" x2="0" y2="8" stroke="#c9a24f" strokeWidth="2" />
        <circle r="13" fill="none" stroke="#e3c27a" strokeWidth="1.8" />
        <ellipse rx="13" ry="5" fill="none" stroke="#e3c27a" strokeWidth="1.3" transform="rotate(-20)" />
        <ellipse rx="5" ry="13" fill="none" stroke="#e3c27a" strokeWidth="1.1" transform="rotate(25)" />
        <circle r="6.5" fill={lit ? '#fff3b0' : '#7d86a8'} />
      </g>
    </g>
  )
}

const SHIRTS = ['#2c4fb0', '#b8573a', '#5fae4f', '#8a5ac8', '#e3a13a', '#3a8fa8']
export function Resident({ i = 0 }) {
  return (
    <g className="resident" style={{ animationDelay: `${(i % 5) * 0.4}s` }}>
      <ellipse cx="0" cy="0.5" rx="3" ry="1.2" fill="rgba(18,24,60,.3)" />
      <rect x="-2.4" y="-7.5" width="4.8" height="7.5" rx="2" fill={SHIRTS[i % SHIRTS.length]} />
      <circle cx="0" cy="-9.6" r="2.5" fill="#f1c9a5" />
    </g>
  )
}

export const BUILDING_SPRITES = {
  shelter: Shelter,
  bridgeAnchor: Anchor,
  waterCollector: WaterCollector,
  garden: () => <GardenPlot big />,
  storageHouse: StorageHouse,
  solarFarm: SolarFarm,
  market: Market,
  clinic: Clinic,
  battery: Battery,
  communityHall: CommunityHall,
  windTurbine: () => <Windmill h={48} speed={4} />,
  starterGarden: () => <GardenPlot />,
  rainBarrel: RainBarrel,
}

// Small framed preview used in the build panel
export function SpritePreview({ type, size = 56 }) {
  const S = BUILDING_SPRITES[type]
  const tall = type === 'windTurbine'
  return (
    <svg width={size} height={size} viewBox={tall ? '-35 -70 70 76' : '-35 -45 70 56'} aria-hidden="true">
      {S && <S />}
    </svg>
  )
}
