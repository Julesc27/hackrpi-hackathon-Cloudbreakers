// Residents: little people who wander the walkway graph of every island you can reach,
// cross bridges, stop to chat, sit on benches, tend crops and carry lanterns.
import { WORLD_ISLANDS, BRIDGE_ENDS, bridgePoints } from './layout.js'
import { rng, circle, ellipse, line, col, TAU } from './iso.js'

const SHIRTS = ['#2c4fb0', '#b8573a', '#5fae4f', '#8a5ac8', '#e3a13a', '#3a8fa8', '#d9534f', '#f2efe6', '#41629e']
const PANTS = ['#3a3550', '#5b4636', '#2b3a66', '#6b5a44', '#44506e']
const SKIN = ['#f1c9a5', '#e0ac85', '#c68b62', '#9a6646', '#f5d6bc']
const HAIR = ['#3b2a1e', '#6b4426', '#1f1a24', '#c99a5e', '#8a4a2a', '#d9d2c4']

export function bridgeCurve(routeId, n = 10, type = 'rope') {
  const p = bridgePoints(routeId)
  if (!p) return []
  const out = []
  const length = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])
  const sag = type === 'reinforced' ? Math.min(6, Math.max(3, length * .012)) : Math.min(24, Math.max(10, length * .065))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = p.a[0] + (p.b[0] - p.a[0]) * t
    const ends = BRIDGE_ENDS[routeId]
    const bobA = WORLD_ISLANDS[ends.a[0]]._bob || 0
    const bobB = WORLD_ISLANDS[ends.b[0]]._bob || 0
    const y = p.a[1] + bobA + (p.b[1] + bobB - p.a[1] - bobA) * t + Math.sin(t * Math.PI) * sag
    out.push([x, y])
  }
  return out
}

/** Walkable graph for the current game state. */
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

function bfs(g, from, to) {
  if (from === to) return [to]
  const prev = new Map([[from, null]])
  const q = [from]
  while (q.length) {
    const k = q.shift()
    for (const n of g.adj.get(k) || []) {
      if (prev.has(n)) continue
      prev.set(n, k)
      if (n === to) {
        const path = [n]
        let c = k
        while (c !== from) { path.unshift(c); c = prev.get(c) }
        return path
      }
      q.push(n)
    }
  }
  return null
}

export class Crowd {
  constructor() {
    this.agents = []
    this.graph = null
    this.r = rng(99)
    this.nextId = 1
  }

  setGraph(graph, target) {
    this.graph = graph
    const keys = [...graph.nodes.keys()].filter((k) => !k.startsWith('br:'))
    if (!keys.length) { this.agents = []; return }
    // drop residents standing somewhere that's no longer walkable
    this.agents = this.agents.filter((a) => graph.nodes.has(a.node))
    for (const a of this.agents) a.path = a.path.filter((k) => graph.nodes.has(k))
    while (this.agents.length < target) this.agents.push(this.spawn(keys))
    if (this.agents.length > target) this.agents.length = target
  }

  spawn(keys) {
    const r = this.r
    const home = keys.filter((k) => k.startsWith('newHaven:'))
    const pool = r() < 0.55 && home.length ? home : keys
    const k = pool[Math.floor(r() * pool.length)]
    const n = this.graph.nodes.get(k)
    const kid = r() < 0.16
    return {
      id: this.nextId++, x: n.x, y: n.y, node: k, path: [], wait: r() * 3, act: 'idle',
      speed: (kid ? 17 : 10) + r() * 5, phase: r() * TAU, dir: r() < 0.5 ? -1 : 1, back: false,
      lane: (r() - 0.5) * 5, kid,
      shirt: SHIRTS[Math.floor(r() * SHIRTS.length)], pants: PANTS[Math.floor(r() * PANTS.length)],
      skin: SKIN[Math.floor(r() * SKIN.length)], hair: HAIR[Math.floor(r() * HAIR.length)],
      lantern: !kid && r() < 0.28, carry: !kid && r() < 0.2 ? (r() < 0.5 ? 'crate' : 'basket') : null,
      hat: r() < 0.22 ? (r() < 0.5 ? '#c99a5e' : '#2c4fb0') : null,
    }
  }

  pickDestination(a) {
    const r = this.r
    const cur = this.graph.nodes.get(a.node)
    const all = [...this.graph.nodes.values()].filter((n) => n.island !== 'bridge' && n.k !== a.node)
    if (!all.length) return
    const local = all.filter((n) => n.island === cur.island)
    const pool = r() < 0.72 && local.length ? local : all
    const dest = pool[Math.floor(r() * pool.length)]
    const path = bfs(this.graph, a.node, dest.k)
    if (path) a.path = path
  }

  update(dt) {
    if (!this.graph) return
    const r = this.r
    for (const a of this.agents) {
      if (a.wait > 0) {
        a.wait -= dt
        a.phase += dt * (a.act === 'tend' ? 3 : a.act === 'chat' ? 4 : 0.5)
        if (a.wait <= 0) a.act = 'walk'
        continue
      }
      if (!a.path.length) {
        const n = this.graph.nodes.get(a.node)
        const roll = r()
        if (n?.tag === 'sit' && roll < 0.7) { a.act = 'sit'; a.wait = 4 + r() * 7 }
        else if (n?.tag === 'tend' && roll < 0.8) { a.act = 'tend'; a.wait = 4 + r() * 6 }
        else if (n?.tag === 'look' && roll < 0.6) { a.act = 'look'; a.wait = 2 + r() * 4; a.back = true }
        else if (roll < 0.45) {
          // find someone nearby to chat with
          const buddy = this.agents.find((b) => b !== a && b.wait <= 0.2 && Math.hypot(b.x - a.x, b.y - a.y) < 26)
          a.act = buddy ? 'chat' : 'idle'; a.wait = 2 + r() * 4
          if (buddy) { buddy.act = 'chat'; buddy.wait = a.wait; buddy.path = []; a.dir = buddy.x > a.x ? 1 : -1; buddy.dir = -a.dir; a.back = buddy.back = false }
        }
        if (a.wait > 0) continue
        this.pickDestination(a)
        if (!a.path.length) { a.wait = 1 + r() * 2; a.act = 'idle'; continue }
        a.act = 'walk'
      }
      const next = this.graph.nodes.get(a.path[0])
      if (!next) { a.path = []; continue }
      // walk with a small personal lane offset so people don't stack on the same line
      const dx = next.x - a.x, dy = next.y - a.y
      const d = Math.hypot(dx, dy)
      const nx = -dy / (d || 1), ny = dx / (d || 1)
      const tx = next.x + nx * a.lane * (next.island === 'bridge' ? 0.3 : 1), ty = next.y + ny * a.lane * 0.5
      const ddx = tx - a.x, ddy = ty - a.y
      const dist = Math.hypot(ddx, ddy)
      const step = a.speed * dt
      if (dist <= step) {
        a.x = tx; a.y = ty; a.node = a.path.shift()
      } else {
        a.x += (ddx / dist) * step; a.y += (ddy / dist) * step
        if (Math.abs(ddx) > 0.2) a.dir = ddx > 0 ? 1 : -1
        a.back = ddy < -Math.abs(ddx) * 0.3
      }
      a.phase += step * 0.55
    }
  }
}

/** Draw one resident with their feet at (a.x, a.y). */
export function drawPerson(ctx, a, t) {
  const s = a.kid ? 0.72 : 1
  const walking = a.act === 'walk'
  const swing = walking ? Math.sin(a.phase) : 0
  const bob = walking ? Math.abs(Math.cos(a.phase)) * 0.7 : 0
  const sit = a.act === 'sit'
  const tend = a.act === 'tend'
  ctx.save()
  ctx.translate(a.x, a.y)
  ctx.scale(s * a.dir, s)
  ellipse(ctx, 0, 0.3, 3.2, 1.3, 'rgba(18,24,60,.28)')
  const hip = sit ? -3.2 : -4.6 - bob
  // legs
  if (sit) {
    line(ctx, -0.9, hip, 1.8, hip + 0.4, col(a.pants), 1.5)
    line(ctx, 1.8, hip + 0.4, 2.1, 0, col(a.pants), 1.4)
    line(ctx, 0.6, hip, 3, hip + 0.5, col(a.pants), 1.5)
  } else {
    line(ctx, -0.6, hip, -0.6 - swing * 1.5, 0, col(a.pants), 1.5)
    line(ctx, 0.7, hip, 0.7 + swing * 1.5, 0, col(a.pants), 1.5)
  }
  // body (leans forward when tending crops)
  ctx.save()
  if (tend) { ctx.translate(0, hip); ctx.rotate(0.55 + Math.sin(a.phase) * 0.12); ctx.translate(0, -hip) }
  const top = hip - 5.6
  ctx.beginPath()
  ctx.moveTo(-2.3, hip + 0.4); ctx.lineTo(-2, top + 1); ctx.quadraticCurveTo(0, top - 0.8, 2, top + 1); ctx.lineTo(2.3, hip + 0.4); ctx.closePath()
  ctx.fillStyle = col(a.shirt); ctx.fill()
  // arms
  const armSwing = walking ? -swing * 1.6 : a.act === 'chat' ? Math.sin(a.phase * 1.3) * 1.4 : 0
  if (a.carry && walking) {
    line(ctx, 1.6, top + 1.6, 3.4, top + 3.4, col(a.shirt), 1.2)
    if (a.carry === 'crate') { ctx.fillStyle = col('#b98552'); ctx.fillRect(2.4, top + 1.6, 3.6, 3.2) }
    else { ellipse(ctx, 4, top + 3.6, 2.2, 1.4, col('#c99a5e')); circle(ctx, 3.4, top + 2.6, 0.9, col('#d9534f')); circle(ctx, 4.6, top + 2.7, 0.9, col('#86cf6a')) }
  } else {
    line(ctx, 1.7, top + 1.6, 2.2 + armSwing * 0.6, hip - 0.5 + (a.act === 'chat' ? -1.5 : 0), col(a.shirt), 1.2)
  }
  line(ctx, -1.7, top + 1.6, -2.2 - armSwing * 0.6, hip - 0.5, col(a.shirt), 1.2)
  if (a.lantern) {
    const lx = -2.4 - armSwing * 0.6, ly = hip + 0.6
    line(ctx, lx, hip - 0.6, lx, ly, col('#3a3550'), 0.4)
    ctx.fillStyle = col('#ffe08a'); ctx.fillRect(lx - 1, ly, 2, 2.4)
  }
  // head
  const hy = top - 1.9
  circle(ctx, 0, hy, 1.95, col(a.skin))
  ctx.beginPath()
  if (a.back) { ctx.arc(0, hy, 2.05, 0, TAU) } else { ctx.arc(0, hy - 0.2, 2.05, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(-1.2, hy - 0.4) }
  ctx.fillStyle = col(a.hair); ctx.fill()
  if (a.hat) { ellipse(ctx, 0, hy - 1.5, 2.9, 0.9, col(a.hat)); ellipse(ctx, 0, hy - 2.2, 1.7, 1.1, col(a.hat)) }
  ctx.restore()
  ctx.restore()
  // chat bubble
  if (a.act === 'chat' && Math.sin(t * 1.3 + a.id) > 0.55) {
    const bx = a.x + 4 * a.dir, by = a.y - 17 * s
    ctx.beginPath(); ctx.ellipse(bx, by, 4.2, 2.8, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill()
    for (let i = -1; i <= 1; i++) circle(ctx, bx + i * 1.4, by, 0.45, '#556')
  }
}

export function personLight(a) {
  return a.lantern ? [a.x - 2.4 * a.dir * (a.kid ? 0.72 : 1), a.y - 3, 10] : null
}
