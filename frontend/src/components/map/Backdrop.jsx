import { useMemo } from 'react'

// Far parallax layer: a deep navy storybook sky, a milky way, and the moon.
// It moves much slower than the world, which is what makes panning feel deep.
export default function Backdrop() {
  const stars = useMemo(() => {
    let s = 11
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const field = Array.from({ length: 220 }, () => ({
      x: r() * 1800 - 80,
      y: r() * 980 - 40,
      r: 0.35 + r() * 1.15,
      d: r() * 5,
      a: 0.35 + r() * 0.65,
    }))
    // a soft diagonal band of extra stars — the milky way
    for (let i = 0; i < 90; i++) {
      const t = i / 90
      field.push({
        x: 80 + t * 1500 + (r() - 0.5) * 90,
        y: 80 + t * 520 + (r() - 0.5) * 70,
        r: 0.4 + r() * 1.4,
        d: r() * 5,
        a: 0.25 + r() * 0.55,
      })
    }
    return field
  }, [])

  const bright = useMemo(() => {
    let s = 29
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 14 }, () => ({ x: 80 + r() * 1500, y: 30 + r() * 520, d: r() * 4 }))
  }, [])

  return (
    <svg className="backdrop" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="sky" cx="48%" cy="38%" r="85%">
          <stop offset="0%" stopColor="#24357a" />
          <stop offset="38%" stopColor="#141c52" />
          <stop offset="100%" stopColor="#070b24" />
        </radialGradient>
        <linearGradient id="horizon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7d74c8" stopOpacity="0" />
          <stop offset="55%" stopColor="#6a62b4" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#cbb8ee" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id="milky" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#9aa6e8" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#9aa6e8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonHalo">
          <stop offset="0%" stopColor="#fff6dd" stopOpacity="0.45" />
          <stop offset="42%" stopColor="#d5def8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#d5def8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonFace" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="70%" stopColor="#f3edd8" />
          <stop offset="100%" stopColor="#e4d7b4" />
        </radialGradient>
      </defs>
      <rect x="-400" y="-300" width="2400" height="1500" fill="url(#sky)" />
      <ellipse cx="860" cy="280" rx="620" ry="160" fill="url(#milky)" transform="rotate(-18 860 280)" />
      <rect x="-200" y="620" width="2000" height="420" fill="url(#horizon)" />
      {stars.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" opacity={st.a} className="star" style={{ animationDelay: `${st.d}s` }} />
      ))}
      {bright.map((st, i) => (
        <g key={`b${i}`} className="star" style={{ animationDelay: `${st.d}s` }}>
          <circle cx={st.x} cy={st.y} r="1.7" fill="#fff8e4" />
          <path d={`M${st.x} ${st.y - 7} L${st.x} ${st.y + 7} M${st.x - 7} ${st.y} L${st.x + 7} ${st.y}`} stroke="#fff6d8" strokeWidth="0.6" opacity="0.7" />
        </g>
      ))}
      <circle cx="1288" cy="148" r="168" fill="url(#moonHalo)" />
      <mask id="moonCut">
        <rect x="1160" y="40" width="240" height="240" fill="#fff" />
        <circle cx="1258" cy="132" r="52" fill="#000" />
      </mask>
      <circle cx="1288" cy="148" r="54" fill="#2a356e" opacity="0.55" />
      <circle cx="1288" cy="148" r="54" fill="url(#moonFace)" mask="url(#moonCut)" />
      <circle cx="1274" cy="138" r="7" fill="#e4d8b8" opacity="0.55" mask="url(#moonCut)" />
      <circle cx="1296" cy="162" r="4" fill="#e7dcc0" opacity="0.45" mask="url(#moonCut)" />
      <circle cx="1288" cy="148" r="54" fill="none" stroke="#fff6e0" strokeOpacity="0.45" />
    </svg>
  )
}
