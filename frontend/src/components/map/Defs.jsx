export const THEMES = {
  haven: { top: '#86c26a', bottom: '#4b8a4c', rim: '#3b6b3f' },
  forest: { top: '#63a95a', bottom: '#2f6d3f', rim: '#2b5a35' },
  rain: { top: '#7dbd6c', bottom: '#457f4b', rim: '#386a40' },
  crystal: { top: '#a39dd2', bottom: '#5f5a98', rim: '#4a4680' },
  wind: { top: '#a3c47a', bottom: '#5d8a4a', rim: '#4d7340' },
  gardens: { top: '#8cc46d', bottom: '#4d8a47', rim: '#3d6f3c' },
  observatory: { top: '#b2bfd2', bottom: '#6b7a99', rim: '#56627f' },
}

// Shared gradients and filters. Referenced by id from every SVG on the page.
export default function Defs() {
  return (
    <defs>
      {Object.entries(THEMES).map(([k, t]) => (
        <radialGradient key={k} id={`ground-${k}`} cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor={t.top} />
          <stop offset="100%" stopColor={t.bottom} />
        </radialGradient>
      ))}
      <radialGradient id="cloudPuff" cx="42%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="55%" stopColor="#f2eefc" />
        <stop offset="100%" stopColor="#bdb6e3" />
      </radialGradient>
      <radialGradient id="cloudPuffDim" cx="42%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#e6e4f7" />
        <stop offset="100%" stopColor="#8e89c4" />
      </radialGradient>
      <linearGradient id="rock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6c6aa8" />
        <stop offset="60%" stopColor="#3b3d7a" />
        <stop offset="100%" stopColor="#23285a" />
      </linearGradient>
      <linearGradient id="rockLight" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#8e8cc9" stopOpacity=".55" />
        <stop offset="100%" stopColor="#8e8cc9" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="waterfall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#bfe6ff" stopOpacity=".95" />
        <stop offset="70%" stopColor="#5fb6ff" stopOpacity=".7" />
        <stop offset="100%" stopColor="#5fb6ff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="stoneSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#efe8da" />
        <stop offset="100%" stopColor="#b5ab98" />
      </linearGradient>
      <linearGradient id="towerSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#f3ecdd" />
        <stop offset="70%" stopColor="#d4c9b2" />
        <stop offset="100%" stopColor="#ab9f88" />
      </linearGradient>
      <radialGradient id="waterSurface" cx="40%" cy="40%" r="70%">
        <stop offset="0%" stopColor="#bfe8ff" />
        <stop offset="100%" stopColor="#3a9be8" />
      </radialGradient>
      <radialGradient id="beaconGlow">
        <stop offset="0%" stopColor="#fff6c8" stopOpacity=".95" />
        <stop offset="40%" stopColor="#ffd66b" stopOpacity=".45" />
        <stop offset="100%" stopColor="#ffd66b" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="windowGlow">
        <stop offset="0%" stopColor="#ffd66b" stopOpacity=".55" />
        <stop offset="100%" stopColor="#ffd66b" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fog">
        <stop offset="0%" stopColor="#1a2560" stopOpacity=".15" />
        <stop offset="100%" stopColor="#0b1233" stopOpacity=".55" />
      </radialGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="locked" x="-10%" y="-10%" width="120%" height="120%">
        <feColorMatrix type="saturate" values="0.55" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.78" intercept="0.02" />
          <feFuncG type="linear" slope="0.8" intercept="0.03" />
          <feFuncB type="linear" slope="0.9" intercept="0.07" />
        </feComponentTransfer>
      </filter>
      <filter id="hidden" x="-10%" y="-10%" width="120%" height="120%">
        <feColorMatrix type="matrix" values="0.1 0.1 0.1 0 0.08  0.1 0.12 0.12 0 0.11  0.15 0.15 0.2 0 0.3  0 0 0 0.55 0" />
        <feGaussianBlur stdDeviation="1.2" />
      </filter>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
    </defs>
  )
}
