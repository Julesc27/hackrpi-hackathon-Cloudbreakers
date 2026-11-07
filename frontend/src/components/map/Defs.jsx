// Shared SVG gradients and filters, referenced by id from every SVG on the page.
export default function Defs() {
  return (
    <defs>
      <radialGradient id="goldBtn" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#fff2c2" />
        <stop offset="55%" stopColor="#e8bf5c" />
        <stop offset="100%" stopColor="#a8792a" />
      </radialGradient>
      {/* sprite gradients */}
      <linearGradient id="stoneSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#efe8da" />
        <stop offset="100%" stopColor="#b5ab98" />
      </linearGradient>
      <radialGradient id="waterSurface" cx="40%" cy="40%" r="70%">
        <stop offset="0%" stopColor="#bfe8ff" />
        <stop offset="100%" stopColor="#3a9be8" />
      </radialGradient>
      <radialGradient id="windowGlow">
        <stop offset="0%" stopColor="#ffd66b" stopOpacity=".55" />
        <stop offset="100%" stopColor="#ffd66b" stopOpacity="0" />
      </radialGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>

      {/* islands not yet connected: cooler, darker, a little hazy */}
      <filter id="locked" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0.35" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.52" intercept="0.05" />
          <feFuncG type="linear" slope="0.56" intercept="0.07" />
          <feFuncB type="linear" slope="0.72" intercept="0.16" />
        </feComponentTransfer>
      </filter>
      <filter id="hidden" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0.12 0.12 0.12 0 0.07  0.12 0.14 0.14 0 0.1  0.16 0.16 0.22 0 0.26  0 0 0 0.75 0" />
        <feGaussianBlur stdDeviation="1.4" />
      </filter>
      <filter id="dusk" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0.7" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="0.8" /><feFuncG type="linear" slope="0.8" /><feFuncB type="linear" slope="0.9" intercept="0.04" />
        </feComponentTransfer>
      </filter>
      {/* reinforced bridges read as pale stone */}
      <filter id="stone" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0.15" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.05" intercept="0.06" /><feFuncG type="linear" slope="1.05" intercept="0.06" /><feFuncB type="linear" slope="1.08" intercept="0.08" />
        </feComponentTransfer>
      </filter>
      {/* unbuilt bridge: a faint golden blueprint */}
      <filter id="blueprint" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0.95  0 0 0 0 0.84  0 0 0 0 0.56  0 0 0 0.4 0" />
      </filter>
      {/* warm lantern light on player-built sprites */}
      <filter id="warm" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ffd66b" floodOpacity=".35" />
      </filter>
    </defs>
  )
}
