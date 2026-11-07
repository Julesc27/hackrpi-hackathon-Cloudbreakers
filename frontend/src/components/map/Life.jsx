import { useMemo } from 'react'

// Soft SVG clouds used for the parallax foreground layer (the world itself is drawn in <WorldCanvas>).
function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

export function Cloud({ x, y, w = 200, tone = 'light', seed = 1, opacity = 1 }) {
  const puffs = useMemo(() => {
    const r = rng(seed * 97 + 13)
    const n = 6 + Math.floor(r() * 4)
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1)
      const arch = Math.sin(t * Math.PI)
      return { x: (t - 0.5) * w * 0.85, y: -arch * w * 0.16 + r() * w * 0.04, r: w * (0.13 + arch * 0.12 + r() * 0.05) }
    })
  }, [w, seed])
  const fill = tone === 'dim' ? 'url(#cloudDim)' : tone === 'mid' ? 'url(#cloudMid)' : 'url(#cloudLight)'
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <ellipse cx="0" cy={w * 0.06} rx={w * 0.52} ry={w * 0.12} fill={fill} />
      {puffs.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={fill} />)}
    </g>
  )
}

export function CloudDefs() {
  return (
    <>
      <radialGradient id="cloudLight" cx="42%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#ece7fb" />
        <stop offset="100%" stopColor="#a9a4dc" />
      </radialGradient>
      <radialGradient id="cloudMid" cx="42%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#d9d7f4" />
        <stop offset="100%" stopColor="#7d7fc0" />
      </radialGradient>
      <radialGradient id="cloudDim" cx="42%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#8d94d6" />
        <stop offset="100%" stopColor="#3d4794" />
      </radialGradient>
      <radialGradient id="bubbleFill" cx="40%" cy="30%" r="70%">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
        <stop offset=".7" stopColor="#f3ead2" stopOpacity=".95" />
        <stop offset="1" stopColor="#d9c08a" stopOpacity=".95" />
      </radialGradient>
    </>
  )
}
