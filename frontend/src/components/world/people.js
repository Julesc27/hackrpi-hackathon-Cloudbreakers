// Residents: little sky-folk who walk the painted paths of every island you can reach, cross
// your bridges, tend crops, sit on benches, gaze off the edge and stop to chat.
//
// Where they can walk comes from walkGrid.js, a grid traced from the painted art itself (paving is
// cheap to walk on, lawns cost more, everything else is blocked), so they stay on the paths you
// can see. Buildings you place block their footprint and people route around them.
import { WORLD_ISLANDS, BRIDGE_ENDS, bridgePoints } from './layout.js'
import { WALK, CELL } from './walkGrid.js'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { shiftIslandPoint } from '../../game/mapLayout.js'
import { STAIRWAYS, stairProjection } from './stairways.js'
import { buildingObstacle } from './buildingLayout.js'
import { drawTaskTool } from './taskAnimation.js'
import { rng, circle, ellipse, line, col, TAU } from './iso.js'

/* ---------------- bridges ---------------- */
/** Point on a bridge deck, t in [0, 1] from end a to end b. Includes the islands' bob. */
export function bridgeAt(routeId, t, type = 'rope') {
  const p = bridgePoints(routeId)
  if (!p) return null
  const length = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])
  const sag = type === 'reinforced' ? Math.min(6, Math.max(3, length * .012)) : Math.min(24, Math.max(10, length * .065))
  const ends = BRIDGE_ENDS[routeId]
  const bobA = WORLD_ISLANDS[ends.a[0]]._bob || 0
  const bobB = WORLD_ISLANDS[ends.b[0]]._bob || 0
  return [
    p.a[0] + (p.b[0] - p.a[0]) * t,
    p.a[1] + bobA + (p.b[1] + bobB - p.a[1] - bobA) * t + Math.sin(t * Math.PI) * sag,
  ]
}

export function bridgeCurve(routeId, n = 10, type = 'rope') {
  if (!bridgePoints(routeId)) return []
  const out = []
  for (let i = 0; i <= n; i++) out.push(bridgeAt(routeId, i / n, type))
  return out
}

/** The older node graph from layout.js nav data. Residents now walk walkGrid.js instead; this is
 * kept because the bridge-network test still checks the nav layout with it. */
export function buildGraph(state, access) {
  const nodes = new Map()
  const adj = new Map()
  const add = (k, x, y, island, tag) => { nodes.set(k, { k, x, y, island, tag }); adj.set(k, []) }
  const link = (a, b) => { if (nodes.has(a) && nodes.has(b)) { adj.get(a).push(b); adj.get(b).push(a) } }
  const easternRoutes = new Set(state.bridges.map(b => b.route).filter(r => r === 'hearth-haven' || r === 'prism-haven'))
  for (const [id, isl] of Object.entries(WORLD_ISLANDS)) {
    if (!access[id]) continue
    for (const [nid, [x, y, tag]] of Object.entries(isl.nav.nodes)) {
      if (id === 'newHaven') {
        if (nid.startsWith('east') && !easternRoutes.has('hearth-haven')) continue
        if (nid === 'crystalPath' && !easternRoutes.has('prism-haven')) continue
        if (nid === 'e_hearth' && !easternRoutes.has('hearth-haven')) continue
        if (nid === 'e_prism' && !easternRoutes.has('prism-haven')) continue
      }
      add(`${id}:${nid}`, x, y, id, tag)
    }
    for (const [a, b] of isl.nav.edges) link(`${id}:${a}`, `${id}:${b}`)
  }
  for (const b of state.bridges) {
    if (b.condition <= 0) continue
    const e = BRIDGE_ENDS[b.route]
    if (!e || !access[e.a[0]] || !access[e.b[0]]) continue
    const pts = bridgeCurve(b.route, 8, b.type)
    let prev = `${e.a[0]}:${e.a[1]}`
    for (let i = 1; i < pts.length - 1; i++) {
      const k = `br:${b.route}:${i}`
      add(k, pts[i][0], pts[i][1], 'bridge')
      link(prev, k); prev = k
    }
    link(prev, `${e.b[0]}:${e.b[1]}`)
  }
  return { nodes, adj }
}

/* ---------------- walk grids ---------------- */
const STEP = [0, 1, 2.4, 3.2] // cost per cell: blocked, paving, lawn, steps
const GRIDS = {}
for (const [id, g] of Object.entries(WALK)) {
  const base = new Uint8Array(g.cols * g.rows)
  for (let k = 0, i = 0; k < g.cells.length; k += 2) {
    const n = parseInt(g.cells[k + 1], 36)
    base.fill(+g.cells[k], i, i + n); i += n
  }
  const [x, y] = shiftIslandPoint(id, [g.x, g.y])
  // Explicit tread corridors bridge the grey/shadowed risers missed by tracing.
  // Keep the overrides confined to the actual painted stair widths.
  for (const stair of STAIRWAYS.filter(stair => stair.island === id)) {
    const radius = stair.halfWidth + .5
    const c0 = Math.max(0, Math.floor((Math.min(stair.from[0], stair.to[0])-radius-x)/CELL))
    const c1 = Math.min(g.cols-1, Math.ceil((Math.max(stair.from[0], stair.to[0])+radius-x)/CELL))
    const r0 = Math.max(0, Math.floor((Math.min(stair.from[1], stair.to[1])-radius-y)/CELL))
    const r1 = Math.min(g.rows-1, Math.ceil((Math.max(stair.from[1], stair.to[1])+radius-y)/CELL))
    for (let row = r0; row <= r1; row++) for (let column = c0; column <= c1; column++) {
      if (stairProjection(stair, [x+(column+.5)*CELL, y+(row+.5)*CELL]).distance <= radius) base[row*g.cols+column] = 3
    }
  }
  // The art tracer joins diagonal cells; pathfinding deliberately forbids corner
  // cutting. Add a single step at those contacts so traced paths stay connected.
  const traced = base.slice()
  for (let row = 0; row < g.rows - 1; row++) for (let column = 0; column < g.cols - 1; column++) {
    const a = row * g.cols + column, b = a + 1, c = a + g.cols, d = c + 1
    if (traced[a] && traced[d] && !traced[b] && !traced[c]) base[b] = 3
    if (traced[b] && traced[c] && !traced[a] && !traced[d]) base[a] = 3
  }
  // Apply the same island movement as the painting, resources and bridge landings.
  GRIDS[id] = { id, x, y, cols: g.cols, rows: g.rows, base, cost: base.slice(), poi: g.poi, paved: [] }
}
const cellOf = (G, x, y) => {
  const c = Math.floor((x - G.x) / CELL), r = Math.floor((y - G.y) / CELL)
  return c < 0 || r < 0 || c >= G.cols || r >= G.rows ? -1 : r * G.cols + c
}
const centre = (G, i) => [G.x + ((i % G.cols) + 0.5) * CELL, G.y + (Math.floor(i / G.cols) + 0.5) * CELL]
function nearestOpen(G, x, y, area = null) {
  const c0 = Math.floor((x - G.x) / CELL), r0 = Math.floor((y - G.y) / CELL)
  for (let rad = 0; rad < 24; rad++) {
    let best = -1, bd = Infinity
    for (let r = r0 - rad; r <= r0 + rad; r++) {
      for (let c = c0 - rad; c <= c0 + rad; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== rad) continue
        if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) continue
        const i = r * G.cols + c
        if (!G.cost[i] || (area && !area[i])) continue
        const d = (r - r0) ** 2 + (c - c0) ** 2
        if (d < bd) { bd = d; best = i }
      }
    }
    if (best >= 0) return best
  }
  return -1
}

function blockBuilding(G, b, clearance = 0) {
  if (!G || b.slot < 0 || BUILDINGS[b.type]?.infrastructure) return
  const plot = ISLANDS[b.island]?.plots?.[b.slot]
  if (!plot) return
  const { rx, ry } = buildingObstacle(b.type, b.island, b.slot, 1.5 + clearance)
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      const [cx, cy] = [G.x + (c + 0.5) * CELL, G.y + (r + 0.5) * CELL]
      // Block every cell touched by the base, including its thin corners.
      if (Math.max(0,Math.abs(cx-plot[0])-CELL/2)/rx + Math.max(0,Math.abs(cy-plot[1])-CELL/2)/ry < 1) G.cost[r * G.cols + c] = 0
    }
  }
}

// Keep construction and recovery on the island's connected walking network,
// rather than choosing a nearby open cell stranded behind a foundation.
function mainWalkableArea(G) {
  const seen = new Uint8Array(G.cost.length), queue = new Int32Array(G.cost.length)
  const route = Object.keys(BRIDGE_ENDS).find(id => BRIDGE_ENDS[id].a[0] === G.id)
  const exit = route ? bridgePoints(route).a : [635, 610]
  const start = nearestOpen(G, ...exit)
  if (start < 0) return seen
  let head = 0, tail = 1; queue[0] = start; seen[start] = 1
  while (head < tail) {
    const cur = queue[head++], c = cur % G.cols, r = Math.floor(cur / G.cols)
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nc = c+dc, nr = r+dr
      if ((!dc && !dr) || nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue
      const next = nr*G.cols+nc
      if (seen[next] || !G.cost[next]) continue
      if (dc && dr && (!G.cost[r*G.cols+nc] || !G.cost[nr*G.cols+c])) continue
      seen[next] = 1; queue[tail++] = next
    }
  }
  return seen
}

/** Mark the ground under player-built buildings as blocked. */
function applyBuildings(state) {
  for (const G of Object.values(GRIDS)) G.cost.set(G.base)
  for (const b of state.buildings) blockBuilding(GRIDS[b.island], b)
  for (const G of Object.values(GRIDS)) {
    G.egress = mainWalkableArea(G)
    G.paved = []
    for (let i = 0; i < G.cost.length; i++) if (G.cost[i] === 1 && G.egress[i]) G.paved.push(i)
    G.pois = G.poi.map(([c, r, tag]) => ({ i: nearestOpen(G, ...centre(G, r * G.cols + c), G.egress), tag })).filter((p) => p.i >= 0)
  }
}

/* A* over the 8-connected grid, then string-pulled into a few straight strides. */
const heap = { k: new Float32Array(4096), v: new Int32Array(4096), n: 0 }
function hpush(k, v) {
  if (heap.n >= heap.k.length) {
    const k2 = new Float32Array(heap.k.length * 2); k2.set(heap.k); heap.k = k2
    const v2 = new Int32Array(heap.v.length * 2); v2.set(heap.v); heap.v = v2
  }
  let i = heap.n++
  while (i > 0) { const p = (i - 1) >> 1; if (heap.k[p] <= k) break; heap.k[i] = heap.k[p]; heap.v[i] = heap.v[p]; i = p }
  heap.k[i] = k; heap.v[i] = v
}
function hpop() {
  const top = heap.v[0], k = heap.k[--heap.n], v = heap.v[heap.n]
  let i = 0
  for (;;) {
    let c = 2 * i + 1
    if (c >= heap.n) break
    if (c + 1 < heap.n && heap.k[c + 1] < heap.k[c]) c++
    if (heap.k[c] >= k) break
    heap.k[i] = heap.k[c]; heap.v[i] = heap.v[c]; i = c
  }
  heap.k[i] = k; heap.v[i] = v
  return top
}
let stampN = 0
function findPath(G, from, to) {
  if (from < 0 || to < 0) return null
  const N = G.cost.length
  if (!G.g || G.g.length !== N) {
    G.g = new Float64Array(N); G.came = new Int32Array(N)
    G.seen = new Uint32Array(N); G.closed = new Uint32Array(N)
  }
  const stamp = ++stampN, cols = G.cols
  const tc = to % cols, tr = (to / cols) | 0
  const h = (i) => { const dc = Math.abs((i % cols) - tc), dr = Math.abs(((i / cols) | 0) - tr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr) }
  heap.n = 0
  G.g[from] = 0; G.came[from] = -1; G.seen[from] = stamp
  hpush(h(from), from)
  let guard = 0
  while (heap.n && guard++ < 9000) {
    const cur = hpop()
    if (G.closed[cur] === stamp) continue
    G.closed[cur] = stamp
    if (cur === to) {
      const out = []
      for (let i = to; i >= 0; i = G.came[i]) out.push(i)
      return out.reverse()
    }
    const c = cur % cols, r = (cur / cols) | 0
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue
        const nc = c + dc, nr = r + dr
        if (nc < 0 || nr < 0 || nc >= cols || nr >= G.rows) continue
        const n = nr * cols + nc, w = G.cost[n]
        if (!w || G.closed[n] === stamp) continue
        if (dr && dc && (!G.cost[r * cols + nc] || !G.cost[nr * cols + c])) continue // no corner cutting
        const g = G.g[cur] + STEP[w] * (dr && dc ? 1.414 : 1)
        if (G.seen[n] === stamp && g >= G.g[n]) continue
        G.seen[n] = stamp; G.g[n] = g; G.came[n] = cur
        hpush(g + h(n), n)
      }
    }
  }
  return null
}
function clear(G, a, b, maxCost) {
  const [ax, ay] = a, [bx, by] = b
  let c = Math.floor((ax-G.x)/CELL), r = Math.floor((ay-G.y)/CELL)
  const tc = Math.floor((bx-G.x)/CELL), tr = Math.floor((by-G.y)/CELL)
  const open = (x,y) => x >= 0 && y >= 0 && x < G.cols && y < G.rows && G.cost[y*G.cols+x] > 0 && G.cost[y*G.cols+x] <= maxCost
  if (!open(c,r) || !open(tc,tr)) return false
  const dx = bx-ax, dy = by-ay, sx = Math.sign(dx), sy = Math.sign(dy)
  let tx = dx ? (G.x+(c+(sx>0?1:0))*CELL-ax)/dx : Infinity
  let ty = dy ? (G.y+(r+(sy>0?1:0))*CELL-ay)/dy : Infinity
  const dtx = dx ? CELL/Math.abs(dx) : Infinity, dty = dy ? CELL/Math.abs(dy) : Infinity
  // Traverse every crossed cell rather than sampling: even a very short corner
  // cut must respect both neighbours, just like the A* search does.
  while (c !== tc || r !== tr) {
    if (Math.abs(tx-ty) < 1e-10) {
      if (!open(c+sx,r) || !open(c,r+sy)) return false
      c += sx; r += sy; tx += dtx; ty += dty
    } else if (tx < ty) { c += sx; tx += dtx }
    else { r += sy; ty += dty }
    if (!open(c,r)) return false
  }
  return true
}
function smooth(G, cells) {
  const pts = cells.map((i) => centre(G, i))
  const out = [pts[0]]
  let i = 0
  while (i < pts.length - 1) {
    let j = i + 1, worst = G.cost[cells[i]]
    for (let k = i + 1; k < Math.min(pts.length, i + 30); k++) {
      worst = Math.max(worst, G.cost[cells[k]])
      if (clear(G, pts[i], pts[k], worst)) j = k
    }
    out.push(pts[j]); i = j
  }
  return out
}

/* ---------------- looks ---------------- */
// Palette taken from the painted art: navy and gold banners, cream stone, warm wood, leafy greens.
const SKIN = ['#f3cfac', '#e2b08a', '#c98f66', '#a06a48', '#7a4e34', '#f6dcc4']
const HAIR = ['#3b2a1e', '#6b4426', '#1f1a24', '#c99a5e', '#8a4a2a', '#e9e1d2', '#2b2440']
const NAVY = ['#2c4fb0', '#3e5bb0', '#2b3f8c']
const BRIGHT = ['#c0603e', '#3f8f9a', '#6a5ac8', '#5f9e4f', '#d39a3a', '#b8573a']
const ROLES = ['skywright', 'farmer', 'lamplighter', 'courier', 'villager', 'villager']
const OUTLINE = 'rgba(32,26,66,.55)'
const pick = (r, a) => a[Math.floor(r() * a.length)]

function makeLook(r) {
  const kid = r() < 0.15
  const role = kid ? 'kid' : pick(r, ROLES)
  const look = {
    kid, role, skin: pick(r, SKIN), hair: pick(r, HAIR), pants: pick(r, ['#3a3550', '#5b4636', '#2b3a66', '#6b5a44']),
    body: r() < 0.5 ? 'woman' : 'man',
  }
  look.hairStyle = look.body === 'woman' ? pick(r, ['long', 'ponytail', 'bun', 'curly', 'short']) : pick(r, ['short', 'short', 'curly', 'bald'])
  look.beard = look.body === 'man' && !kid && r() < 0.3 ? pick(r, ['stubble', 'beard']) : 'none'
  look.eyes = look.body === 'woman' && r() < 0.6 ? 'lashes' : pick(r, ['round', 'round', 'happy', 'wide', 'sleepy'])
  look.eyeColor = pick(r, ['#2a1f2e', '#2a1f2e', '#5a3a24', '#3a6fb8', '#3f7a4a'])
  switch (role) {
    case 'skywright': Object.assign(look, { shirt: pick(r, NAVY), trim: '#e3c27a', hat: 'aviator', carry: r() < 0.6 ? 'plank' : 'toolbag' }); break
    case 'farmer': Object.assign(look, { shirt: pick(r, ['#5f9e4f', '#d39a3a', '#b8573a']), apron: '#f3e6c6', hat: 'straw', carry: 'basket' }); break
    case 'lamplighter': Object.assign(look, { shirt: '#2b3f8c', coat: true, trim: '#e3c27a', hat: 'cap', carry: 'lantern' }); break
    case 'courier': Object.assign(look, { shirt: pick(r, ['#f3e6c6', '#3f8f9a', '#6a5ac8']), scarf: pick(r, ['#d9534f', '#e3a13a', '#c0603e']), hat: r() < 0.5 ? 'aviator' : null, carry: 'satchel' }); break
    case 'kid': Object.assign(look, { shirt: pick(r, BRIGHT), carry: r() < 0.55 ? 'kite' : r() < 0.5 ? 'pinwheel' : null, kite: pick(r, ['#d9534f', '#e3c27a', '#3f8f9a', '#6a5ac8']) }); break
    default: Object.assign(look, { shirt: pick(r, [...BRIGHT, ...NAVY]), cloak: r() < 0.45 ? pick(r, ['#2c4fb0', '#6a5ac8', '#3f8f9a', '#8f3f27']) : null, hat: r() < 0.25 ? 'hood' : null })
      if (look.body === 'woman' && !look.cloak && r() < 0.5) look.dress = true
  }
  return look
}

/* ---------------- the crowd ---------------- */
export class Crowd {
  constructor() {
    this.agents = []
    this.r = rng(99)
    this.nextId = 1
    this.islands = []
    this.links = {}
    this.bridgeTypes = {}
  }

  /** Rebuild walkable areas for the current game state and resize the crowd. */
  setState(state, access, target) {
    applyBuildings(state)
    this.islands = Object.keys(GRIDS).filter((id) => access[id] && state.connected.includes(id) && GRIDS[id].paved.length)
    this.links = {}
    this.bridgeTypes = {}
    for (const b of state.bridges) {
      const e = BRIDGE_ENDS[b.route]
      if (!e || b.condition <= 0 || !this.islands.includes(e.a[0]) || !this.islands.includes(e.b[0])) continue
      this.bridgeTypes[b.route] = b.type
      ;(this.links[e.a[0]] ||= []).push({ to: e.b[0], route: b.route, from: 0 })
      ;(this.links[e.b[0]] ||= []).push({ to: e.a[0], route: b.route, from: 1 })
    }
    // people standing somewhere that's gone (a new building, a broken bridge) are moved or replanned
    this.agents = this.agents.filter((a) => (a.isl ? this.islands.includes(a.isl) : this.links[a.leg?.toIsl]))
    for (const a of this.agents) {
      if (!a.isl) continue
      const G = GRIDS[a.isl], i = cellOf(G, a.x, a.y)
      if (i < 0 || !G.egress[i]) { const n = nearestOpen(G, a.x, a.y, G.egress); if (n >= 0) [a.x, a.y] = centre(G, n) }
      a.legs = []; a.leg = null; if (a.act === 'walk') a.act = 'idle'
    }
    if (!this.islands.length) { this.agents = []; return }
    while (this.agents.length < target) this.agents.push(this.spawn())
    if (this.agents.length > target) this.agents.length = target
  }

  spawn(at = null) {
    const r = this.r
    const isl = at || (this.islands.includes('newHaven') && r() < 0.5 ? 'newHaven' : pick(r, this.islands))
    const G = GRIDS[isl]
    const [x, y] = centre(G, pick(r, G.paved))
    const look = makeLook(r)
    return {
      id: this.nextId++, isl, x, y, legs: [], leg: null, wait: r() * 3, act: 'idle', ...look,
      speed: (look.kid ? 15 : 9.5) + r() * 4, phase: r() * TAU, dir: r() < 0.5 ? -1 : 1, back: false,
    }
  }

  /** Choose somewhere to go and plan the walk there, crossing bridges if needed. */
  plan(a) {
    const r = this.r
    let isl = a.isl, x = a.x, y = a.y
    const legs = []
    // one in four walks head to a neighbouring island
    if (r() < 0.25 && this.links[isl]?.length) {
      const hops = r() < 0.6 ? 1 : 2
      for (let h = 0; h < hops; h++) {
        const opts = (this.links[isl] || []).filter((l) => !legs.some((g) => g.route === l.route))
        if (!opts.length) break
        const l = pick(r, opts)
        const p = bridgePoints(l.route)
        const end = l.from === 0 ? p.a : p.b
        const walk = this.gridLeg(isl, x, y, end[0], end[1])
        if (!walk) break
        legs.push(walk, { route: l.route, from: l.from, toIsl: l.to, u: 0 })
        isl = l.to
        const far = l.from === 0 ? p.b : p.a
        x = far[0]; y = far[1]
        legs.push({ isl, pts: [[x, y]], i: 0, entry: true })
      }
    }
    const G = GRIDS[isl]
    let dest, tag = null
    if (r() < 0.4 && G.pois.length) {
      const p = pick(r, G.pois); tag = p.tag
      dest = centre(G, p.i); dest = [dest[0] + (r() - 0.5) * 4, dest[1] + (r() - 0.5) * 2]
    } else dest = centre(G, pick(r, G.paved))
    const walk = this.gridLeg(isl, x, y, dest[0], dest[1])
    if (walk) { walk.tag = tag; legs.push(walk) }
    a.legs = legs.filter((l) => !l.pts || l.pts.length)
  }

  gridLeg(isl, x, y, tx, ty) {
    const G = GRIDS[isl]
    const path = findPath(G, nearestOpen(G, x, y), nearestOpen(G, tx, ty))
    if (!path) return null
    const pts = smooth(G, path)
    // walk a little to one side of the path's centre, so people don't all tread the same line
    const off = (this.r() - 0.5) * 5
    for (let k = 1; k < pts.length - 1; k++) {
      const [px, py] = pts[k], q = [px + off, py + off * 0.5]
      if (clear(G, pts[k-1], q, 3) && clear(G, q, pts[k+1], 3)) pts[k] = q
    }
    if (clear(G, pts[pts.length-1], [tx,ty], 3)) pts.push([tx, ty])
    return { isl, pts, i: 0 }
  }

  reroute(a) {
    const point = this.recoveryPoint(a.isl, a.x, a.y)
    if (point) [a.x,a.y] = point
    a.leg = null; a.legs = []; a.act = 'idle'; a.wait = 0
    this.plan(a)
  }

  walkPoint(island, x, y) {
    const grid = GRIDS[island]
    if (!grid) return null
    const cell = nearestOpen(grid, x, y)
    return cell < 0 ? null : centre(grid, cell)
  }

  constructionPoint(type, island, slot) {
    const grid = GRIDS[island], plot = ISLANDS[island]?.plots?.[slot]
    if (!grid || !plot) return null
    const preview = { ...grid, cost: grid.cost.slice() }
    // Stand beside the completed foundation, with room for the captain's feet.
    blockBuilding(preview, { type, island, slot }, 3)
    const cell = nearestOpen(preview, ...plot, mainWalkableArea(preview))
    return cell < 0 ? null : centre(preview, cell)
  }

  recoveryPoint(island, x, y) {
    const grid = GRIDS[island]
    if (!grid) return null
    const cell = cellOf(grid, x, y)
    if (cell >= 0 && grid.egress[cell]) return [x, y]
    const safe = nearestOpen(grid, x, y, grid.egress)
    return safe < 0 ? null : centre(grid, safe)
  }

  canStep(island, from, to) {
    const grid = GRIDS[island]
    return Boolean(grid && clear(grid, from, to, 3) && grid.cost[cellOf(grid, ...to)])
  }

  stairStep(island, from, input, distance) {
    let nearest = null
    for (const stair of STAIRWAYS) {
      if (stair.island !== island) continue
      const projection = stairProjection(stair, from)
      if (projection.distance > stair.halfWidth) continue
      const alignment = input[0]*projection.direction[0] + input[1]*projection.direction[1]
      // Reconnect from either landing when heading back onto the stairs, but
      // release guidance when walking away onto the terrace.
      if ((projection.t < 0 && alignment < 0) || (projection.t > 1 && alignment > 0)) continue
      if (Math.abs(alignment) < .55 || (nearest && projection.distance >= nearest.distance)) continue
      nearest = { ...projection, sign: Math.sign(alignment) }
    }
    if (!nearest) return null
    const to = from.map((value, axis) => value + nearest.direction[axis]*nearest.sign*distance)
    return this.canStep(island, from, to) ? to : null
  }

  update(dt) {
    const r = this.r
    dt = Math.min(dt, 0.1)
    for (const a of this.agents) {
      if (a.wait > 0) {
        a.wait -= dt
        a.phase += dt * (a.act === 'tend' ? 3 : a.act === 'chat' ? 4 : 0.6)
        if (a.wait <= 0) { a.act = 'idle'; a.back = false }
        continue
      }
      if (!a.leg) {
        a.leg = a.legs.shift() || null
        if (!a.leg) {
          const roll = r()
          if (roll < 0.35) {
            const buddy = this.agents.find((b) => b !== a && b.isl === a.isl && !b.leg && b.wait <= 0.2 && Math.hypot(b.x - a.x, b.y - a.y) < 22)
            if (buddy) {
              a.act = buddy.act = 'chat'; a.wait = buddy.wait = 2.5 + r() * 4
              a.dir = buddy.x > a.x ? 1 : -1; buddy.dir = -a.dir; a.back = buddy.back = false
              continue
            }
          }
          this.plan(a)
          if (!a.legs.length) { a.act = 'idle'; a.wait = 1 + r() * 2 }
          continue
        }
        if (a.leg.isl) a.isl = a.leg.isl
      }
      const leg = a.leg
      a.act = 'walk'
      let step = a.speed * dt
      if (leg.route) {
        // crossing a bridge: travel along the live deck curve (it bobs with the islands)
        const p = bridgePoints(leg.route)
        const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) || 1
        a.isl = null
        leg.u = Math.min(1, leg.u + step / len)
        const [x, y] = bridgeAt(leg.route, leg.from === 0 ? leg.u : 1 - leg.u, this.bridgeTypes[leg.route])
        if (Math.abs(x - a.x) > 0.05) a.dir = x > a.x ? 1 : -1
        a.back = y < a.y - Math.abs(x - a.x) * 0.3
        a.x = x; a.y = y
        a.phase += step * 0.6
        if (leg.u >= 1) {
          const far = leg.from === 0 ? p.b : p.a
          a.isl = leg.toIsl; a.x = far[0]; a.y = far[1]; a.leg = null
        }
        continue
      }
      while (step > 0 && leg.i < leg.pts.length) {
        const [tx, ty] = leg.pts[leg.i]
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy)
        const next = d <= step ? [tx,ty] : [a.x+(dx/d)*step,a.y+(dy/d)*step]
        if (!this.canStep(a.isl, [a.x,a.y], next)) { this.reroute(a); break }
        if (d <= step) { a.x = tx; a.y = ty; step -= d; leg.i++; continue }
        a.x += (dx / d) * step; a.y += (dy / d) * step
        if (Math.abs(dx) > 0.15) a.dir = dx > 0 ? 1 : -1
        a.back = dy < -Math.abs(dx) * 0.35
        a.phase += step * 0.6
        step = 0
      }
      if (leg.i >= leg.pts.length) {
        a.leg = null
        if (!a.legs.length) {
          // arrived: do whatever this spot is for
          const tag = leg.tag
          if (tag === 'sit') { a.act = 'sit'; a.wait = 5 + r() * 7 }
          else if (tag === 'tend') { a.act = 'tend'; a.wait = 4 + r() * 6 }
          else if (tag === 'look') { a.act = 'look'; a.wait = 2.5 + r() * 4; a.back = true }
          else { a.act = 'idle'; a.wait = 0.6 + r() * 2.4 }
        }
      }
    }
  }

  /** Draw-list entries: islanders bob with their island; people on a bridge already include it. */
  items() {
    return this.agents.map((a) => {
      const bob = a.isl ? WORLD_ISLANDS[a.isl]?._bob || 0 : 0
      return { y: a.y + bob, person: a, bob }
    })
  }
}

/* ---------------- drawing ---------------- */
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)))
  return `#${((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')}`
}

/** A tiny figure for when the camera is far out: just a coloured body and a head. */
function drawPersonFar(ctx, a) {
  const s = a.kid ? 0.88 : 1.18
  const hop = a.act === 'walk' ? Math.abs(Math.cos(a.phase)) * 0.6 : 0
  const x = a.x, y = a.y - hop * s
  ellipse(ctx, a.x, a.y + 0.3, 3.2 * s, 1.2 * s, 'rgba(18,24,60,.3)')
  ctx.fillStyle = col(a.pants); ctx.fillRect(x - 1.5 * s, y - 4.8 * s, 3 * s, 4.6 * s)
  ctx.beginPath(); ctx.ellipse(x, y - 7.2 * s, 2.5 * s, 3.2 * s, 0, 0, TAU)
  ctx.fillStyle = col(a.cloak || a.shirt); ctx.fill()
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.5 * s; ctx.stroke()
  circle(ctx, x, y - 11.8 * s, 2.1 * s, col(a.skin))
  const top = a.hat === 'straw' ? '#e8c77a' : a.hat === 'cap' || a.hat === 'captain' ? '#1f2d6a' : a.hat === 'aviator' ? '#7a4b2a' : a.hat === 'hood' ? a.cloak || '#6a5ac8' : a.hairStyle === 'bald' ? a.skin : a.hair
  ctx.beginPath(); ctx.arc(x, y - 12.1 * s, 2.2 * s, Math.PI, TAU); ctx.fillStyle = col(top); ctx.fill()
}

/* Eyes, in the three-quarter view every figure uses: the near eye at x≈1.45, the far one at x≈0.5.
 * Styles: round (default), lashes, happy (smiling arcs), wide (big and bright), sleepy (half-closed). */
const EYES = [[0.5, 0.12, 0.26], [1.45, 0.08, 0.25]]
function drawEyes(ctx, a, hy) {
  const ink = '#2a1f2e', iris = a.eyeColor || ink, style = a.eyes || 'round'
  const man = a.body === 'man', woman = a.body === 'woman'
  const browCol = col(shade(a.hair || '#3b2a1e', 0.75))
  for (const [i, [ex, dy, base]] of EYES.entries()) {
    const ey = hy + dy
    const r0 = base * (man ? 0.82 : woman ? 1.08 : 1)
    // brows: thick and straight for men, thin and arched for women
    if (man) line(ctx, ex - 0.36, ey - 0.6 - (i ? 0.02 : 0.06), ex + 0.36, ey - 0.62, browCol, 0.26, 'round')
    else if (woman) { ctx.beginPath(); ctx.arc(ex, ey + 0.08, 0.5, Math.PI * 1.25, Math.PI * 1.75); ctx.strokeStyle = browCol; ctx.lineWidth = 0.11; ctx.lineCap = 'round'; ctx.stroke() }
    if (style === 'happy') {
      ctx.beginPath(); ctx.arc(ex, ey + 0.12, r0 * 1.15, Math.PI * 1.1, Math.PI * 1.9)
      ctx.strokeStyle = ink; ctx.lineWidth = 0.2; ctx.lineCap = 'round'; ctx.stroke()
      continue
    }
    const r = style === 'wide' ? r0 * 1.45 : r0
    if (style === 'wide') circle(ctx, ex, ey, r + 0.08, '#ffffff')
    if (man) {
      // a little narrower: an oval rather than a round dot
      ctx.beginPath(); ctx.ellipse(ex, ey, r, r * 0.8, 0, 0, TAU); ctx.fillStyle = iris; ctx.fill()
      if (iris !== ink) { ctx.beginPath(); ctx.ellipse(ex + 0.03, ey + 0.02, r * 0.5, r * 0.42, 0, 0, TAU); ctx.fillStyle = ink; ctx.fill() }
      circle(ctx, ex + r * 0.35, ey - r * 0.3, r * 0.24, 'rgba(255,255,255,.9)')
    } else {
      circle(ctx, ex, ey, r, iris)
      if (iris !== ink) circle(ctx, ex + 0.03, ey + 0.02, r * 0.5, ink)
      circle(ctx, ex + r * 0.35, ey - r * 0.4, r * 0.32, 'rgba(255,255,255,.95)')
    }
    if (style === 'sleepy') {
      // a heavy upper lid over the top half
      ctx.beginPath(); ctx.arc(ex, ey, r + 0.06, Math.PI, Math.PI * 2); ctx.closePath()
      ctx.fillStyle = col(a.skin); ctx.fill()
      line(ctx, ex - r - 0.05, ey, ex + r + 0.05, ey, ink, 0.18)
    }
    if (style === 'lashes') {
      // two short lashes flicking out from each eye's outer corner
      const out = i === 1 ? 1 : -1
      ctx.strokeStyle = ink; ctx.lineWidth = 0.16; ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(ex, ey, r + 0.03, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(ex + out * r * 0.85, ey - r * 0.55); ctx.lineTo(ex + out * (r + 0.24), ey - r * 0.95); ctx.lineWidth = 0.13; ctx.stroke()
    }
  }
}

function drawFacialHair(ctx, a, hy) {
  if (!a.beard || a.beard === 'none') return
  const stubble = a.beard === 'stubble'
  ctx.save()
  // Stubble stays on the face; a full beard rounds off just below the chin.
  if (stubble) { ctx.beginPath(); ctx.arc(0, hy, 1.99, 0, TAU); ctx.clip() }
  ctx.beginPath()
  ctx.moveTo(-1.98, hy + 0.05)
  ctx.quadraticCurveTo(-1.75, hy + 0.4, -1.5, hy + 0.65)
  ctx.quadraticCurveTo(-0.65, hy + 1.02, 0.15, hy + 1.04)
  // A small opening follows the mouth on the three-quarter face.
  ctx.quadraticCurveTo(0.45, hy + 1.22, 0.95, hy + 1.25)
  ctx.quadraticCurveTo(1.6, hy + 1.08, 1.98, hy + 0.18)
  ctx.quadraticCurveTo(2.08, hy + 1.35, 1.2, hy + 2.0)
  ctx.quadraticCurveTo(0.4, hy + (stubble ? 2.2 : 2.7), -0.65, hy + 2.08)
  ctx.quadraticCurveTo(-2.08, hy + 1.68, -1.98, hy + 0.05)
  ctx.closePath()
  ctx.fillStyle = col(a.hair, stubble ? 0.28 : 1); ctx.fill()
  if (stubble) {
    for (const [x,y] of [[-1.5,1.02],[-1.1,1.3],[-0.65,1.53],[-0.15,1.68],[0.4,1.72],[0.95,1.62],[1.45,1.2]]) {
      line(ctx,x,hy+y,x+0.05,hy+y+0.12,col(a.hair,0.48),0.09)
    }
  } else {
    ctx.strokeStyle = col(shade(a.hair,0.75),0.7); ctx.lineWidth = 0.13; ctx.stroke()
    for (const [x,y] of [[-1.0,1.35],[-0.45,1.65],[0.15,1.8],[0.75,1.75],[1.35,1.3]]) {
      line(ctx,x,hy+y,x+0.08,hy+y+0.33,col(shade(a.hair,1.3),0.4),0.11)
    }
  }
  ctx.restore()
}

/** Draw one resident with their feet at (a.x, a.y). `detail` false draws the far-zoom figure. */
export function drawPerson(ctx, a, t, detail = true, motion = true) {
  if (!detail) { drawPersonFar(ctx, a); return }
  const s = a.kid ? 0.88 : 1.18
  const walking = a.act === 'walk'
  const swing = walking ? Math.sin(a.phase) : 0
  const bob = walking ? Math.abs(Math.cos(a.phase)) * 0.6 : 0
  const working = a.act === 'work' && a.task
  const sit = a.act === 'sit', tend = a.act === 'tend' || (working && ['garden', 'harvest', 'collect', 'deposit'].includes(a.task.kind))
  const wind = Math.sin(t * 2.3 + a.id) * 0.5 + (walking ? 1 : 0.3)
  ctx.save()
  ctx.translate(a.x, a.y)
  // shadow stays on the ground, unflipped
  ellipse(ctx, 0, 0.3, 3.4 * s, 1.3 * s, 'rgba(18,24,60,.3)')
  ctx.scale(s * a.dir, s)
  ctx.lineJoin = 'round'
  const hip = sit ? -3.4 : -4.8 - bob
  const top = hip - 5.8

  // kite on a string, flying up and behind
  if (a.carry === 'kite' && !sit) {
    const kx = -11 - Math.sin(t * 1.1 + a.id) * 2, ky = top - 13 + Math.sin(t * 1.7 + a.id) * 1.6
    line(ctx, 1.8, top + 3, kx, ky + 3, 'rgba(255,255,255,.55)', 0.25)
    ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + 2.4, ky + 2.6); ctx.lineTo(kx, ky + 6); ctx.lineTo(kx - 2.4, ky + 2.6); ctx.closePath()
    ctx.fillStyle = col(a.kite); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.35; ctx.stroke()
    line(ctx, kx, ky, kx, ky + 6, col('#fff6d6', 0.7), 0.3)
    ctx.beginPath(); ctx.moveTo(kx, ky + 6)
    for (let k = 1; k <= 4; k++) ctx.lineTo(kx + Math.sin(t * 4 + k + a.id) * 1.1, ky + 6 + k * 1.5)
    ctx.strokeStyle = col('#fff1c4', 0.8); ctx.lineWidth = 0.35; ctx.stroke()
  }

  // cloak / long coat, swept back by the wind
  if (a.cloak || a.coat) {
    const c = a.cloak || a.shirt
    const hem = hip + (a.cloak ? 3.0 : 1.7) - (sit ? 1 : 0)
    const flare = a.cloak ? 3.8 : 2.75
    ctx.beginPath()
    ctx.moveTo(-1.6, top + 0.6)
    ctx.quadraticCurveTo(-3.3 - wind * 0.5, hip, -flare - wind * 0.6, hem)
    ctx.quadraticCurveTo(-1.2, hem + 0.2, 1.4, hem - 0.4)
    ctx.lineTo(1.8, top + 0.8)
    ctx.closePath()
    ctx.fillStyle = col(shade(c, 0.78)); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.stroke()
  }

  // legs and boots
  const boot = col('#4a3226')
  if (sit) {
    line(ctx, -0.8, hip, 2, hip + 0.3, col(a.pants), 1.6)
    line(ctx, 2, hip + 0.3, 2.3, 0, col(a.pants), 1.4)
    line(ctx, 0.7, hip, 3.1, hip + 0.4, col(a.pants), 1.6)
    ellipse(ctx, 2.7, -0.1, 1, 0.5, boot)
  } else if (tend) {
    line(ctx, -0.6, hip, -1.6, -1.2, col(a.pants), 1.6); line(ctx, -1.6, -1.2, -0.4, 0, col(a.pants), 1.4)
    line(ctx, 0.8, hip, 2.4, -1.4, col(a.pants), 1.6); line(ctx, 2.4, -1.4, 2.2, 0, col(a.pants), 1.4)
  } else {
    // Leave a clear gap between the two trouser legs; overlapping thick strokes
    // and a floor-length coat tail used to read as a third leg in the portrait.
    const l1 = -0.95 - swing * 0.8, l2 = 0.95 + swing * 0.8
    const lift1 = Math.max(0, swing) * 0.45, lift2 = Math.max(0, -swing) * 0.45
    line(ctx, -0.95, hip, l1, -0.4 - lift1, col(shade(a.pants, 0.9)), 1.25)
    line(ctx, 0.95, hip, l2, -0.4 - lift2, col(a.pants), 1.25)
    ellipse(ctx, l1 + 0.18, -0.3 - lift1, 0.78, 0.42, boot)
    ellipse(ctx, l2 + 0.18, -0.3 - lift2, 0.78, 0.42, boot)
  }

  // a dress, flaring a little as they walk
  if (a.dress) {
    const fl = walking ? Math.abs(swing) * 0.5 : 0
    ctx.beginPath()
    if (sit) { ctx.moveTo(-2.1, hip - 0.4); ctx.lineTo(3.4, hip + 0.2); ctx.lineTo(3.5, hip + 1.5); ctx.lineTo(-2.3, hip + 1.3) }
    else { ctx.moveTo(-2.1, hip - 0.6); ctx.lineTo(2.1, hip - 0.6); ctx.lineTo(3 + fl, -1.7); ctx.quadraticCurveTo(0, -1.1, -3 - fl, -1.7) }
    ctx.closePath()
    ctx.fillStyle = col(shade(a.shirt, 0.9)); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.4; ctx.stroke()
  }

  // torso (leans in while tending crops)
  ctx.save()
  if (tend || working) {
    const effort = working ? motion ? Math.sin(a.task.elapsed*10)*.09 : 0 : Math.sin(a.phase)*.1
    ctx.translate(0, hip); ctx.rotate((tend ? .45 : .08) + effort); ctx.translate(0, -hip)
  }
  const body = new Path2D()
  if (a.body === 'woman') {
    // narrow, rounded shoulders, a pinched waist and a hem that flares over the hips
    body.moveTo(-2.55, hip + 0.7); body.quadraticCurveTo(-1.0, hip - 1.6, -1.65, top + 1.3)
    body.quadraticCurveTo(0, top - 0.7, 1.65, top + 1.3); body.quadraticCurveTo(1.0, hip - 1.6, 2.55, hip + 0.7)
    body.quadraticCurveTo(0, hip + 1.5, -2.55, hip + 0.7)
  } else if (a.body === 'man') {
    // broad, square shoulders and a straight cut
    body.moveTo(-2.3, hip + 0.6); body.lineTo(-2.6, top + 1.5); body.quadraticCurveTo(-2.55, top + 0.4, -1.6, top + 0.25)
    body.lineTo(1.6, top + 0.25); body.quadraticCurveTo(2.55, top + 0.4, 2.6, top + 1.5); body.lineTo(2.3, hip + 0.6)
    body.quadraticCurveTo(0, hip + 1.2, -2.3, hip + 0.6)
  } else {
    body.moveTo(-2.4, hip + 0.6); body.lineTo(-2.1, top + 1.2)
    body.quadraticCurveTo(0, top - 0.9, 2.1, top + 1.2); body.lineTo(2.4, hip + 0.6)
    body.quadraticCurveTo(0, hip + 1.4, -2.4, hip + 0.6)
  }
  ctx.fillStyle = col(a.shirt); ctx.fill(body)
  // soft shading on the side away from the light, then the painted outline
  ctx.save(); ctx.clip(body)
  ctx.fillStyle = col(shade(a.shirt, 0.72)); ctx.fillRect(0.7, top - 1, 3, hip - top + 3)
  ctx.fillStyle = col('#ffffff', 0.18); ctx.fillRect(-2.4, top - 1, 1, hip - top + 3)
  if (a.apron) { ctx.fillStyle = col(a.apron); ctx.fillRect(-1.6, top + 2.6, 3.2, hip - top - 1.2) }
  if (a.trim) { ctx.fillStyle = col(a.trim); ctx.fillRect(-2.5, hip - 1.4, 5, 0.75) }
  if (a.coat) { circle(ctx, 0.2, top + 2.6, 0.32, col(a.trim)); circle(ctx, 0.2, top + 4.2, 0.32, col(a.trim)) }
  ctx.restore()
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.42; ctx.stroke(body)

  // satchel strap and bag
  if (a.carry === 'satchel') {
    line(ctx, 1.8, top + 0.8, -1.6, hip - 0.4, col('#7a4b2a'), 0.55)
    ctx.fillStyle = col('#a8743f'); ctx.fillRect(-2.9, hip - 1.6, 2.4, 2)
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.strokeRect(-2.9, hip - 1.6, 2.4, 2)
  }
  if (a.carry === 'toolbag' && !working) {
    ctx.fillStyle = col('#6b4426'); ctx.fillRect(1.6, hip - 1.2, 2.2, 1.7)
    line(ctx, 2.2, hip - 1.3, 2.2, hip - 2.6, col('#cbd0dc'), 0.45)
  }

  // arms
  const armSwing = walking ? -swing * 1.6 : a.act === 'chat' ? Math.sin(a.phase * 1.3) * 1.4 : 0
  // arms hang from the shoulders: wider and a touch thicker on the man, narrower on the woman
  const armX = a.body === 'man' ? 2.0 : a.body === 'woman' ? 1.5 : 1.7, armW = a.body === 'man' ? 1.4 : a.body === 'woman' ? 1.1 : 1.2
  const sleeve = col(a.coat ? a.shirt : shade(a.shirt, 0.92))
  const hand = col(a.skin)
  if (working) {
    drawTaskTool(ctx, a.task, top, hip, sleeve, hand, motion)
  } else if (walking && a.carry === 'plank') {
    // a plank for the bridges, on the shoulder
    ctx.save(); ctx.translate(0, top + 0.6); ctx.rotate(-0.18)
    ctx.fillStyle = col('#c99a5e'); ctx.fillRect(-6, -1.4, 12, 1.4)
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.strokeRect(-6, -1.4, 12, 1.4)
    ctx.restore()
    line(ctx, 1.6, top + 1.6, 2.6, top + 0.2, sleeve, 1.2); circle(ctx, 2.7, top, 0.55, hand)
  } else if (walking && a.carry === 'basket') {
    line(ctx, 1.6, top + 1.6, 3.2, top + 3.6, sleeve, 1.2)
    ellipse(ctx, 3.9, top + 3.9, 2.2, 1.3, col('#c99a5e'), OUTLINE, 0.3)
    circle(ctx, 3.3, top + 3, 0.85, col('#d9534f')); circle(ctx, 4.5, top + 3.1, 0.85, col('#86cf6a')); circle(ctx, 3.9, top + 2.6, 0.75, col('#e3a13a'))
  } else if (a.carry === 'lantern' && !sit) {
    // a lamplighter's pole with a hanging lantern
    line(ctx, 1.6, top + 1.6, 3, hip - 1.2, sleeve, 1.2)
    line(ctx, 3, hip - 0.2, 4.4, top - 6, col('#6b4426'), 0.55)
    line(ctx, 4.4, top - 6, 5.8, top - 6.2, col('#6b4426'), 0.45)
    line(ctx, 5.8, top - 6.2, 5.8, top - 5, col('#3a3550'), 0.25)
    ctx.fillStyle = col('#ffe08a'); ctx.fillRect(5, top - 5, 1.6, 2.2)
    ctx.strokeStyle = col('#a8792a'); ctx.lineWidth = 0.3; ctx.strokeRect(5, top - 5, 1.6, 2.2)
  } else if (a.carry === 'pinwheel' && !sit) {
    line(ctx, 1.6, top + 1.6, 3, top + 0.4, sleeve, 1.1)
    line(ctx, 3, top + 0.6, 3.2, top - 3.4, col('#e9e1d2'), 0.35)
    for (let k = 0; k < 4; k++) {
      const ang = t * 6 + (k * TAU) / 4
      ctx.beginPath(); ctx.moveTo(3.2, top - 3.4)
      ctx.lineTo(3.2 + Math.cos(ang) * 1.8, top - 3.4 + Math.sin(ang) * 1.8)
      ctx.lineTo(3.2 + Math.cos(ang + 0.7) * 1.1, top - 3.4 + Math.sin(ang + 0.7) * 1.1)
      ctx.fillStyle = col(['#d9534f', '#e3c27a', '#3f8f9a', '#6a5ac8'][k]); ctx.fill()
    }
  } else if (tend && a.role === 'farmer') {
    // watering can with a little shower
    line(ctx, 1.6, top + 1.6, 3.4, top + 3.2, sleeve, 1.2)
    ctx.fillStyle = col('#7fa2c4'); ctx.fillRect(3, top + 3, 2.4, 1.8)
    line(ctx, 5.3, top + 3.4, 6.8, top + 2.6, col('#7fa2c4'), 0.5)
    for (let k = 0; k < 3; k++) {
      const ph = (t * 2 + k / 3) % 1
      circle(ctx, 7 + k * 0.5, top + 3 + ph * 5, 0.28, col('#bfe6ff', 1 - ph))
    }
  } else {
    const wave = a.act === 'chat' ? -1.6 : 0
    line(ctx, armX, top + 1.6, armX + 0.6 + armSwing * 0.6, hip - 0.4 + wave, sleeve, armW)
    circle(ctx, armX + 0.6 + armSwing * 0.6, hip - 0.1 + wave, 0.55, hand)
  }
  line(ctx, -armX, top + 1.6, -armX - 0.6 - armSwing * 0.6, hip - 0.4, col(shade(a.shirt, 0.75)), armW)
  circle(ctx, -armX - 0.6 - armSwing * 0.6, hip - 0.1, 0.55, hand)

  // scarf tails streaming behind
  if (a.scarf) {
    ctx.fillStyle = col(a.scarf)
    ctx.fillRect(-1.8, top + 0.2, 3.6, 1)
    ctx.beginPath(); ctx.moveTo(-1.4, top + 0.5)
    ctx.quadraticCurveTo(-3.5 - wind, top + 0.2 + Math.sin(t * 6 + a.id) * 0.6, -5.2 - wind * 1.4, top + 1.4 + Math.sin(t * 7 + a.id) * 0.8)
    ctx.lineTo(-4.6 - wind * 1.2, top + 2.2); ctx.quadraticCurveTo(-3, top + 1.4, -1.2, top + 1.3); ctx.closePath()
    ctx.fill()
  }

  // head
  const hy = top - 2.1
  const style = a.hairStyle || 'short'
  const hairCol = col(a.hair)
  const sway = Math.sin(a.phase * (walking ? 1 : 0.3)) * 0.35
  // hair that hangs behind the head goes first
  ctx.fillStyle = hairCol
  if (style === 'long') { ctx.beginPath(); ctx.ellipse(a.back ? 0 : -1.2, hy + 1.5, a.back ? 2.1 : 1.5, 2.6, a.back ? 0 : 0.15, 0, TAU); ctx.fill() }
  else if (style === 'ponytail') { ctx.beginPath(); ctx.ellipse(a.back ? sway : -2.4 + sway, hy + (a.back ? 1.6 : 0.9), 0.8, 1.9, a.back ? 0 : 0.35, 0, TAU); ctx.fill() }
  if (a.hat === 'hood') {
    ctx.beginPath(); ctx.ellipse(a.back ? 0 : -0.5, hy + 0.2, 2.75, 2.85, 0, 0, TAU)
    ctx.fillStyle = col(a.cloak || '#6a5ac8'); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.stroke()
  }
  circle(ctx, 0, hy, 2.05, col(a.skin))
  ctx.beginPath(); ctx.arc(0, hy, 2.05, 0, TAU); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.38; ctx.stroke()
  // hair on top
  ctx.fillStyle = hairCol
  if (style !== 'bald') {
    ctx.beginPath()
    if (a.back) ctx.arc(0, hy, 2.15, 0, TAU)
    else { ctx.arc(0, hy - 0.15, 2.15, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(0.2, hy - 1.2, -2.1, hy + 0.1) }
    ctx.fill()
    if (style === 'curly') for (let k = 0; k <= 4; k++) { const an = Math.PI * (1.05 + k * 0.22); circle(ctx, Math.cos(an) * 2.05, hy - 0.1 + Math.sin(an) * 2.05, 0.78, hairCol) }
    if (style === 'bun') circle(ctx, a.back ? 0 : -1.1, hy - 1.9, 1.05, hairCol)
  } else if (!a.back) {
    circle(ctx, -0.6, hy - 1.1, 0.5, col('#ffffff', 0.22)) // a little shine
  }
  if (!a.back) {
    drawFacialHair(ctx, a, hy)
    // a face: two eyes (see drawEyes), a rosy cheek and a small smile
    drawEyes(ctx, a, hy)
    if (a.body !== 'man') {
      ctx.save(); ctx.beginPath(); ctx.arc(0, hy, 1.95, 0, TAU); ctx.clip()
      ctx.beginPath(); ctx.ellipse(1.45, hy + 0.62, 0.42, 0.22, 0, 0, TAU); ctx.fillStyle = 'rgba(236,128,128,.32)'; ctx.fill()
      ctx.beginPath(); ctx.ellipse(0.3, hy + 0.66, 0.32, 0.18, 0, 0, TAU); ctx.fillStyle = 'rgba(236,128,128,.22)'; ctx.fill()
      ctx.restore()
    }
    ctx.beginPath(); ctx.arc(0.95, hy + 0.82, a.body === 'woman' ? 0.36 : 0.3, Math.PI * 0.2, Math.PI * 0.8)
    ctx.strokeStyle = a.body === 'woman' ? '#b8505e' : 'rgba(80,40,36,.8)'; ctx.lineWidth = a.body === 'woman' ? 0.24 : 0.17; ctx.lineCap = 'round'; ctx.stroke()
  }
  // hats
  if (a.hat === 'aviator') {
    ctx.beginPath(); ctx.arc(0, hy - 0.2, 2.25, Math.PI, TAU); ctx.lineTo(2.25, hy - 0.45); ctx.lineTo(-0.4, hy - 0.2); ctx.lineTo(-2.2, hy + 0.9); ctx.closePath() // leaves the eyes clear
    ctx.fillStyle = col('#7a4b2a'); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.stroke()
    if (!a.back) { // brass goggles pushed up on the forehead
      ctx.beginPath(); ctx.arc(0.6, hy - 1.1, 0.7, 0, TAU); ctx.arc(2, hy - 1.1, 0.6, 0, TAU)
      ctx.fillStyle = col('#bfe3ff'); ctx.fill(); ctx.strokeStyle = col('#e3c27a'); ctx.lineWidth = 0.35; ctx.stroke()
    }
  } else if (a.hat === 'straw') {
    ellipse(ctx, 0, hy - 1.55, 3.6, 0.95, col('#e8c77a'), OUTLINE, 0.3)
    ellipse(ctx, 0, hy - 2.15, 1.9, 1.15, col('#f3d98f'))
    ctx.fillStyle = col('#c0603e'); ctx.fillRect(-1.9, hy - 2.05, 3.8, 0.5)
  } else if (a.hat === 'cap') {
    ctx.beginPath(); ctx.arc(0, hy - 0.5, 2.2, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath()
    ctx.fillStyle = col('#1f2d6a'); ctx.fill()
    ctx.fillStyle = col('#e3c27a'); ctx.fillRect(-2.1, hy - 1.05, 4.2, 0.45)
    ellipse(ctx, 1.4, hy - 0.7, 1.6, 0.4, col('#1f2d6a'))
  } else if (a.hat === 'captain') {
    // a navy captain's hat with gold trim
    // sits on the crown of the head, brim above the brows
    ctx.beginPath(); ctx.moveTo(-1.85, hy - 1.3); ctx.quadraticCurveTo(-2.05, hy - 3.7, 0, hy - 3.8); ctx.quadraticCurveTo(2.05, hy - 3.7, 1.85, hy - 1.3); ctx.closePath()
    ctx.fillStyle = col('#24357a'); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.35; ctx.stroke()
    ctx.fillStyle = col('#e3c27a'); ctx.fillRect(-1.9, hy - 1.9, 3.8, 0.45)
    ellipse(ctx, 0.45, hy - 1.22, 2.85, 0.55, col('#1a2766'), col('#e3c27a'), 0.35)
    if (!a.back) circle(ctx, 0.5, hy - 2.65, 0.45, col('#f3d98f'))
  } else if (a.hat === 'hood') {
    // the hood's rim frames the face instead of covering it
    ctx.beginPath()
    if (a.back) ctx.ellipse(0, hy, 2.6, 2.6, 0, 0, TAU)
    else { ctx.arc(-0.5, hy + 0.2, 2.75, Math.PI * 0.62, Math.PI * 1.9); ctx.quadraticCurveTo(0.2, hy - 1.1, -1.4, hy + 1.9) }
    ctx.closePath()
    ctx.fillStyle = col(a.cloak || '#6a5ac8'); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.stroke()
  }
  ctx.restore()
  ctx.restore()

  // chat bubble in the game's cream-and-gold style
  if (a.act === 'chat' && Math.sin(t * 1.3 + a.id) > 0.45) {
    const bx = a.x + 4.5 * a.dir, by = a.y - 17 * s
    ellipse(ctx, bx, by, 4.4, 3, 'rgba(255,248,228,.95)', 'rgba(184,146,74,.9)', 0.4)
    ctx.beginPath(); ctx.moveTo(bx - 1.6 * a.dir, by + 2.4); ctx.lineTo(bx - 3 * a.dir, by + 4.2); ctx.lineTo(bx - 0.4 * a.dir, by + 2.8); ctx.fillStyle = 'rgba(255,248,228,.95)'; ctx.fill()
    const icon = (a.id + Math.floor(t / 4)) % 3
    if (icon === 0) for (let i = -1; i <= 1; i++) circle(ctx, bx + i * 1.4, by, 0.45, '#5a4a7a')
    else if (icon === 1) { ellipse(ctx, bx - 0.8, by + 0.3, 1.3, 0.9, '#b9b2e6'); ellipse(ctx, bx + 0.7, by, 1.5, 1.1, '#b9b2e6') } // a cloud
    else { circle(ctx, bx - 0.6, by - 0.3, 0.8, '#d9534f'); circle(ctx, bx + 0.6, by - 0.3, 0.8, '#d9534f'); ctx.beginPath(); ctx.moveTo(bx - 1.4, by); ctx.lineTo(bx, by + 1.6); ctx.lineTo(bx + 1.4, by); ctx.fillStyle = '#d9534f'; ctx.fill() }
  }
}

/** A lamplighter's lantern glow, in world units. */
export function personLight(a) {
  if (a.carry !== 'lantern' || a.act === 'sit') return null
  const s = 1.18
  return [a.x + 5.8 * s * a.dir, a.y - 13.4 * s, 12]
}
