import { useMemo } from 'react'

// Night sky behind the painted map. It fills the screen edges on any aspect ratio;
// the islets, moon and cloud banks themselves come from the concept art (decor.webp).
export default function Backdrop() {
  const stars = useMemo(() => {
    let s = 11
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 120 }, () => ({ x: r() * 1600, y: r() * 900, r: 0.4 + r() * 1.1, d: r() * 4 }))
  }, [])

  return (
    <svg className="backdrop" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="sky" cx="50%" cy="42%" r="78%">
          <stop offset="0%" stopColor="#253a8f" />
          <stop offset="45%" stopColor="#1a2b72" />
          <stop offset="100%" stopColor="#0d164a" />
        </radialGradient>
        <radialGradient id="seaPuff" cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f4f0ff" />
          <stop offset="60%" stopColor="#d9d3f2" />
          <stop offset="100%" stopColor="#8f8cc9" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      {stars.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" className="star" style={{ animationDelay: `${st.d}s` }} />
      ))}
      {/* a soft cloud sea the islands sink into */}
      <g opacity=".55">
        {Array.from({ length: 20 }, (_, i) => (
          <circle key={`b${i}`} cx={i * 86 + 30} cy={850 + (i % 4) * 14} r={70 + (i % 3) * 18} fill="url(#seaPuff)" />
        ))}
      </g>
      <g opacity=".9">
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={i * 72 - 20} cy={905 + (i % 3) * 16} r={64 + (i % 4) * 14} fill="url(#seaPuff)" />
        ))}
      </g>
    </svg>
  )
}
