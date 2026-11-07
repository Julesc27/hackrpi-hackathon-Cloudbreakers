// Residents: little sky-folk who walk the painted paths of every island you can reach, cross
// your bridges, tend crops, sit on benches, gaze off the edge and stop to chat.
//
// Where they can walk comes from walkGrid.js, a grid traced from the painted art itself (paving is
// cheap to walk on, lawns cost more, everything else is blocked), so they stay on the paths you
// can see. Buildings you place block their footprint and people route around them.
import { WORLD_ISLANDS, BRIDGE_ENDS, bridgePoints } from './layout.js'
import { WALK, CELL } from './walkGrid.js'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { rng, circle, ellipse, line, col, TAU } from './iso.js'

/* ---------------- bridges ---------------- */
/** Point on a bridge deck, t in [0, 1] from end a to end b. Includes the islands' bob. */
export function bridgeAt(routeId, t) {
  const p = bridgePoints(routeId)
  if (!p) return null
  const ends = BRIDGE_ENDS[routeId]
  const bobA = WORLD_ISLANDS[ends.a[0]]._bob || 0
  const bobB = WORLD_ISLANDS[ends.b[0]]._bob || 0
  return [
    p.a[0] + (p.b[0] - p.a[0]) * t,
    p.a[1] + bobA + (p.b[1] + bobB - p.a[1] - bobA) * t + Math.sin(t * Math.PI) * 5,
  ]
}

export function bridgeCurve(routeId, n = 10) {
  if (!bridgePoints(routeId)) return []
  const out = []
  for (let i = 0; i <= n; i++) out.push(bridgeAt(routeId, i / n))
  return out
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
  GRIDS[id] = { id, x: g.x, y: g.y, cols: g.cols, rows: g.rows, base, cost: base.slice(), poi: g.poi, paved: [] }
}
const cellOf = (G, x, y) => {
  const c = Math.floor((x - G.x) / CELL), r = Math.floor((y - G.y) / CELL)
  return c < 0 || r < 0 || c >= G.cols || r >= G.rows ? -1 : r * G.cols + c
}
const centre = (G, i) => [G.x + ((i % G.cols) + 0.5) * CELL, G.y + (Math.floor(i / G.cols) + 0.5) * CELL]
function nearestOpen(G, x, y) {
  const c0 = Math.floor((x - G.x) / CELL), r0 = Math.floor((y - G.y) / CELL)
  for (let rad = 0; rad < 24; rad++) {
    let best = -1, bd = Infinity
    for (let r = r0 - rad; r <= r0 + rad; r++) {
      for (let c = c0 - rad; c <= c0 + rad; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== rad) continue
        if (r < 0 || c < 0 || r >= G.rows || c >= G.cols) continue
        const i = r * G.cols + c
        if (!G.cost[i]) continue
        const d = (r - r0) ** 2 + (c - c0) ** 2
        if (d < bd) { bd = d; best = i }
      }
    }
    if (best >= 0) return best
  }
  return -1
}

/** Mark the ground under player-built buildings as blocked. */
function applyBuildings(state) {
  for (const G of Object.values(GRIDS)) G.cost.set(G.base)
  for (const b of state.buildings) {
    if (b.slot < 0 || BUILDINGS[b.type]?.infrastructure) continue
    const G = GRIDS[b.island], plot = ISLANDS[b.island]?.plots?.[b.slot]
    if (!G || !plot) continue
    const w = b.type === 'communityHall' ? 82 : b.island === 'newHaven' ? 60 : 50
    const rx = w * 0.5, ry = w * 0.27
    for (let r = 0; r < G.rows; r++) {
      for (let c = 0; c < G.cols; c++) {
        const [cx, cy] = [G.x + (c + 0.5) * CELL, G.y + (r + 0.5) * CELL]
        // a diamond footprint, like the stone foundations
        if (Math.abs(cx - plot[0]) / rx + Math.abs(cy - plot[1]) / ry < 1) G.cost[r * G.cols + c] = 0
      }
    }
  }
  for (const G of Object.values(GRIDS)) {
    G.paved = []
    for (let i = 0; i < G.cost.length; i++) if (G.cost[i] === 1) G.paved.push(i)
    G.pois = G.poi.map(([c, r, tag]) => ({ i: nearestOpen(G, ...centre(G, r * G.cols + c)), tag })).filter((p) => p.i >= 0)
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
  if (!G.g || G.g.length !== N) { G.g = new Float32Array(N); G.came = new Int32Array(N); G.seen = new Uint32Array(N) }
  const stamp = ++stampN, cols = G.cols
  const tc = to % cols, tr = (to / cols) | 0
  const h = (i) => { const dc = Math.abs((i % cols) - tc), dr = Math.abs(((i / cols) | 0) - tr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr) }
  heap.n = 0
  G.g[from] = 0; G.came[from] = -1; G.seen[from] = stamp
  hpush(h(from), from)
  let guard = 0
  while (heap.n && guard++ < 9000) {
    const cur = hpop()
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
        if (!w) continue
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
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL * 0.5))
  for (let k = 1; k < n; k++) {
    const i = cellOf(G, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n)
    if (i < 0 || !G.cost[i] || G.cost[i] > maxCost) return false
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
    long: r() < 0.4, // long hair
  }
  switch (role) {
    case 'skywright': Object.assign(look, { shirt: pick(r, NAVY), trim: '#e3c27a', hat: 'aviator', carry: r() < 0.6 ? 'plank' : 'toolbag' }); break
    case 'farmer': Object.assign(look, { shirt: pick(r, ['#5f9e4f', '#d39a3a', '#b8573a']), apron: '#f3e6c6', hat: 'straw', carry: 'basket' }); break
    case 'lamplighter': Object.assign(look, { shirt: '#2b3f8c', coat: true, trim: '#e3c27a', hat: 'cap', carry: 'lantern' }); break
    case 'courier': Object.assign(look, { shirt: pick(r, ['#f3e6c6', '#3f8f9a', '#6a5ac8']), scarf: pick(r, ['#d9534f', '#e3a13a', '#c0603e']), hat: r() < 0.5 ? 'aviator' : null, carry: 'satchel' }); break
    case 'kid': Object.assign(look, { shirt: pick(r, BRIGHT), carry: r() < 0.55 ? 'kite' : r() < 0.5 ? 'pinwheel' : null, kite: pick(r, ['#d9534f', '#e3c27a', '#3f8f9a', '#6a5ac8']) }); break
    default: Object.assign(look, { shirt: pick(r, [...BRIGHT, ...NAVY]), cloak: r() < 0.45 ? pick(r, ['#2c4fb0', '#6a5ac8', '#3f8f9a', '#8f3f27']) : null, hat: r() < 0.25 ? 'hood' : null })
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
  }

  /** Rebuild walkable areas for the current game state and resize the crowd. */
  setState(state, access, target) {
    applyBuildings(state)
    this.islands = Object.keys(GRIDS).filter((id) => access[id] && state.connected.includes(id) && GRIDS[id].paved.length)
    this.links = {}
    for (const b of state.bridges) {
      const e = BRIDGE_ENDS[b.route]
      if (!e || b.condition <= 0 || !this.islands.includes(e.a[0]) || !this.islands.includes(e.b[0])) continue
      ;(this.links[e.a[0]] ||= []).push({ to: e.b[0], route: b.route, from: 0 })
      ;(this.links[e.b[0]] ||= []).push({ to: e.a[0], route: b.route, from: 1 })
    }
    // people standing somewhere that's gone (a new building, a broken bridge) are moved or replanned
    this.agents = this.agents.filter((a) => (a.isl ? this.islands.includes(a.isl) : this.links[a.leg?.toIsl]))
    for (const a of this.agents) {
      if (!a.isl) continue
      const G = GRIDS[a.isl], i = cellOf(G, a.x, a.y)
      if (i < 0 || !G.cost[i]) { const n = nearestOpen(G, a.x, a.y); if (n >= 0) [a.x, a.y] = centre(G, n) }
      a.legs = []; a.leg = null; if (a.act === 'walk') a.act = 'idle'
    }
    if (!this.islands.length) { this.agents = []; return }
    while (this.agents.length < target) this.agents.push(this.spawn())
    if (this.agents.length > target) this.agents.length = target
  }

  spawn() {
    const r = this.r
    const isl = this.islands.includes('newHaven') && r() < 0.5 ? 'newHaven' : pick(r, this.islands)
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
      const i = cellOf(G, q[0], q[1])
      if (i >= 0 && G.cost[i]) pts[k] = q
    }
    pts.push([tx, ty])
    return { isl, pts, i: 0 }
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
        const [x, y] = bridgeAt(leg.route, leg.from === 0 ? leg.u : 1 - leg.u)
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
  const top = a.hat === 'straw' ? '#e8c77a' : a.hat === 'cap' ? '#1f2d6a' : a.hat === 'aviator' ? '#7a4b2a' : a.hat === 'hood' ? a.cloak || '#6a5ac8' : a.hair
  ctx.beginPath(); ctx.arc(x, y - 12.1 * s, 2.2 * s, Math.PI, TAU); ctx.fillStyle = col(top); ctx.fill()
}

/** Draw one resident with their feet at (a.x, a.y). `detail` false draws the far-zoom figure. */
export function drawPerson(ctx, a, t, detail = true) {
  if (!detail) { drawPersonFar(ctx, a); return }
  const s = a.kid ? 0.88 : 1.18
  const walking = a.act === 'walk'
  const swing = walking ? Math.sin(a.phase) : 0
  const bob = walking ? Math.abs(Math.cos(a.phase)) * 0.6 : 0
  const sit = a.act === 'sit', tend = a.act === 'tend'
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
    ctx.beginPath()
    ctx.moveTo(-1.6, top + 0.6)
    ctx.quadraticCurveTo(-3.6 - wind, hip, -3.2 - wind * 1.6, hip + 3.4 - (sit ? 1.5 : 0))
    ctx.lineTo(1.4, hip + 3 - (sit ? 1.5 : 0))
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
    const l1 = -0.6 - swing * 1.6, l2 = 0.7 + swing * 1.6
    line(ctx, -0.6, hip, l1, -0.4, col(shade(a.pants, 0.8)), 1.6)
    line(ctx, 0.7, hip, l2, -0.4, col(a.pants), 1.6)
    ellipse(ctx, l1 + 0.3, -0.3, 0.95, 0.5, boot)
    ellipse(ctx, l2 + 0.3, -0.3, 0.95, 0.5, boot)
  }

  // torso (leans in while tending crops)
  ctx.save()
  if (tend) { ctx.translate(0, hip); ctx.rotate(0.45 + Math.sin(a.phase) * 0.1); ctx.translate(0, -hip) }
  const body = new Path2D()
  body.moveTo(-2.4, hip + 0.6); body.lineTo(-2.1, top + 1.2)
  body.quadraticCurveTo(0, top - 0.9, 2.1, top + 1.2); body.lineTo(2.4, hip + 0.6)
  body.quadraticCurveTo(0, hip + 1.4, -2.4, hip + 0.6)
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
  if (a.carry === 'toolbag') {
    ctx.fillStyle = col('#6b4426'); ctx.fillRect(1.6, hip - 1.2, 2.2, 1.7)
    line(ctx, 2.2, hip - 1.3, 2.2, hip - 2.6, col('#cbd0dc'), 0.45)
  }

  // arms
  const armSwing = walking ? -swing * 1.6 : a.act === 'chat' ? Math.sin(a.phase * 1.3) * 1.4 : 0
  const sleeve = col(a.coat ? a.shirt : shade(a.shirt, 0.92))
  const hand = col(a.skin)
  if (walking && a.carry === 'plank') {
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
    line(ctx, 1.7, top + 1.6, 2.3 + armSwing * 0.6, hip - 0.4 + wave, sleeve, 1.2)
    circle(ctx, 2.3 + armSwing * 0.6, hip - 0.1 + wave, 0.55, hand)
  }
  line(ctx, -1.7, top + 1.6, -2.3 - armSwing * 0.6, hip - 0.4, col(shade(a.shirt, 0.75)), 1.2)
  circle(ctx, -2.3 - armSwing * 0.6, hip - 0.1, 0.55, hand)

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
  circle(ctx, 0, hy, 2.05, col(a.skin))
  ctx.beginPath(); ctx.arc(0, hy, 2.05, 0, TAU); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.38; ctx.stroke()
  // hair
  ctx.fillStyle = col(a.hair)
  ctx.beginPath()
  if (a.back) {
    ctx.arc(0, hy, 2.15, 0, TAU)
  } else {
    ctx.arc(0, hy - 0.15, 2.15, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(0.2, hy - 1.2, -2.1, hy + 0.1)
  }
  ctx.fill()
  if (a.long) { ctx.beginPath(); ctx.ellipse(-1.5, hy + 1.2, 1, 2, 0.2, 0, TAU); ctx.fill() }
  if (!a.back) {
    // a face: two dot eyes and a little rosy cheek
    circle(ctx, 0.9, hy + 0.15, 0.26, '#2a1f2e')
    circle(ctx, 1.9, hy + 0.1, 0.22, '#2a1f2e')
    circle(ctx, 1.2, hy + 0.95, 0.4, 'rgba(232,120,110,.45)')
  }
  // hats
  if (a.hat === 'aviator') {
    ctx.beginPath(); ctx.arc(0, hy - 0.2, 2.25, Math.PI, TAU); ctx.lineTo(2.2, hy + 0.4); ctx.lineTo(-2.2, hy + 0.8); ctx.closePath()
    ctx.fillStyle = col('#7a4b2a'); ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.3; ctx.stroke()
    if (!a.back) { // brass goggles pushed up on the forehead
      ctx.beginPath(); ctx.arc(0.6, hy - 1.1, 0.7, 0, TAU); ctx.arc(2, hy - 1.1, 0.6, 0, TAU)
      ctx.fillStyle = col('#bfe3ff'); ctx.fill(); ctx.strokeStyle = col('#e3c27a'); ctx.lineWidth = 0.35; ctx.stroke()
    }
  } else if (a.hat === 'straw') {
    ellipse(ctx, 0, hy - 1.3, 3.6, 1.05, col('#e8c77a'), OUTLINE, 0.3)
    ellipse(ctx, 0, hy - 1.9, 1.9, 1.15, col('#f3d98f'))
    ctx.fillStyle = col('#c0603e'); ctx.fillRect(-1.9, hy - 1.8, 3.8, 0.5)
  } else if (a.hat === 'cap') {
    ctx.beginPath(); ctx.arc(0, hy - 0.5, 2.2, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath()
    ctx.fillStyle = col('#1f2d6a'); ctx.fill()
    ctx.fillStyle = col('#e3c27a'); ctx.fillRect(-2.1, hy - 1.05, 4.2, 0.45)
    ellipse(ctx, 1.4, hy - 0.7, 1.6, 0.4, col('#1f2d6a'))
  } else if (a.hat === 'hood') {
    ctx.beginPath(); ctx.arc(0, hy, 2.6, Math.PI * 0.8, Math.PI * 2.05); ctx.quadraticCurveTo(-0.5, hy + 2.4, -2.4, hy + 1.6); ctx.closePath()
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
