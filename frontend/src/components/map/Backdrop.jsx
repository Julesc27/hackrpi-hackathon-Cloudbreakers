import { useMemo } from 'react'

// Far parallax layer: a deep navy storybook sky, a milky way, and the moon.
// It moves much slower than the world, which is what makes panning feel deep.
//
// Performance: this layer is completely static. The stars used to be ~320 individually
// animated SVG circles, which made the browser repaint the whole sky every frame. The
// twinkling stars (TWINKLE_STARS) are now drawn by the world canvas, which redraws anyway.
export const TWINKLE_STARS = (() => {
  let s = 77
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const out = Array.from({ length: 70 }, () => ({ fx: r(), fy: r() * 0.8, r: 0.5 + r() * 1, d: r() * 6, sp: 0.18 + r() * 0.12, bright: false }))
  for (let i = 0; i < 14; i++) out.push({ fx: 0.05 + r() * 0.9, fy: 0.03 + r() * 0.55, r: 1.6, d: r() * 6, sp: 0.2 + r() * 0.08, bright: true })
  return out
})()
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


  const svgProps = { className: 'backdrop', viewBox: '0 0 1600 900', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': true }

  return (
    <svg {...svgProps}>
      <defs>
        <radialGradient id="sky" cx="48%" cy="38%" r="85%">
          <stop offset="0%" stopColor="#173453" />
          <stop offset="38%" stopColor="#0d2341" />
          <stop offset="100%" stopColor="#07132b" />
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
      {stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" opacity={st.a} />)}
    </svg>
  )
}
