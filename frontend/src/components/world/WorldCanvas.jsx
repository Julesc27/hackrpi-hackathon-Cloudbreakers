import { useEffect, useRef } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ISLANDS } from '../../game/data.js'
import { islandAccess, openRoutes } from '../../game/engine.js'
import { WORLD } from '../map/Camera.jsx'
import { WORLD_ISLANDS, FAR_ISLETS } from './layout.js'
import { PROPS, towerTop } from './props.js'
import { drawIslandBase, animIslandBase, islandBounds, cloudPuff, cloudBank } from './island.js'
import { Crowd, buildGraph, drawPerson, personLight, bridgeCurve } from './people.js'
import { setMode, col, PAL, glow, line, poly, circle, ellipse, rng, lit, TAU } from './iso.js'

/* ---------------- player buildings → prop specs ---------------- */
function buildingProp(b) {
  const plot = ISLANDS[b.island]?.plots?.[b.slot]
  if (!plot) return null
  const [x, y] = plot
  switch (b.type) {
    case 'shelter': return { type: 'house', x, y, a: 16, b: 13, h: 11, roof: 'red', chimney: true }
    case 'storageHouse': return { type: 'house', x, y, a: 20, b: 14, h: 12, roof: 'wood' }
    case 'communityHall': return { type: 'house', x, y, a: 26, b: 18, h: 14, rh: 11, roof: 'blue', chimney: true }
    case 'clinic': return { type: 'house', x, y, a: 18, b: 14, h: 13, roof: 'teal' }
    case 'waterCollector': return { type: 'tank', x, y, r: 11, h: 11, spout: true }
    case 'solarFarm': return { type: 'solar', x, y, rows: 1, cols: 2 }
    case 'windTurbine': return { type: 'turbine', x, y, h: 56, speed: 2 }
    case 'market': return { type: 'stall', x, y, color: '#e3a13a' }
    case 'battery': return { type: 'crystal', x, y, s: 0.9 }
    case 'garden': return { type: 'garden', x, y }
    case 'bridgeAnchor': return { type: 'anchor', x, y }
    default: return { type: 'crate', x, y }
  }
}
// two small extra prop types used only for player builds
PROPS.garden = {
  draw: (ctx, p) => {
    const cs = ['#5fae4f', '#7cc96a', '#f2a33a']
    poly(ctx, [[p.x - 18, p.y], [p.x, p.y - 9], [p.x + 18, p.y], [p.x, p.y + 9]], col('#7a5236'), col('#5e3d25'), 1)
    for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) {
      const u = -12 + k * 6, v = -6 + i * 4
      circle(ctx, p.x + u * 0.7 - v, p.y + (u * 0.7 + v) / 2 - 1.5, 1.8, col(cs[(i + k) % 3]))
    }
  },
  size: () => [20, 12, 10],
}
PROPS.anchor = {
  draw: (ctx, p) => {
    ellipse(ctx, p.x, p.y + 1, 14, 5, 'rgba(18,24,60,.25)')
    poly(ctx, [[p.x - 12, p.y], [p.x, p.y - 6], [p.x + 12, p.y], [p.x, p.y + 6]], col('#b98552'), col('#6e4522'), 0.8)
    for (const [dx, dy] of [[-7, -1], [7, -1], [0, 3], [0, -4]]) { line(ctx, p.x + dx, p.y + dy, p.x + dx, p.y + dy - 12, col('#6e4522'), 2, 'butt'); circle(ctx, p.x + dx, p.y + dy - 12, 1.4, col('#c99a5e')) }
    line(ctx, p.x - 7, p.y - 11, p.x + 7, p.y - 11, col(PAL.gold), 0.9)
  },
  size: () => [16, 18, 8],
}

/* ---------------- bitmap cache ---------------- */
class SpriteCache {
  constructor() { this.map = new Map(); this.bucket = 1 }
  setBucket(ppu) {
    const b = Math.min(4, Math.max(0.5, 2 ** (Math.ceil(Math.log2(ppu) * 2) / 2)))
    if (b !== this.bucket) { this.bucket = b; this.map.clear() }
  }
  get(key, bounds, mode, draw) {
    const k = `${key}|${mode}`
    let c = this.map.get(k)
    if (!c) {
      const s = this.bucket
      const cv = document.createElement('canvas')
      cv.width = Math.max(1, Math.ceil(bounds.w * s)); cv.height = Math.max(1, Math.ceil(bounds.h * s))
      const cx = cv.getContext('2d')
      cx.scale(s, s); cx.translate(-bounds.x, -bounds.y)
      setMode(mode)
      draw(cx)
      setMode('lit')
      c = { cv, b: bounds }
      this.map.set(k, c)
    }
    return c
  }
}

function propBounds(p) {
  const def = PROPS[p.type]
  const [hw, up, down] = def.size(p)
  const [cx, cy] = def.center ? def.center(p) : [p.x, p.y]
  return { x: cx - hw - 3, y: cy - up - 3, w: hw * 2 + 6, h: up + down + 6 }
}
const propKey = (p) => `${p.type}:${Math.round(p.x)}:${Math.round(p.y)}:${p.pts ? p.pts.flat().join(',') : ''}`

/* ---------------- far islets (procedural, hazy) ---------------- */
function drawIslet(ctx, x, y, s, seed) {
  const r = rng(seed)
  const rx = 42 * s, ry = 18 * s
  const g = ctx.createLinearGradient(0, y, 0, y + 70 * s)
  g.addColorStop(0, col(PAL.rock)); g.addColorStop(1, col(PAL.rockDark, 0.2))
  ctx.beginPath(); ctx.moveTo(x - rx, y)
  for (let i = 0; i <= 8; i++) { const t = i / 8; ctx.lineTo(x - rx + t * rx * 2, y + Math.sin(t * Math.PI) * 62 * s * (i % 2 ? 1 : 0.7)) }
  ctx.lineTo(x + rx, y); ctx.closePath(); ctx.fillStyle = g; ctx.fill()
  ellipse(ctx, x, y + 3, rx, ry, col(PAL.grassEdge)); ellipse(ctx, x, y, rx, ry, col(PAL.grass))
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; cloudPuff(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * ry + 4, (6 + r() * 6) * s, 1) }
  // a tiny temple
  const tx = x + (r() - 0.5) * rx * 0.5, ty = y - 2
  ctx.fillStyle = col('#e8dcc4'); ctx.fillRect(tx - 9 * s, ty - 10 * s, 18 * s, 10 * s)
  poly(ctx, [[tx - 12 * s, ty - 10 * s], [tx + 12 * s, ty - 10 * s], [tx, ty - 20 * s]], col(PAL.roofBlue))
  for (let i = 0; i < 3; i++) { const px = x + (r() - 0.5) * rx * 1.4, py = y + (r() - 0.5) * ry; circle(ctx, px, py - 6 * s, 4 * s, col(PAL.leaf)) }
}

/* ---------------- bridges ---------------- */
function drawBridge(ctx, b, t, ghost = false) {
  const pts = bridgeCurve(b.route, 14)
  if (pts.length < 2) return
  const reinforced = b.type === 'reinforced'
  const strained = !ghost && b.condition < 40
  const W = 5.2
  const norm = (i) => {
    const [x1, y1] = pts[Math.max(0, i - 1)], [x2, y2] = pts[Math.min(pts.length - 1, i + 1)]
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1
    let nx = -dy / l, ny = dx / l
    ny *= 0.55
    const k = Math.hypot(nx, ny) || 1
    return [nx / k, ny / k]
  }
  if (ghost) {
    ctx.save(); ctx.setLineDash([2.5, 4]); ctx.lineDashOffset = -t * 8
    for (const side of [-1, 1]) {
      ctx.beginPath()
      pts.forEach(([x, y], i) => { const [nx, ny] = norm(i); const px = x + nx * W * side, py = y + ny * W * side; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py) })
      ctx.strokeStyle = 'rgba(243,217,143,.75)'; ctx.lineWidth = 1.1; ctx.stroke()
    }
    ctx.restore()
    return
  }
  // shadow on the clouds/rock below
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 16) : ctx.moveTo(x, y + 16)))
  ctx.strokeStyle = 'rgba(10,14,50,.22)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke()
  // underside beam
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 2.5) : ctx.moveTo(x, y + 2.5)))
  ctx.strokeStyle = col(reinforced ? '#8f8678' : PAL.woodDark); ctx.lineWidth = W * 2 + 1; ctx.lineCap = 'butt'; ctx.stroke()
  // planks
  const n = pts.length - 1
  const rr = rng(b.route.length * 31)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const t0 = (i + k / 3) / n, t1 = (i + (k + 0.82) / 3) / n
      if (strained && rr() < 0.18) continue
      const P = (tt) => { const f = tt * n, j = Math.min(n - 1, Math.floor(f)), u = f - j; return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u, j] }
      const [x0, y0, j0] = P(t0), [x1, y1] = P(t1)
      const [nx, ny] = norm(j0)
      poly(ctx, [[x0 + nx * W, y0 + ny * W], [x1 + nx * W, y1 + ny * W], [x1 - nx * W, y1 - ny * W], [x0 - nx * W, y0 - ny * W]],
        col(reinforced ? (k % 2 ? '#e3dbcd' : '#d4cbbb') : (k % 2 ? PAL.woodLight : '#b8834b')))
    }
  }
  // posts + rails on both sides
  for (const side of [-1, 1]) {
    const rail = []
    pts.forEach(([x, y], i) => {
      const [nx, ny] = norm(i)
      const px = x + nx * W * side, py = y + ny * W * side
      if (i % 2 === 0) line(ctx, px, py, px, py - 7, col(reinforced ? '#cfc6b4' : PAL.woodDark), reinforced ? 1.8 : 1.4, 'butt')
      rail.push([px, py - 6.5])
    })
    ctx.beginPath(); rail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.strokeStyle = col(reinforced ? PAL.gold : '#8a5a2e'); ctx.lineWidth = 1; ctx.stroke()
  }
}

/* ---------------- the component ---------------- */
export default function WorldCanvas({ hoverRef }) {
  const { state } = useGame()
  const ui = useUI()
  const canvasRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const uiRef = useRef(ui)
  uiRef.current = ui
  const crowd = useRef(new Crowd())
  const cache = useRef(new SpriteCache())

  // walkable graph follows connections and bridges
  useEffect(() => {
    const access = islandAccess(state)
    const graph = buildGraph(state, access)
    const reachable = Object.keys(access).filter((k) => access[k]).length
    const target = Math.max(6, Math.min(56, Math.round(state.population * 1.5) + reachable * 3))
    crowd.current.setGraph(graph, target)
  }, [state.bridges, state.connected, state.population]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    let raf = 0, last = performance.now(), W = 0, H = 0, dpr = 1
    const resize = () => {
      dpr = Math.min(1.75, window.devicePixelRatio || 1)
      const r = cv.parentElement.getBoundingClientRect()
      W = r.width; H = r.height
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(cv.parentElement)

    const islandMode = (id, st, access) =>
      st.connected.includes(id) ? (access[id] ? 'lit' : 'locked') : st.discovered.includes(id) ? 'locked' : 'hidden'

    const backClouds = (() => {
      const r = rng(42), out = []
      for (let i = 0; i < 24; i++) {
        const edge = i % 4
        let x, y
        if (edge === 0) { x = WORLD.x + r() * WORLD.w; y = WORLD.y + 60 + r() * 240 }
        else if (edge === 1) { x = WORLD.x + 60 + r() * 360; y = WORLD.y + r() * WORLD.h }
        else if (edge === 2) { x = 1660 + r() * 400; y = WORLD.y + r() * WORLD.h }
        else { x = WORLD.x + r() * WORLD.w; y = 960 + r() * 100 }
        out.push({ x, y, w: 180 + r() * 240, seed: i + 3, sp: 0.02 + r() * 0.03, ph: r() * 6 })
      }
      return out
    })()
    const seaClouds = Array.from({ length: 16 }, (_, i) => ({ x: WORLD.x + (i / 15) * WORLD.w, y: 905 + (i % 3) * 16, w: 260 + (i % 4) * 40, seed: 100 + i }))
    const fireflies = (() => {
      const r = rng(5), out = []
      for (const [id, isl] of Object.entries(WORLD_ISLANDS)) {
        for (let i = 0; i < 9; i++) {
          const g = isl.ground[Math.floor(r() * isl.ground.length)]
          const a = r() * TAU, d = Math.sqrt(r()) * 0.85
          out.push({ id, x: g[0] + Math.cos(a) * g[2] * d, y: g[1] + Math.sin(a) * g[3] * d - 6, ph: r() * 10, sp: 0.12 + r() * 0.15 })
        }
      }
      return out
    })()
    const birdPaths = [
      [[-560, 260], [400, 160], [1100, 300], [2200, 140]],
      [[2250, 520], [1500, 440], [700, 580], [-600, 480]],
      [[-560, 960], [500, 880], [1300, 1000], [2300, 870]],
    ]
    const along = (path, k) => {
      const segs = path.length - 1, f = k * segs, i = Math.min(segs - 1, Math.floor(f)), u = f - i
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * u, path[i][1] + (path[i + 1][1] - path[i][1]) * u]
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const t = now / 1000
      const cam = uiRef.current.camera.current
      if (!cam?.view || !W) return
      const v = cam.view()
      const st = stateRef.current
      const access = islandAccess(st)
      crowd.current.update(dt)
      cache.current.setBucket(v.s * dpr)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      const k = v.s * dpr
      ctx.setTransform(k, 0, 0, k, dpr * (v.x - WORLD.x * v.s), dpr * (v.y - WORLD.y * v.s))
      const vx0 = WORLD.x - v.x / v.s, vy0 = WORLD.y - v.y / v.s, vx1 = vx0 + W / v.s, vy1 = vy0 + H / v.s
      const visible = (b) => b.x < vx1 && b.x + b.w > vx0 && b.y < vy1 && b.y + b.h > vy0
      const blit = (c, dx = 0, dy = 0, alpha = 1) => {
        if (!visible({ x: c.b.x + dx, y: c.b.y + dy, w: c.b.w, h: c.b.h })) return
        if (alpha !== 1) ctx.globalAlpha = alpha
        ctx.drawImage(c.cv, c.b.x + dx, c.b.y + dy, c.b.w, c.b.h)
        if (alpha !== 1) ctx.globalAlpha = 1
      }

      // 1. far sky: drifting cloud banks + distant islets
      for (const c of backClouds) {
        const b = { x: c.x - c.w * 0.6, y: c.y - c.w * 0.45, w: c.w * 1.2, h: c.w * 0.65 }
        const sp = cache.current.get(`bank${c.seed}`, b, 'lit', (cx) => cloudBank(cx, c.x, c.y, c.w, c.seed, true))
        blit(sp, Math.sin(t * c.sp + c.ph) * 40, 0, 0.6)
      }
      FAR_ISLETS.forEach(([x, y, s], i) => {
        const b = { x: x - 60 * s, y: y - 30 * s, w: 120 * s, h: 110 * s }
        const sp = cache.current.get(`islet${i}`, b, 'locked', (cx) => drawIslet(cx, x, y, s, i + 1))
        blit(sp, 0, Math.sin(t * 0.6 + i) * 3, i < 5 ? 0.9 : 0.6)
      })

      // 2. island bodies, back to front
      const order = Object.values(WORLD_ISLANDS).sort((a, b) => a.ground[0][1] - b.ground[0][1])
      for (const isl of order) {
        const mode = islandMode(isl.id, st, access)
        const bob = Math.sin(t * 0.7 + isl.seed) * 1.2
        isl._bob = bob
        const sp = cache.current.get(`isle:${isl.id}`, islandBounds(isl), mode, (cx) => drawIslandBase(cx, isl))
        blit(sp, 0, bob)
        if (mode === 'lit') { ctx.save(); ctx.translate(0, bob); animIslandBase(ctx, isl, t); ctx.restore() }
        if (hoverRef?.current === isl.id && mode !== 'hidden') {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.07
          ctx.drawImage(sp.cv, sp.b.x, sp.b.y + bob, sp.b.w, sp.b.h); ctx.restore()
        }
      }

      // 3. bridges (built ones + blueprints of the ones you could build)
      for (const b of st.bridges) { setMode(b.condition <= 0 ? 'locked' : 'lit'); drawBridge(ctx, b, t) }
      setMode('lit')
      if (!uiRef.current.placing) for (const r of openRoutes(st)) drawBridge(ctx, { route: r.id }, t, true)

      // 4. everything that stands up, depth-sorted together with the residents
      const items = []
      for (const isl of order) {
        const mode = islandMode(isl.id, st, access)
        for (const p of isl.props) items.push({ y: p.pts ? Math.max(p.pts[0][1], p.pts[1][1]) : p.y, p, mode, bob: isl._bob })
      }
      for (const b of st.buildings) {
        if (b.slot < 0 || !st.connected.includes(b.island)) continue
        const p = buildingProp(b)
        if (p) items.push({ y: p.y, p, mode: access[b.island] ? 'lit' : 'locked', bob: WORLD_ISLANDS[b.island]._bob, fresh: b.id })
      }
      for (const a of crowd.current.agents) {
        const isl = WORLD_ISLANDS[crowd.current.graph?.nodes.get(a.node)?.island]
        items.push({ y: a.y, person: a, bob: isl?._bob || 0 })
      }
      items.sort((a, b) => a.y - b.y)
      const lights = []
      for (const it of items) {
        if (it.person) {
          const a = it.person
          if (a.x < vx0 - 10 || a.x > vx1 + 10 || a.y < vy0 - 20 || a.y > vy1 + 10) continue
          ctx.save(); ctx.translate(0, it.bob); drawPerson(ctx, a, t); ctx.restore()
          const l = personLight(a); if (l) lights.push([l[0], l[1] + it.bob, l[2]])
          continue
        }
        const p = it.p, def = PROPS[p.type]
        if (!def) continue
        const b = propBounds(p)
        if (!visible({ ...b, y: b.y + it.bob })) continue
        if (b.w > 1) blit(cache.current.get(propKey(p), b, it.mode, (cx) => def.draw(cx, p)), 0, it.bob)
        if (def.anim && it.mode !== 'hidden') {
          setMode(it.mode)
          ctx.save(); ctx.translate(0, it.bob); def.anim(ctx, p, t, { beacon: st.beaconRestored }); ctx.restore()
          setMode('lit')
        }
        if (it.mode === 'lit' && def.lights) for (const l of def.lights(p)) lights.push([l[0], l[1] + it.bob, l[2]])
      }

      // 5. warm light pass
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (const [x, y, r] of lights) {
        if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue
        const f = 0.85 + Math.sin(t * 7 + x * 0.3) * 0.05 + Math.sin(t * 13 + y) * 0.04
        glow(ctx, x, y, r * f, PAL.glow, 0.32)
      }
      if (st.beaconRestored) {
        const [cx, cy] = towerTop({ x: 765, y: 447, h: 100 })
        ctx.translate(0, WORLD_ISLANDS.newHaven._bob)
        for (const s of [0, Math.PI]) {
          const a = t * 0.35 + s
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 900)
          g.addColorStop(0, 'rgba(255,243,184,.32)'); g.addColorStop(1, 'rgba(255,243,184,0)')
          ctx.fillStyle = g
          ctx.beginPath(); ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a - 0.07) * 900, cy + Math.sin(a - 0.07) * 450)
          ctx.lineTo(cx + Math.cos(a + 0.07) * 900, cy + Math.sin(a + 0.07) * 450)
          ctx.closePath(); ctx.fill()
        }
        ctx.setTransform(k, 0, 0, k, dpr * (v.x - WORLD.x * v.s), dpr * (v.y - WORLD.y * v.s))
      }
      for (const f of fireflies) {
        if (!st.connected.includes(f.id) || !access[f.id]) continue
        const ph = (t * f.sp + f.ph) % 1
        const a = Math.sin(ph * Math.PI)
        glow(ctx, f.x + Math.sin(t + f.ph) * 4, f.y - ph * 22, 3.2, '#fff2b0', 0.7 * a)
      }
      ctx.restore()

      // 6. birds and a passing airship
      setMode('lit')
      birdPaths.forEach((path, i) => {
        for (let j = 0; j < 3; j++) {
          const kk = ((t / (46 + i * 9)) + j * 0.004 + i * 0.3) % 1
          const [x, y] = along(path, kk)
          const flap = Math.sin(t * 9 + j * 1.7) * 2.4
          const bx = x + j * 14 - 14, by = y + (j % 2) * 8
          ctx.beginPath(); ctx.moveTo(bx - 5, by - flap); ctx.quadraticCurveTo(bx - 2.5, by - 2 - flap * 0.3, bx, by); ctx.quadraticCurveTo(bx + 2.5, by - 2 - flap * 0.3, bx + 5, by - flap)
          ctx.strokeStyle = 'rgba(235,240,255,.9)'; ctx.lineWidth = 1.4; ctx.stroke()
        }
      })
      {
        const kk = ((t / 110) + 0.27) % 1
        const [x, y] = along([[2300, 30], [1200, 70], [400, 10], [-700, -20]], kk)
        PROPS.airship.anim(ctx, { x, y: y, base: y + 70 }, t)
      }

      // 7. cloud sea in front of the island roots
      for (const c of seaClouds) {
        const b = { x: c.x - c.w * 0.6, y: c.y - c.w * 0.45, w: c.w * 1.2, h: c.w * 0.65 }
        blit(cache.current.get(`sea${c.seed}`, b, 'lit', (cx) => cloudBank(cx, c.x, c.y, c.w, c.seed, false)), Math.sin(t * 0.05 + c.seed) * 20, 0)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />
}

