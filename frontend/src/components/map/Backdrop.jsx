import { useMemo } from 'react'

// Far parallax layer: night sky, stars and the moon. It moves much slower than the world,
// which is what makes panning feel deep.
export default function Backdrop() {
  const stars = useMemo(() => {
    let s = 11
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 170 }, () => ({ x: r() * 1600, y: r() * 900, r: 0.4 + r() * 1.2, d: r() * 4 }))
  }, [])

  return (
    <svg className="backdrop" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="sky" cx="50%" cy="42%" r="78%">
          <stop offset="0%" stopColor="#253a8f" />
          <stop offset="45%" stopColor="#1a2b72" />
          <stop offset="100%" stopColor="#0d164a" />
        </radialGradient>
        <radialGradient id="moonHalo">
          <stop offset="0%" stopColor="#dfe6ff" stopOpacity=".28" />
          <stop offset="100%" stopColor="#dfe6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-400" y="-300" width="2400" height="1500" fill="url(#sky)" />
      {stars.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" className="star" style={{ animationDelay: `${st.d}s` }} />
      ))}
      <circle cx="1290" cy="170" r="120" fill="url(#moonHalo)" />
      {/* crescent moon */}
      <mask id="moonCut">
        <rect x="1200" y="80" width="180" height="180" fill="#fff" />
        <circle cx="1270" cy="156" r="44" fill="#000" />
      </mask>
      <circle cx="1290" cy="170" r="46" fill="#3a4a8f" opacity=".55" />
      <circle cx="1290" cy="170" r="46" fill="#f2f0ff" mask="url(#moonCut)" />
      <circle cx="1290" cy="170" r="46" fill="none" stroke="#e3dcff" strokeOpacity=".5" />
    </svg>
  )
}
