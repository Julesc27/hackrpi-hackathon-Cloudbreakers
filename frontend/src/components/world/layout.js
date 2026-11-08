// The world, island by island, in the concept art's 1600 x 900 frame.
//   ground  – the island's top surface as a union of 2:1 ellipses [x, y, rx, ry]
//   depth   – how far the rocky underside hangs
//   falls   – waterfalls pouring off the front edge { x, w, len }
//   paved   – plazas, paths, fields, pools, decks (drawn into the ground)
//   props   – things standing on the island (see props.js)
//   nav     – walkway graph residents move along: nodes { id: [x, y, tag?] }, edges [a, b]
// Building plots for the player live in game/data.js (ISLANDS[id].plots) and are kept clear here.
import { ISLAND_OFFSETS, shiftIslandPoint } from '../../game/mapLayout.js'
import { ISLANDS } from '../../game/data.js'
import { rng } from './iso.js'

const P = (pts, w = 9) => ({ type: 'path', pts, w })

const BASE_WORLD_ISLANDS = {
  newHaven: {
    seed: 11, depth: 250, material: 'stone',
    biome: ['#d4f0a4', '#7ec86a', '#3f8a40'],
    ground: [[765, 455, 210, 112], [700, 535, 92, 48], [842, 525, 82, 44]],
    falls: [{ x: 738, w: 26, len: 200 }, { x: 600, w: 18, len: 110 }],
    paved: [
      { type: 'ellipse', x: 765, y: 468, rx: 168, ry: 84 },
      P([[690, 402], [712, 350]]), P([[840, 402], [848, 358]]), P([[615, 468], [562, 448]]),
      P([[915, 468], [972, 458]]), P([[690, 535], [680, 548]]), P([[840, 535], [860, 560]]),
      { type: 'tier', x: 765, y: 447, rx: 104, ry: 52, h: 9, stairs: [842, 478] },
      { type: 'pool', x: 765, y: 512, rx: 30, ry: 10 },
      { type: 'crops', x: 596, y: 418, a: 22, b: 12 },
    ],
    props: [
      { type: 'tower', x: 765, y: 447, h: 100 },
      { type: 'banner', x: 712, y: 428, h: 44 }, { type: 'banner', x: 736, y: 412, h: 50 },
      { type: 'banner', x: 796, y: 412, h: 50 }, { type: 'banner', x: 820, y: 428, h: 44 },
      { type: 'house', x: 626, y: 398, a: 16, b: 13, h: 11, roof: 'blue' },
      { type: 'house', x: 902, y: 400, a: 17, b: 13, h: 11, roof: 'red', chimney: true },
      { type: 'lamp', x: 628, y: 440 }, { type: 'lamp', x: 702, y: 388 }, { type: 'lamp', x: 828, y: 388 },
      { type: 'lamp', x: 902, y: 440 }, { type: 'lamp', x: 902, y: 500 }, { type: 'lamp', x: 822, y: 556 },
      { type: 'lamp', x: 708, y: 556 }, { type: 'lamp', x: 628, y: 500 },
      { type: 'bench', x: 668, y: 452 }, { type: 'bench', x: 862, y: 452 },
      { type: 'flowers', x: 700, y: 478, w: 18 }, { type: 'flowers', x: 830, y: 478, w: 18 },
      { type: 'barrel', x: 640, y: 412 }, { type: 'crate', x: 885, y: 418 },
    ],
    nav: {
      nodes: {
        n1: [615, 468], n2: [640, 425], n3: [690, 402], n4: [765, 393], n5: [840, 402], n6: [890, 425],
        n7: [915, 468], n8: [890, 510], n9: [840, 535], n10: [765, 542], n11: [690, 535], n12: [640, 510],
        s1: [672, 458, 'sit'], s2: [858, 458, 'sit'], f1: [765, 528, 'look'],
        e_mistral: [712, 350], e_rain: [848, 358], e_mercy: [562, 448], e_hearth: [972, 458], e_verdant: [680, 548], e_gardens: [860, 560],
      },
      edges: [
        ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'n5'], ['n5', 'n6'], ['n6', 'n7'], ['n7', 'n8'], ['n8', 'n9'],
        ['n9', 'n10'], ['n10', 'n11'], ['n11', 'n12'], ['n12', 'n1'], ['n1', 's1'], ['n7', 's2'], ['n10', 'f1'],
        ['n3', 'e_mistral'], ['n5', 'e_rain'], ['n1', 'e_mercy'], ['n7', 'e_hearth'], ['n11', 'e_verdant'], ['n9', 'e_gardens'],
      ],
    },
    treeCount: 34,
  },

  mistral: {
    seed: 21, depth: 160,
    biome: ['#e2e6a0', '#8aaa52', '#4e7034'],
    ground: [[410, 238, 195, 92], [545, 265, 65, 36], [300, 285, 75, 38]],
    falls: [{ x: 575, w: 14, len: 85 }, { x: 330, w: 12, len: 60 }],
    paved: [P([[318, 282], [378, 268], [445, 262], [520, 262], [598, 262]]), P([[445, 262], [460, 295], [400, 300], [378, 268]], 7),
      { type: 'crops', x: 492, y: 236, a: 24, b: 14, colors: ['#7cc96a', '#5fae4f', '#c9d96a'] }],
    props: [
      { type: 'turbine', x: 322, y: 190, h: 72, speed: 1.5 }, { type: 'turbine', x: 372, y: 168, h: 80, speed: 1.8 },
      { type: 'turbine', x: 455, y: 162, h: 72, speed: 1.3 },
      { type: 'solar', x: 418, y: 214, rows: 2, cols: 3 },
      { type: 'house', x: 296, y: 262, a: 16, b: 13, h: 11, roof: 'red', chimney: true },
      { type: 'banner', x: 270, y: 236, h: 40 },
      { type: 'lamp', x: 350, y: 268 }, { type: 'lamp', x: 480, y: 270 }, { type: 'lamp', x: 560, y: 252 },
      { type: 'hedge', pts: [[470, 250], [520, 238]] },
    ],
    nav: {
      nodes: { m1: [318, 282], m2: [378, 268], m3: [445, 262], m4: [520, 262], m5: [460, 295], m6: [400, 300], w1: [492, 252, 'tend'], e_newHaven: [598, 262] },
      edges: [['m1', 'm2'], ['m2', 'm3'], ['m3', 'm4'], ['m4', 'e_newHaven'], ['m3', 'm5'], ['m5', 'm6'], ['m6', 'm2'], ['m4', 'w1']],
    },
    treeCount: 24,
  },

  rain: {
    seed: 31, depth: 155,
    biome: ['#c8f0d4', '#5eae90', '#2c7060'],
    ground: [[930, 212, 185, 92], [835, 250, 68, 34], [1048, 258, 72, 36]],
    falls: [{ x: 1000, w: 16, len: 80 }, { x: 870, w: 12, len: 55 }],
    paved: [P([[880, 250], [940, 262], [1000, 255], [1045, 268]]), P([[940, 262], [895, 298]], 8), P([[1000, 255], [980, 232]], 7)],
    props: [
      { type: 'tank', x: 935, y: 170, r: 30, h: 24, spout: true },
      { type: 'tank', x: 862, y: 202, r: 22, h: 15 },
      { type: 'tank', x: 1022, y: 208, r: 25, h: 18, spout: true },
      { type: 'banner', x: 1062, y: 172, h: 42 },
      { type: 'fence', pts: [[985, 292], [1040, 288]] }, { type: 'fence', pts: [[1040, 288], [1080, 270]] },
      { type: 'bench', x: 965, y: 275 }, { type: 'lamp', x: 912, y: 250 }, { type: 'lamp', x: 1030, y: 245 },
    ],
    nav: {
      nodes: { r1: [880, 250], r2: [940, 262], r3: [1000, 255], r4: [980, 232, 'look'], r5: [1045, 268], s1: [965, 268, 'sit'], e_newHaven: [895, 298] },
      edges: [['r1', 'r2'], ['r2', 'r3'], ['r3', 'r5'], ['r3', 'r4'], ['r2', 'e_newHaven'], ['r2', 's1']],
    },
    treeCount: 18,
  },

  mercy: {
    seed: 41, depth: 150,
    biome: ['#e4f0cc', '#9cc48a', '#5a8858'],
    ground: [[318, 462, 160, 88], [440, 478, 58, 36], [228, 515, 62, 32]],
    falls: [{ x: 300, w: 14, len: 65 }],
    paved: [P([[215, 452], [250, 478], [318, 492], [390, 480], [445, 466], [490, 465]]),
      { type: 'ellipse', x: 318, y: 488, rx: 30, ry: 12, fill: '#efe6d4' }],
    props: [
      { type: 'clinic', x: 322, y: 440 },
      { type: 'helipad', x: 205, y: 424 },
      { type: 'airship', x: 205, y: 392, base: 420, rope: true },
      { type: 'hedge', pts: [[345, 528], [392, 512]] }, { type: 'flowers', x: 372, y: 530, w: 22, n: 12 },
      { type: 'lamp', x: 280, y: 488 }, { type: 'lamp', x: 362, y: 490 }, { type: 'bench', x: 400, y: 500 },
    ],
    nav: {
      nodes: { c1: [318, 492], c2: [250, 478], c3: [215, 452, 'look'], c4: [390, 480], c5: [445, 466], s1: [400, 494, 'sit'], e_newHaven: [490, 465] },
      edges: [['c3', 'c2'], ['c2', 'c1'], ['c1', 'c4'], ['c4', 'c5'], ['c5', 'e_newHaven'], ['c4', 's1']],
    },
    treeCount: 20,
  },

  hearth: {
    seed: 51, depth: 165,
    biome: ['#d2eea0', '#6fbf62', '#3a8444'],
    ground: [[1215, 452, 195, 102], [1080, 438, 58, 32], [1335, 522, 72, 38]],
    falls: [{ x: 1215, w: 16, len: 75 }],
    paved: [P([[1062, 436], [1110, 445], [1200, 435], [1270, 455], [1320, 488], [1380, 545]]), P([[1200, 435], [1210, 505], [1320, 488]], 8),
      { type: 'crops', x: 1168, y: 536, a: 22, b: 12, colors: ['#7cc96a', '#f2a33a', '#5fae4f'] }],
    props: [
      { type: 'house', x: 1135, y: 412, a: 16, b: 13, roof: 'blue' },
      { type: 'house', x: 1185, y: 394, a: 18, b: 14, roof: 'purple', chimney: true },
      { type: 'house', x: 1245, y: 400, a: 16, b: 13, roof: 'red' },
      { type: 'house', x: 1302, y: 424, a: 17, b: 13, roof: 'blue', chimney: true },
      { type: 'house', x: 1158, y: 482, a: 16, b: 12, roof: 'red' },
      { type: 'house', x: 1250, y: 478, a: 17, b: 13, roof: 'purple' },
      { type: 'house', x: 1280, y: 520, a: 15, b: 12, roof: 'teal', chimney: true },
      { type: 'lamp', x: 1095, y: 432 }, { type: 'lamp', x: 1160, y: 446 }, { type: 'lamp', x: 1232, y: 440 },
      { type: 'lamp', x: 1300, y: 466 }, { type: 'lamp', x: 1205, y: 470 },
      { type: 'fence', pts: [[1150, 548], [1190, 528]] }, { type: 'well', x: 1222, y: 512 },
      { type: 'flowers', x: 1270, y: 445, w: 14 }, { type: 'bench', x: 1180, y: 452 },
    ],
    nav: {
      nodes: { e_newHaven: [1062, 436], h1: [1110, 445], h2: [1200, 435], h3: [1270, 455], h4: [1320, 488], h5: [1210, 505], t1: [1175, 525, 'tend'], s1: [1182, 446, 'sit'], e_skyport: [1380, 545] },
      edges: [['e_newHaven', 'h1'], ['h1', 'h2'], ['h2', 'h3'], ['h3', 'h4'], ['h4', 'e_skyport'], ['h2', 'h5'], ['h5', 'h4'], ['h5', 't1'], ['h2', 's1']],
    },
    treeCount: 20,
  },

  verdant: {
    seed: 61, depth: 150,
    biome: ['#7fb85e', '#3d7a3c', '#1e4a28'],
    ground: [[505, 688, 165, 82], [615, 668, 55, 30], [395, 715, 58, 30]],
    falls: [],
    paved: [P([[598, 628], [575, 660], [530, 675], [470, 680], [420, 705], [510, 705], [530, 675]]),
      { type: 'ellipse', x: 495, y: 680, rx: 46, ry: 18, fill: '#e9dcbc' }],
    props: [
      { type: 'stall', x: 468, y: 658, color: '#d9534f' }, { type: 'stall', x: 522, y: 650, color: '#3f8f9a' },
      { type: 'bunting', pts: [[430, 672], [560, 646]], h: 18 },
      { type: 'well', x: 512, y: 712 }, { type: 'crate', x: 445, y: 668 }, { type: 'crate', x: 450, y: 674, s: 0.8 }, { type: 'barrel', x: 545, y: 662 },
      { type: 'banner', x: 652, y: 700, h: 42 }, { type: 'lamp', x: 580, y: 672 }, { type: 'lamp', x: 440, y: 698 },
    ],
    nav: {
      nodes: { e_newHaven: [598, 628], v3: [575, 660], v2: [530, 675], v1: [470, 680, 'look'], v5: [420, 705], v4: [510, 705], m1: [495, 668, 'look'] },
      edges: [['e_newHaven', 'v3'], ['v3', 'v2'], ['v2', 'v1'], ['v1', 'v5'], ['v5', 'v4'], ['v4', 'v2'], ['v2', 'm1']],
    },
    treeCount: 32, pines: 0.85,
  },

  gardens: {
    seed: 71, depth: 150,
    biome: ['#e4ee8a', '#8fbf48', '#4e7a2c'],
    ground: [[1040, 690, 182, 86], [905, 688, 58, 30], [1172, 722, 58, 30]],
    falls: [{ x: 1088, w: 14, len: 60 }],
    paved: [P([[930, 640], [960, 672], [1030, 690], [1110, 690]]),
      { type: 'crops', x: 1000, y: 735, a: 34, b: 14 }, { type: 'crops', x: 1096, y: 722, a: 30, b: 14, colors: ['#a5c94f', '#7cc96a', '#e3b84f'] },
      { type: 'crops', x: 1060, y: 752, a: 22, b: 10, colors: ['#5fae4f', '#86cf6a'] }],
    props: [
      { type: 'windmill', x: 975, y: 650 }, { type: 'greenhouse', x: 1072, y: 655, a: 40, b: 24 },
      { type: 'shed', x: 1148, y: 690 }, { type: 'fence', pts: [[960, 748], [1030, 760]] },
      { type: 'lamp', x: 1000, y: 680 }, { type: 'lamp', x: 1120, y: 680 }, { type: 'barrel', x: 1160, y: 702 },
    ],
    nav: {
      nodes: { e_newHaven: [930, 640], g1: [960, 672], g2: [1030, 690], g3: [1110, 690], t1: [995, 720, 'tend'], t2: [1092, 708, 'tend'], t3: [1058, 742, 'tend'] },
      edges: [['e_newHaven', 'g1'], ['g1', 'g2'], ['g2', 'g3'], ['g2', 't1'], ['g3', 't2'], ['g2', 't3']],
    },
    treeCount: 20,
  },

  skyport: {
    seed: 81, depth: 130,
    biome: ['#f0ddb0', '#c4a574', '#8a6840'],
    ground: [[1472, 655, 92, 48], [1412, 612, 42, 24]],
    falls: [{ x: 1395, w: 14, len: 70 }],
    paved: [{ type: 'deck', x: 1482, y: 642, a: 96, b: 56, legs: 60 }],
    props: [
      { type: 'airship', x: 1520, y: 582, base: 640, rope: true },
      { type: 'banner', x: 1430, y: 604, h: 46 },
      { type: 'crate', x: 1505, y: 664 }, { type: 'crate', x: 1514, y: 671, s: 0.85 }, { type: 'crate', x: 1497, y: 672, s: 0.7 },
      { type: 'barrel', x: 1535, y: 655 }, { type: 'lamp', x: 1462, y: 622 },
    ],
    nav: {
      nodes: { e_hearth: [1410, 605], s1: [1442, 630], s2: [1490, 640], s3: [1522, 628, 'look'] },
      edges: [['e_hearth', 's1'], ['s1', 's2'], ['s2', 's3']],
    },
    treeCount: 6,
  },
}

export const WORLD_ISLANDS = {
  newHaven: BASE_WORLD_ISLANDS.newHaven,
  verdant: BASE_WORLD_ISLANDS.verdant,
  rain: BASE_WORLD_ISLANDS.rain,
  prism: BASE_WORLD_ISLANDS.mistral,
  mercy: BASE_WORLD_ISLANDS.mercy,
  hearth: BASE_WORLD_ISLANDS.hearth,
}
WORLD_ISLANDS.verdant.props = WORLD_ISLANDS.verdant.props.filter((p) => !['stall', 'bunting'].includes(p.type))
WORLD_ISLANDS.prism.props = [{ type: 'crystal', x: 410, y: 210, s: 2 }, { type: 'crystal', x: 470, y: 250, s: 1.5 }, { type: 'crystal', x: 350, y: 260, s: 1.2 }]

// Shift all geometric layers together; built bridges continue to land on the island edges.
for (const [id, [dx, dy]] of Object.entries(ISLAND_OFFSETS)) {
  const island = WORLD_ISLANDS[id]
  island.ground = island.ground.map(([x, y, ...size]) => [x + dx, y + dy, ...size])
  for (const fall of island.falls) fall.x += dx
  for (const item of [...island.props, ...island.paved]) {
    if (item.x != null) item.x += dx
    if (item.y != null) item.y += dy
    if (item.base != null) item.base += dy
    if (item.pts) item.pts = item.pts.map(([x, y]) => [x + dx, y + dy])
  }
  for (const point of Object.values(island.nav.nodes)) { point[0] += dx; point[1] += dy }
}
Object.assign(WORLD_ISLANDS.newHaven.nav.nodes, {
  e_mistral: [586, 380], e_rain: [907, 374], e_mercy: [500, 530],
  e_hearth: [1075, 525], e_verdant: [586, 380], e_prism: [1050, 652], e_gardens: [1005, 695],
})
WORLD_ISLANDS.newHaven.ground = [[775, 495, 300, 165], [750, 635, 275, 100]]

// Bridge anchor points (island edge → island edge) for every route in data.js
export const BRIDGE_ENDS = {
  'verdant-haven': { a: ['verdant', 'e_newHaven'], b: ['newHaven', 'e_verdant'] },
  'rain-haven': { a: ['rain', 'e_newHaven'], b: ['newHaven', 'e_rain'] },
  'prism-haven': { a: ['prism', 'e_newHaven'], b: ['newHaven', 'e_prism'] },
  'mercy-haven': { a: ['mercy', 'e_newHaven'], b: ['newHaven', 'e_mercy'] },
  'hearth-haven': { a: ['hearth', 'e_newHaven'], b: ['newHaven', 'e_hearth'] },
}
// Land on the walking surface inside the dock posts, not on its outer corner.
WORLD_ISLANDS.verdant.nav.nodes.e_newHaven = shiftIslandPoint('verdant', [535, 239])
WORLD_ISLANDS.rain.nav.nodes.e_newHaven = [1200, 225]
WORLD_ISLANDS.prism.nav.nodes.e_newHaven = shiftIslandPoint('prism', [1191, 882])
WORLD_ISLANDS.mercy.nav.nodes.e_newHaven = [300, 525]
WORLD_ISLANDS.hearth.nav.nodes.e_newHaven = [1321, 498]

// Separate terrace entrances keep the village and crystal crossings clear.
export const PRISM_GATE = WORLD_ISLANDS.newHaven.nav.nodes.e_prism
Object.assign(WORLD_ISLANDS.newHaven.nav.nodes, {
  eastPath: [1037, 533], eastThreshold: [1060, 520],
  crystalPath: [1005, 653],
})
WORLD_ISLANDS.newHaven.nav.edges = WORLD_ISLANDS.newHaven.nav.edges.filter(([, b]) => b !== 'e_hearth')
WORLD_ISLANDS.newHaven.nav.edges.push(
  ['n8', 'eastPath'], ['eastPath', 'eastThreshold'], ['eastThreshold', 'e_hearth'],
  ['n9', 'crystalPath'], ['crystalPath', 'e_prism'],
)

export function bridgePoints(routeId) {
  const e = BRIDGE_ENDS[routeId]
  if (!e) return null
  const A = WORLD_ISLANDS[e.a[0]].nav.nodes[e.a[1]]
  const B = WORLD_ISLANDS[e.b[0]].nav.nodes[e.b[1]]
  return { a: [A[0], A[1]], b: [B[0], B[1]] }
}
export function bridgeMid(routeId) {
  const p = bridgePoints(routeId)
  return p ? [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2 + 4] : [0, 0]
}

/* ---------------- trees: scattered automatically around everything else ---------------- */
const insideG = (g, x, y, k) => g.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < k)
const segDist = (px, py, [x1, y1], [x2, y2]) => {
  const dx = x2 - x1, dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy)
}

function scatterTrees(id, isl) {
  const r = rng(isl.seed * 13 + 5)
  const out = []
  const avoid = [
    ...isl.props.map((p) => (p.pts ? p.pts[0] : [p.x, p.y])),
    ...Object.values(isl.nav.nodes),
    ...(ISLANDS[id]?.plots || []),
  ]
  const big = isl.props.filter((p) => ['tower', 'clinic', 'greenhouse', 'solar', 'tank', 'house', 'stall', 'helipad'].includes(p.type))
  const segs = []
  for (const p of isl.paved || []) if (p.type === 'path') for (let i = 1; i < p.pts.length; i++) segs.push([p.pts[i - 1], p.pts[i]])
  for (const [a, b] of isl.nav.edges) segs.push([isl.nav.nodes[a], isl.nav.nodes[b]])
  let tries = 0
  while (out.length < (isl.treeCount || 10) && tries++ < 3000) {
    const g = isl.ground[Math.floor(r() * isl.ground.length)]
    const a = r() * Math.PI * 2, d = 0.45 + r() * 0.47
    const x = g[0] + Math.cos(a) * g[2] * d, y = g[1] + Math.sin(a) * g[3] * d
    if (!insideG(isl.ground, x, y, 0.8)) continue
    if (avoid.some(([ax, ay]) => Math.hypot(ax - x, (ay - y) * 1.6) < 22)) continue
    if (big.some((p) => Math.hypot(p.x - x, (p.y - y) * 1.7) < (p.type === 'tower' ? 60 : p.type === 'clinic' ? 52 : 34))) continue
    if (segs.some(([s1, s2]) => segDist(x, y, s1, s2) < 11)) continue
    if (isl.paved.some((p) => (p.type === 'ellipse' || p.type === 'tier' || p.type === 'crops' || p.type === 'deck') &&
      Math.hypot((x - p.x) / ((p.rx || p.a || 30) + 8), (y - p.y) / ((p.ry || (p.b || 20) / 2) + 6)) < 1)) continue
    if (out.some(([tx, ty]) => Math.hypot(tx - x, (ty - y) * 1.5) < 13)) continue
    out.push([x, y])
  }
  return out.map(([x, y], i) => ({ type: 'tree', x, y, kind: r() < (isl.pines ?? 0.5) ? 'pine' : 'round', s: 0.75 + r() * 0.45, tone: i % 3 }))
}

for (const [id, isl] of Object.entries(WORLD_ISLANDS)) {
  isl.id = id
  isl.props = [...isl.props, ...scatterTrees(id, isl)]
}

/* ---------------- distant island groups ---------------- */
// Uneven satellite clusters frame the town and leave the playable islands and bridge
// corridors clear. Width and haze express distance independently of the island theme.
// Atlas cells: stormfront, cloudroot, ancient ruins, skyport, voidreach, ruined shrine.
export const FAR_ISLETS = [
  // Small, hazier companions sit behind the larger landmarks.
  { x: -385, y: 70, width: 76, cell: 1, opacity: .26 },
  { x: 610, y: -245, width: 68, cell: 5, opacity: .25 },
  { x: 930, y: -205, width: 88, cell: 2, opacity: .32 },
  { x: 1485, y: -255, width: 72, cell: 0, opacity: .24 },
  { x: 1865, y: 105, width: 94, cell: 0, opacity: .30 },
  { x: 2095, y: 730, width: 78, cell: 3, opacity: .27 },
  { x: 2025, y: 1045, width: 72, cell: 4, opacity: .23 },
  { x: 355, y: 930, width: 96, cell: 5, opacity: .34 },
  { x: 825, y: 75, width: 82, cell: 5, opacity: .30 },
  // Larger silhouettes anchor the outer sky at different elevations.
  { x: -180, y: 205, width: 210, cell: 1, opacity: .54 },
  { x: 755, y: -100, width: 185, cell: 2, opacity: .50 },
  { x: 1645, y: -55, width: 215, cell: 0, opacity: .48 },
  { x: 1845, y: 555, width: 240, cell: 3, opacity: .60 },
  { x: 1760, y: 1120, width: 205, cell: 4, opacity: .44 },
  { x: 735, y: 1030, width: 195, cell: 1, opacity: .57 },
  { x: 105, y: 810, width: 150, cell: 3, opacity: .51 },
]
