import { useMemo } from 'react'

// Night sky: stars, moon, distant islets, birds and a cloud sea. Purely decorative.
export default function Backdrop() {
  const stars = useMemo(() => {
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 160 }, () => ({ x: r() * 1600, y: r() * 900, r: 0.4 + r() * 1.3, d: r() * 4 }))
  }, [])

  const islet = (x, y, s, key) => (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`} opacity=".42">
      <path d="M-40,0 C-30,30 -10,46 0,60 C10,46 30,30 40,0Z" fill="#3a4592" />
      <ellipse rx="44" ry="13" fill="#5560a8" />
      <path d="M-10,-2 v-22 h8 v22 M6,-2 l6,-26 l6,26" fill="#6d78bd" />
      {[-34, -12, 14, 34].map((cx, i) => <circle key={i} cx={cx} cy="6" r="12" fill="#8b90c8" />)}
    </g>
  )

  return (
    <svg className="backdrop" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="sky" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#24358a" />
          <stop offset="50%" stopColor="#152259" />
          <stop offset="100%" stopColor="#080d2b" />
        </radialGradient>
        <radialGradient id="moonGlow">
          <stop offset="0%" stopColor="#dfe6ff" stopOpacity=".35" />
          <stop offset="100%" stopColor="#dfe6ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="seaPuff" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c9c6ee" />
          <stop offset="100%" stopColor="#5d63a8" />
        </radialGradient>
        <mask id="moonMask">
          <rect width="1600" height="900" fill="#fff" />
          <circle cx="1478" cy="408" r="40" fill="#000" />
        </mask>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      {stars.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" className="star" style={{ animationDelay: `${st.d}s` }} />
      ))}
      <circle cx="1500" cy="420" r="90" fill="url(#moonGlow)" />
      <circle cx="1500" cy="420" r="42" fill="#e9ecff" mask="url(#moonMask)" />
      {islet(170, 560, 0.7, 'a')}
      {islet(1330, 110, 0.4, 'b')}
      {islet(700, 120, 0.45, 'c')}
      {islet(1520, 700, 0.55, 'd')}
      {islet(90, 300, 0.5, 'e')}
      <g className="birds" fill="none" stroke="#e6ebff" strokeWidth="1.6" strokeLinecap="round">
        <path d="M1180 420 q6 -6 12 0 q6 -6 12 0" />
        <path d="M1214 404 q5 -5 10 0 q5 -5 10 0" />
        <path d="M260 760 q6 -6 12 0 q6 -6 12 0" />
      </g>
      <g opacity=".85">
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={i * 78 - 20} cy={880 + (i % 3) * 18} r={70 + (i % 4) * 16} fill="url(#seaPuff)" />
        ))}
      </g>
    </svg>
  )
}
