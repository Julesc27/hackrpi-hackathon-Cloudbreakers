import { memo, useMemo } from 'react'
import { ISLANDS } from '../../game/data.js'
import { WORLD } from './Camera.jsx'
import { Resident } from './sprites.jsx'
import SPRITES from '../../game/spriteSizes.json'

// Everything in this file is decoration that makes the sky feel alive.
// Coordinates are world units (the concept art's 1600x900 frame, extended by WORLD).

function rng(seed) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
}

/* ---------------- clouds ---------------- */
export function Cloud({ x, y, w = 200, tone = 'light', seed = 1, opacity = 1 }) {
  const puffs = useMemo(() => {
    const r = rng(seed * 97 + 13)
    const n = 6 + Math.floor(r() * 4)
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1)
      const px = (t - 0.5) * w * 0.85
      const arch = Math.sin(t * Math.PI)
      return { x: px, y: -arch * w * 0.16 + r() * w * 0.04, r: w * (0.13 + arch * 0.12 + r() * 0.05) }
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
      <linearGradient id="fallSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".3" stopColor="#fff" stopOpacity=".9" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="beamGlow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="900">
        <stop offset="0" stopColor="#fff3b8" stopOpacity=".55" />
        <stop offset="1" stopColor="#fff3b8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="orbGlow">
        <stop offset="0" stopColor="#fff8d6" stopOpacity=".95" />
        <stop offset=".35" stopColor="#ffd66b" stopOpacity=".5" />
        <stop offset="1" stopColor="#ffd66b" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="firefly">
        <stop offset="0" stopColor="#fff6c4" />
        <stop offset=".4" stopColor="#ffd66b" stopOpacity=".8" />
        <stop offset="1" stopColor="#ffd66b" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="seaFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c9c4ee" stopOpacity="0" />
        <stop offset=".25" stopColor="#bdb8e8" stopOpacity=".85" />
        <stop offset="1" stopColor="#8f8cc9" stopOpacity="1" />
      </linearGradient>
      <radialGradient id="bubbleFill" cx="40%" cy="30%" r="70%">
        <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
        <stop offset=".7" stopColor="#f3ead2" stopOpacity=".95" />
        <stop offset="1" stopColor="#d9c08a" stopOpacity=".95" />
      </radialGradient>
    </>
  )
}

/* ---------------- far sky inside the world (behind islands) ---------------- */
const ISLETS = [
  // original concept positions
  ['islet-a', 1186, 219, 1, false], ['islet-b', 1375, 312, 0.95, false], ['islet-c', 621, 123, 0.9, false],
  ['islet-d', 138, 655, 1, false], ['islet-e', 179, 194, 1, false],
  // the wider sky
  ['islet-a', -330, -180, 1.25, true], ['islet-c', -420, 330, 0.8, false], ['islet-b', -300, 900, 1.3, true],
  ['islet-d', 290, -260, 0.75, true], ['islet-e', 860, -300, 1.1, false], ['islet-a', 1500, -240, 0.85, true],
  ['islet-b', 1880, 140, 1.15, false], ['islet-d', 1930, 640, 0.9, true], ['islet-c', 1760, 1020, 1.2, false],
  ['islet-e', 420, 1080, 1.3, true], ['islet-a', 1080, 1120, 0.8, false], ['islet-e', 2010, -160, 0.7, false],
]

export const FarSky = memo(function FarSky() {
  const backClouds = useMemo(() => {
    const r = rng(42)
    const out = []
    // cloud banks around the edges of the world, never over the painted archipelago
    for (let i = 0; i < 26; i++) {
      const edge = i % 4
      let x, y
      if (edge === 0) { x = WORLD.x + r() * WORLD.w; y = WORLD.y + 40 + r() * 260 }
      else if (edge === 1) { x = WORLD.x + 40 + r() * 380; y = WORLD.y + r() * WORLD.h }
      else if (edge === 2) { x = 1650 + r() * 420; y = WORLD.y + r() * WORLD.h }
      else { x = WORLD.x + r() * WORLD.w; y = 950 + r() * 120 }
      out.push({ x, y, w: 180 + r() * 260, seed: i + 3, tone: r() > 0.5 ? 'dim' : 'mid', o: 0.45 + r() * 0.4, dur: 70 + r() * 70 })
    }
    return out
  }, [])
  return (
    <g className="far-sky" pointerEvents="none">
      {backClouds.map((c, i) => (
        <g key={i} className="drift" style={{ animationDuration: `${c.dur}s`, animationDelay: `${-c.dur * (i % 5) / 5}s` }}>
          <Cloud x={c.x} y={c.y} w={c.w} tone={c.tone} seed={c.seed} opacity={c.o} />
        </g>
      ))}
      {ISLETS.map(([name, x, y, s, flip], i) => {
        const z = SPRITES[name]
        return (
          <g key={i} className="islet-bob" style={{ animationDelay: `${-i * 1.3}s`, animationDuration: `${7 + (i % 4)}s` }}>
            <image href={`/art/sprite-${name}.webp`} x={x} y={y} width={z.w * s} height={z.h * s}
              transform={flip ? `translate(${2 * x + z.w * s} 0) scale(-1 1)` : undefined}
              opacity={i < 5 ? 0.95 : 0.55 + (s - 0.7) * 0.4} />
          </g>
        )
      })}
    </g>
  )
})

/* ---------------- cloud sea + front clouds (in front of island roots) ---------------- */
export const CloudSea = memo(function CloudSea() {
  const puffs = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 40 }, (_, i) => ({
      x: WORLD.x + (i / 39) * WORLD.w + (r() - 0.5) * 60,
      y: 880 + r() * 40 + (i % 3) * 16,
      w: 150 + r() * 110,
      seed: 100 + i,
      dur: 40 + r() * 30,
    }))
  }, [])
  // soft banks that hide where the painted islands were cropped at the edge of the concept frame
  const edges = [[1615, 470, 170, 201], [1640, 610, 210, 202], [1610, 760, 190, 203], [120, 430, 150, 204], [95, 560, 170, 205]]
  return (
    <g className="cloud-sea" pointerEvents="none">
      {edges.map(([x, y, w, seed]) => (
        <g key={seed} className="sway" style={{ animationDuration: `${36 + (seed % 5) * 6}s` }}>
          <Cloud x={x} y={y} w={w} seed={seed} tone="light" opacity={0.95} />
        </g>
      ))}
      <rect x={WORLD.x} y={900} width={WORLD.w} height={WORLD.y + WORLD.h - 900} fill="url(#seaFade)" />
      {puffs.map((p, i) => (
        <g key={i} className="sway" style={{ animationDuration: `${p.dur}s`, animationDelay: `${-i * 2.1}s` }}>
          <Cloud x={p.x} y={p.y} w={p.w} seed={p.seed} tone={i % 4 === 0 ? 'mid' : 'light'} />
        </g>
      ))}
    </g>
  )
})

/* ---------------- birds & airship ---------------- */
const BIRD_PATHS = [
  'M -560 260 C 200 120, 700 330, 1400 180 S 2200 260, 2300 120',
  'M 2250 520 C 1700 420, 1300 620, 700 560 S -200 640, -600 480',
  'M -560 980 C 300 860, 900 1040, 1600 900 S 2200 940, 2300 860',
]
export const Birds = memo(function Birds() {
  const z = SPRITES.bird
  return (
    <g pointerEvents="none">
      {BIRD_PATHS.map((d, i) => (
        <g key={i}>
          {[0, 1, 2].slice(0, i === 1 ? 2 : 3).map((j) => (
            <g key={j}>
              <animateMotion dur={`${46 + i * 9}s`} repeatCount="indefinite" path={d} begin={`${-i * 13 - j * 0.9}s`} rotate="0" />
              <g transform={`translate(${j * 26 - 26} ${j % 2 ? 14 : 0}) scale(${(i === 1 ? -0.6 : 0.6) * (1 - j * 0.12)} 0.6)`}>
                <g className="flap" style={{ animationDelay: `${j * 0.17}s` }}>
                  <image href="/art/sprite-bird.webp" x={-z.w / 2} y={-z.h / 2} width={z.w} height={z.h} />
                </g>
              </g>
            </g>
          ))}
        </g>
      ))}
    </g>
  )
})

export const Airship = memo(function Airship() {
  return (
    <g pointerEvents="none">
      <animateMotion dur="110s" repeatCount="indefinite" begin="-30s"
        path="M 2300 40 C 1700 -40, 1200 80, 800 20 S -100 60, -700 -20" />
      <g className="airship-bob">
        <ellipse cx="0" cy="58" rx="40" ry="8" fill="rgba(10,16,50,.18)" />
        <path d="M-58 0 C -58 -26, 58 -26, 66 0 C 58 26, -58 26, -58 0 Z" fill="#eef0f8" stroke="#a88a4a" strokeWidth="1.5" />
        <path d="M-58 0 C -58 -26, 58 -26, 66 0" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="3" />
        {[-34, -10, 14, 38].map((x) => <path key={x} d={`M${x} -19 C ${x + 6} -6, ${x + 6} 6, ${x} 19`} fill="none" stroke="#c9a24f" strokeWidth="1.6" />)}
        <path d="M60 -6 l 14 -10 v 32 l -14 -10z" fill="#2c4fb0" stroke="#c9a24f" />
        <path d="M-20 18 L -14 30 M 20 18 L 14 30" stroke="#8a6a35" strokeWidth="1.4" />
        <rect x="-18" y="28" width="36" height="12" rx="3" fill="#8a5a2e" stroke="#c9a24f" />
        <rect x="-12" y="31" width="5" height="4" fill="#ffd66b" /><rect x="-2" y="31" width="5" height="4" fill="#ffd66b" /><rect x="8" y="31" width="5" height="4" fill="#ffd66b" />
        <g className="prop"><ellipse cx="-62" cy="0" rx="2" ry="10" fill="#c9a24f" /></g>
      </g>
    </g>
  )
})

/* ---------------- waterfalls ---------------- */
// [island, x, y, width, height]
const FALLS = [
  ['mistral', 597, 292, 20, 75], ['mistral', 620, 300, 18, 70],
  ['newHaven', 527, 488, 30, 100], ['newHaven', 706, 598, 30, 170], ['newHaven', 801, 470, 9, 48],
  ['rain', 930, 150, 12, 70], ['rain', 1003, 255, 12, 30],
  ['skyport', 1366, 690, 26, 95],
]
export function Waterfalls({ connected }) {
  return (
    <g pointerEvents="none" className="falls">
      {FALLS.filter(([id]) => connected.includes(id)).map(([id, x, y, w, h], i) => (
        <g key={i}>
          {[0.2, 0.5, 0.8].map((t, j) => (
            <line key={j} x1={x + w * t} y1={y} x2={x + w * t} y2={y + h} stroke="url(#fallSheen)" strokeWidth={Math.max(1.2, w * 0.09)}
              strokeDasharray={`${h * 0.18} ${h * 0.3}`} className="fall-streak" style={{ animationDuration: `${0.9 + j * 0.35}s` }} />
          ))}
          <g className="mist">
            <ellipse cx={x + w / 2} cy={y + h - 4} rx={w * 0.55} ry={w * 0.25} fill="#fff" opacity=".12" />
          </g>
        </g>
      ))}
    </g>
  )
}

/* ---------------- people walking about ---------------- */
const WALKS = {
  newHaven: ['M 632 522 L 700 540', 'M 842 532 L 905 519', 'M 690 470 L 730 488', 'M 610 500 L 650 470'],
  mistral: ['M 455 300 L 520 282 L 565 262', 'M 300 300 L 345 318'],
  rain: ['M 850 262 L 905 276 L 960 290', 'M 1040 285 L 1075 268'],
  mercy: ['M 385 505 L 440 488 L 470 470'],
  hearth: ['M 1095 480 L 1150 500 L 1210 520', 'M 1230 505 L 1290 480', 'M 1160 450 L 1200 440'],
  verdant: ['M 470 690 L 530 700 L 600 695', 'M 545 735 L 600 720'],
  gardens: ['M 885 700 L 930 680 L 990 665', 'M 1130 690 L 1180 710'],
  skyport: ['M 1385 640 L 1430 655 L 1480 650'],
}
export function Walkers({ connected, population }) {
  const list = []
  let budget = Math.max(3, Math.round(population * 0.9))
  for (const id of ['newHaven', ...connected.filter((x) => x !== 'newHaven')]) {
    for (const d of WALKS[id] || []) {
      if (budget-- <= 0) break
      list.push({ id, d, k: list.length })
    }
  }
  return (
    <g pointerEvents="none">
      {list.map(({ d, k }) => {
        const dur = 14 + (k * 7) % 11
        return (
          <g key={d}>
            <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={d} keyPoints="0;1;1;0;0" keyTimes="0;0.42;0.5;0.92;1" calcMode="linear" begin={`${-k * 3.1}s`} />
            <g transform="scale(.9)"><Resident i={k} /></g>
          </g>
        )
      })}
    </g>
  )
}

/* ---------------- fireflies / lantern sparkles over connected islands ---------------- */
export function Fireflies({ connected }) {
  const dots = useMemo(() => {
    const r = rng(5)
    const out = []
    for (const id of Object.keys(ISLANDS)) {
      const [cx, cy, rx, ry] = ISLANDS[id].hit
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85
        out.push({ id, x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d - 10, dl: r() * 6, dur: 4 + r() * 4, s: 0.6 + r() * 0.8 })
      }
    }
    return out
  }, [])
  return (
    <g pointerEvents="none">
      {dots.filter((d) => connected.includes(d.id)).map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={5 * d.s} fill="url(#firefly)" className="firefly"
          style={{ animationDelay: `${-d.dl}s`, animationDuration: `${d.dur}s` }} />
      ))}
    </g>
  )
}

/* ---------------- beacon light ---------------- */
export function BeaconLight({ lit }) {
  if (!lit) return null
  return (
    <g transform="translate(765 287)" pointerEvents="none" className="beacon-light">
      <g className="beams">
        <path d="M0 0 L 900 -70 L 900 70 Z" fill="url(#beamGlow)" />
        <path d="M0 0 L -900 -70 L -900 70 Z" fill="url(#beamGlow)" />
      </g>
      <circle r="46" fill="url(#orbGlow)" className="orb-pulse" />
    </g>
  )
}
