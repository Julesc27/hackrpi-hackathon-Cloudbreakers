import { useEffect, useRef } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { STARTER_BEACON, INTERACTION_POINTS } from '../../game/mapLayout.js'
import { ISLANDS, BUILDINGS } from '../../game/data.js'
import { islandAccess, openRoutes } from '../../game/engine.js'
import { WORLD } from '../map/Camera.jsx'
import { TWINKLE_STARS } from '../map/Backdrop.jsx'
import { WORLD_ISLANDS, FAR_ISLETS, bridgeMid } from './layout.js'
import { PAINTED_ISLANDS, buildingSprite, PAINTED_ATLASES, getPaintedAtlas } from './paintedArt.js'
import { PROPS } from './props.js'
import { drawIslandBase, animIslandBase, islandBounds, cloudBank } from './island.js'
import { Crowd, drawPerson, personLight } from './people.js'
import { drawBridge, drawPrismGateway } from './bridge.js'
import { buildingLayout } from './buildingLayout.js'
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

/* ---------------- bitmap cache ----------------
 * Anything that looks the same from frame to frame (islands, buildings, clouds, props) is drawn
 * once into an offscreen canvas at roughly the current screen resolution and then just copied.
 * - Entries are keyed by zoom level, so zooming in re-renders sharper copies.
 * - New copies are rendered within a small time budget per frame; when the budget is spent, the
 *   previous zoom level's copy is reused for a frame or two instead of stalling the game.
 * - Copies are never rendered sharper than their source image (maxScale), which keeps memory bounded.
 * - Entries that haven't been drawn for a while are dropped. */
class SpriteCache {
  constructor() { this.map = new Map(); this.latest = new Map(); this.bucket = 1; this.frame = 0; this.deadline = 0 }
  setBucket(ppu) {
    this.bucket = Math.min(4, Math.max(0.5, 2 ** (Math.ceil(Math.log2(ppu) * 2) / 2)))
  }
  beginFrame() {
    this.frame++
    this.deadline = performance.now() + 6
    this.rendered = 0
    if (this.frame % 120 === 0) {
      for (const [k, c] of this.map) {
        if (this.frame - c.used > 300) {
          this.map.delete(k)
          if (this.latest.get(c.base) === c) this.latest.delete(c.base)
        }
      }
    }
  }
  get(key, bounds, mode, draw, maxScale = Infinity) {
    const base = `${key}|${mode}`
    const s = Math.min(this.bucket, Math.max(0.5, maxScale))
    const k = `${base}|${s}`
    let c = this.map.get(k)
    if (!c) {
      const prev = this.latest.get(base)
      if (this.rendered > 0 && performance.now() > this.deadline) {
        // Out of time this frame (always allow at least one render so it keeps progressing):
        // reuse an older copy, or skip it for a frame and draw it next frame
        if (prev) { prev.used = this.frame; return prev }
        return null
      }
      this.rendered++
      const cv = document.createElement('canvas')
      cv.width = Math.max(1, Math.ceil(bounds.w * s)); cv.height = Math.max(1, Math.ceil(bounds.h * s))
      const cx = cv.getContext('2d')
      cx.scale(s, s); cx.translate(-bounds.x, -bounds.y)
      cx.imageSmoothingEnabled = true
      cx.imageSmoothingQuality = 'high'
      setMode(mode)
      draw(cx)
      setMode('lit')
      c = { cv, b: bounds, used: 0, base }
      this.map.set(k, c)
      this.latest.set(base, c)
    }
    c.used = this.frame
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

/* ---------------- the component ---------------- */
export default function WorldCanvas({ hoverRef }) {
  const { state } = useGame()
  const ui = useUI()
  const canvasRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const uiRef = useRef(ui)
  uiRef.current = ui
  const cache = useRef(new SpriteCache())
  const crowd = useRef(new Crowd())
  const originalBuildings = useRef(new Set(state.buildings.map((b) => b.id)))

  // Residents follow the walkable paths of every island you can reach. Their number grows with
  // the population, and new buildings and bridges change where they can go.
  useEffect(() => {
    const access = islandAccess(state)
    const reachable = Object.keys(access).filter((k) => access[k] && state.connected.includes(k)).length
    const target = Math.max(6, Math.min(48, Math.round(state.population * 1.4) + reachable * 3))
    crowd.current.setState(state, access, target)
  }, [state.bridges, state.connected, state.population, state.buildings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cv = canvasRef.current
    const ctx = cv.getContext('2d')
    const atlases = Object.fromEntries(Object.keys(PAINTED_ATLASES).map((sheet) => [sheet, getPaintedAtlas(sheet)]))
    const appeared = new Map()
    const bridgeAppeared = new Map(stateRef.current.bridges.map((b) => [b.route, -1000]))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0, W = 0, H = 0, dpr = 1
    // Adaptive quality: if this device can't hold a smooth frame rate, render the canvas at 1x
    // pixel density and run the ambient animation (clouds, glints, bobbing) at 30 fps. Camera
    // moves are always drawn immediately so dragging and zooming stay responsive.
    let lowQuality = false, slowFor = 0, fastFor = 0, avgDt = 16, prevNow = 0
    const resize = () => {
      dpr = lowQuality ? 1 : Math.min(1.75, window.devicePixelRatio || 1)
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
      for (let i = 0; i < 14; i++) {
        const edge = i % 4
        let x, y
        if (edge === 0) { x = WORLD.x + r() * WORLD.w; y = WORLD.y + 40 + r() * 280 }
        else if (edge === 1) { x = WORLD.x + 40 + r() * 420; y = WORLD.y + r() * WORLD.h }
        else if (edge === 2) { x = 1600 + r() * 460; y = WORLD.y + r() * WORLD.h }
        else { x = WORLD.x + r() * WORLD.w; y = 880 + r() * 180 }
        out.push({ x, y, w: 220 + r() * 280, seed: i + 3, sp: 0.015 + r() * 0.025, ph: r() * 6, a: 0.12 + r() * 0.12 })
      }
      // soft banks tucked between the islands so the town sits in a cloud sea, not empty navy
      const gaps = [[520, 560, 340], [980, 580, 360], [250, 620, 300], [1360, 600, 320], [760, 820, 420], [1100, 360, 260], [430, 360, 240]]
      gaps.forEach(([x, y, w], i) => out.push({ x, y, w, seed: 40 + i, sp: 0.02, ph: i, a: 0.18, mid: true }))
      return out
    })()
    const seaClouds = [] // Painted island edges provide the foreground clouds without obscuring plots.
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

    let lastDraw = 0, lastView = '', lastSim = 0
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const dt = prevNow ? Math.min(250, now - prevNow) : 16
      prevNow = now
      avgDt = avgDt * 0.92 + dt * 0.08
      if (!lowQuality && avgDt > 24) { if ((slowFor += dt) > 2000) { lowQuality = true; slowFor = 0; resize() } } else slowFor = 0
      if (lowQuality && avgDt < 15) { if ((fastFor += dt) > 6000) { lowQuality = false; fastFor = 0; resize() } } else fastFor = 0

      const camNow = uiRef.current.camera.current?.view?.()
      const viewKey = camNow ? `${camNow.x.toFixed(1)},${camNow.y.toFixed(1)},${camNow.s.toFixed(4)}` : ''
      const moved = viewKey !== lastView
      // While a full-screen dialog covers the map (it has a blurred backdrop), the map only needs
      // to tick slowly: every redraw underneath forces the browser to re-blur the whole screen.
      const minGap = document.querySelector('.modal-backdrop') ? 100 : lowQuality && !moved ? 32 : 0
      if (minGap && now - lastDraw < minGap) return
      lastDraw = now
      lastView = viewKey
      // Resident travel is part of the living town. Reduced motion only pauses
      // decorative effects; it must not stop residents from following their paths.
      crowd.current.update(lastSim ? (now - lastSim) / 1000 : 0)
      lastSim = now
      const t = reducedMotion.matches ? 0 : now / 1000
      const cam = uiRef.current.camera.current
      if (!cam?.view || !W) return
      const v = cam.view()
      const st = stateRef.current
      const access = islandAccess(st)
      cache.current.setBucket(v.s * dpr)
      cache.current.beginFrame()

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)

      // 0. twinkling stars, in screen space so they drift with the slow sky layer behind
      {
        const off = cam.farOffset ? cam.farOffset() : { x: 0, y: 0 }
        const pw = W * 1.36, ph = H * 1.36
        for (const st of TWINKLE_STARS) {
          let sx = (st.fx * pw - W * 0.18 + off.x) % pw, sy = st.fy * ph - H * 0.18 + off.y
          if (sx < -8) sx += pw
          if (sx > W + 8 || sy < -8 || sy > H + 8) continue
          const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp * TAU + st.d))
          if (st.bright) {
            ctx.globalAlpha = a
            ctx.strokeStyle = 'rgba(255,246,216,.75)'; ctx.lineWidth = 0.6 * dpr
            ctx.beginPath(); ctx.moveTo(sx * dpr, (sy - 7) * dpr); ctx.lineTo(sx * dpr, (sy + 7) * dpr); ctx.moveTo((sx - 7) * dpr, sy * dpr); ctx.lineTo((sx + 7) * dpr, sy * dpr); ctx.stroke()
          }
          glow(ctx, sx * dpr, sy * dpr, (st.bright ? 4.5 : st.r * 2.2) * dpr, '#fffaf0', st.bright ? a : a * 0.85)
          ctx.globalAlpha = 1
        }
      }
      const k = v.s * dpr
      ctx.setTransform(k, 0, 0, k, dpr * (v.x - WORLD.x * v.s), dpr * (v.y - WORLD.y * v.s))
      const vx0 = WORLD.x - v.x / v.s, vy0 = WORLD.y - v.y / v.s, vx1 = vx0 + W / v.s, vy1 = vy0 + H / v.s
      const visible = (b) => b.x < vx1 && b.x + b.w > vx0 && b.y < vy1 && b.y + b.h > vy0
      const blit = (c, dx = 0, dy = 0, alpha = 1) => {
        if (!c) return
        if (!visible({ x: c.b.x + dx, y: c.b.y + dy, w: c.b.w, h: c.b.h })) return
        if (alpha !== 1) ctx.globalAlpha = alpha
        ctx.drawImage(c.cv, c.b.x + dx, c.b.y + dy, c.b.w, c.b.h)
        if (alpha !== 1) ctx.globalAlpha = 1
      }

      // 1. far sky: drifting cloud banks + distant hazy islets
      for (const c of backClouds) {
        if (c.mid) continue
        const b = { x: c.x - c.w * 0.6, y: c.y - c.w * 0.5, w: c.w * 1.2, h: c.w * 0.75 }
        const sp = cache.current.get(`bank${c.seed}`, b, 'lit', (cx) => cloudBank(cx, c.x, c.y, c.w, c.seed, true))
        blit(sp, Math.sin(t * c.sp + c.ph) * 36, 0, c.a)
      }
      FAR_ISLETS.forEach(({ x, y, width, cell, opacity }, i) => {
        const atlas = atlases.background
        if (!atlas.ready) return
        const bounds = atlas.cells[cell]
        const height = width * bounds[3] / bounds[2]
        const bob = reducedMotion.matches ? 0 : Math.sin(t * (.19 + i % 3 * .035) + i * 1.7) * Math.min(3, width * .015)
        const box = { x: x - width / 2, y: y - height * .4 + bob, w: width, h: height }
        if (!visible(box)) return
        ctx.save()
        ctx.globalAlpha = opacity
        atlas.draw(ctx, cell, box.x, box.y, width, height)
        ctx.restore()
      })
      for (const c of backClouds) {
        if (!c.mid) continue
        const b = { x: c.x - c.w * 0.6, y: c.y - c.w * 0.5, w: c.w * 1.2, h: c.w * 0.75 }
        const sp = cache.current.get(`mid${c.seed}`, b, 'lit', (cx) => cloudBank(cx, c.x, c.y, c.w, c.seed, false))
        blit(sp, Math.sin(t * c.sp + c.ph) * 18, Math.sin(t * 0.4 + c.ph) * 2, c.a)
      }

      // Each island is an independent transparent painting, with its own state and motion.
      const order = Object.values(WORLD_ISLANDS).sort((a, b) => a.ground[0][1] - b.ground[0][1])
      for (const isl of order) {
        const mode = islandMode(isl.id, st, access)
        const bob = Math.sin(t * 0.55 + isl.seed) * 2.2
        isl._bob = bob
        const art = PAINTED_ISLANDS[isl.id], atlas = atlases[art.sheet]
        if (atlas.ready) {
          const [x, y, width, height] = art.rect
          if (!visible({ x, y, w: width, h: height })) continue
          // Cached copy at screen resolution; the hidden/hover colour filters are baked in once
          // instead of being re-run over the full painting every frame.
          const variant = mode === 'hidden' ? 'hidden' : hoverRef?.current === isl.id ? 'hover' : 'plain'
          const src = atlas.cells[art.cell]
          const srcScale = src ? src[2] / width : 1
          const alpha = mode === 'hidden' ? 0.28 : mode === 'locked' ? 0.86 : 1
          if (variant === 'plain' && v.s * dpr >= srcScale * 0.95) {
            // Zoomed in past the painting's own resolution: enlarging straight from the source is
            // cheap and sharper than going through a cached copy (which would resample twice).
            ctx.save()
            ctx.imageSmoothingQuality = 'high'
            ctx.globalAlpha = alpha
            atlas.draw(ctx, art.cell, x, y + bob, width, height)
            ctx.restore()
          } else {
            const sp = cache.current.get(`isl:${isl.id}`, { x, y, w: width, h: height }, variant, (cx) => {
              if (variant === 'hidden') cx.filter = 'saturate(0.3)'
              else if (variant === 'hover') cx.filter = 'brightness(1.09)'
              atlas.draw(cx, art.cell, x, y, width, height)
            }, srcScale)
            blit(sp, 0, bob, alpha)
          }
          if (mode !== 'hidden') {
            ctx.save(); ctx.translate(0, bob)
            // Animated glints, water ripples and falling spray live above the painted surface.
            if (isl.id === 'rain' || isl.id === 'newHaven') {
              const wx = isl.id === 'newHaven' ? 982 : 1210
              const wy = isl.id === 'newHaven' ? 712 : 275
              for (let i = 0; i < 7; i++) {
                const phase = (t * 0.5 + i / 7) % 1
                line(ctx, wx + Math.sin(i * 7) * 7, wy + phase * 82, wx + Math.sin(i * 7) * 7, wy + phase * 82 + 10, `rgba(173,235,255,${Math.sin(phase * Math.PI) * 0.35})`, 1)
              }
            }
            if (isl.id === 'prism') {
              glow(ctx, ...INTERACTION_POINTS.crystals, 28 + Math.sin(t * 1.7) * 5, '#80dfff', .16)
            }

            ctx.restore()
          }
        } else if (now > 2500) {
          // Keep the playable map available even if an asset is very slow or fails to load.
          const sp = cache.current.get(`isle:${isl.id}`, islandBounds(isl), mode, (cx) => drawIslandBase(cx, isl))
          blit(sp, 0, bob)
          if (mode === 'lit') { ctx.save(); ctx.translate(0, bob); animIslandBase(ctx, isl, t); ctx.restore() }
        }
      }

      // 3. Only player-built spans. Route buttons live in the interaction layer.
      const bridgeLights = []
      const spans = st.bridges.map(b => {
        if (!bridgeAppeared.has(b.route)) bridgeAppeared.set(b.route, now)
        const progress = reducedMotion.matches ? 1 : Math.min(1, (now - bridgeAppeared.get(b.route)) / 1300)
        return { b, progress }
      })
      setMode('lit')
      const crystalSpan = spans.find(({ b }) => b.route === 'prism-haven')
      if (crystalSpan) drawPrismGateway(ctx, crystalSpan.progress)
      for (const { b, progress } of spans) {
        setMode(b.condition <= 0 ? 'locked' : 'lit')
        drawBridge(ctx, b, t, bridgeLights, progress)
      }
      setMode('lit')
      if (crystalSpan) drawPrismGateway(ctx, crystalSpan.progress, true)

      // Pulsing rings around the "build a bridge" buttons. Drawn here rather than as a CSS
      // animation in the SVG overlay, which made the browser repaint the whole overlay every frame.
      if (!uiRef.current.placing && !reducedMotion.matches) {
        const uk = Math.min(1.15, (cam.fitScale || v.s) / v.s)
        const ph = (t / 2) % 1
        const rr = 27 * uk * (0.85 + ph * 0.55)
        ctx.lineWidth = 1.5 * uk
        ctx.strokeStyle = `rgba(243,217,143,${0.5 * (1 - ph)})`
        for (const r of openRoutes(st)) {
          const [mx, my] = bridgeMid(r.id)
          ctx.beginPath(); ctx.arc(mx, my, rr, 0, TAU); ctx.stroke()
        }
      }

      // 4. buildings, trees, props and residents, depth-sorted so buildings hide people behind them.
      const items = crowd.current.items()
      // far out, people are only a few pixels tall: draw a simple figure instead
      // (on a struggling device: half the crowd, and the simple figure unless zoomed right in)
      const personDetail = v.s * dpr * 14 >= (lowQuality ? 16 : 10)
      for (const isl of order) {
        const mode = islandMode(isl.id, st, access)
        if (atlases[PAINTED_ISLANDS[isl.id].sheet].ready) continue
        for (const p of isl.props) items.push({ y: p.pts ? Math.max(p.pts[0][1], p.pts[1][1]) : p.y, p, mode, bob: isl._bob })
      }
      for (const b of st.buildings) {
        if (b.slot < 0 || BUILDINGS[b.type].infrastructure || !st.connected.includes(b.island)) continue
        const p = buildingProp(b)
        if (p) items.push({ y: p.y, p, mode: access[b.island] ? 'lit' : 'locked', bob: WORLD_ISLANDS[b.island]._bob, fresh: b.id, buildingType: b.type, island: b.island, slot: b.slot })
      }
      items.sort((a, b) => a.y - b.y)
      const lights = []
      for (const it of items) {
        if (it.person) {
          const a = it.person
          if (lowQuality && a.id % 2) continue
          if (a.x < vx0 - 20 || a.x > vx1 + 20 || a.y + it.bob < vy0 - 4 || a.y + it.bob > vy1 + 36) continue
          ctx.save(); ctx.translate(0, it.bob); drawPerson(ctx, a, t, personDetail); ctx.restore()
          const l = personLight(a)
          if (l) lights.push([l[0], l[1] + it.bob, l[2]])
          continue
        }
        const p = it.p, def = PROPS[p.type]
        if (!def) continue
        const b = propBounds(p)
        if (!visible({ ...b, y: b.y + it.bob })) continue
        const sprite = it.buildingType ? buildingSprite(it.buildingType, it.slot) : null
        const buildingAtlas = sprite ? atlases[sprite.sheet] : null
        if (buildingAtlas?.ready && sprite.cell != null) {
          if (!appeared.has(it.fresh)) appeared.set(it.fresh, originalBuildings.current.has(it.fresh) ? now - 1000 : now)
          const progress = reducedMotion.matches ? 1 : Math.min(1, (now - appeared.get(it.fresh)) / 650)
          const scale = 1 - (1 - progress) ** 3
          const cell = sprite.cell
          const footprint = buildingLayout(it.buildingType, it.island, it.slot, buildingAtlas.cells[cell])
          const gw = footprint.groundWidth, gd = footprint.groundDepth
          const x0 = Math.min(footprint.x, -gw - 5), y0 = Math.min(footprint.y, 1 - gd - 5)
          const x1 = Math.max(footprint.x + footprint.width, gw + 5), y1 = Math.max(footprint.y + footprint.height, 1 + gd + 5)
          const bnd = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
          const src = buildingAtlas.cells[cell]
          const srcScale = src ? src[2] / footprint.width : 1
          const key = `${sprite.sheet}:${cell}:${it.island}:${it.slot}:${footprint.width}:${footprint.height}`
          // The soft ground shadow needs a blur, so it is rendered once and reused.
          const shadow = cache.current.get(`bshadow:${key}`, bnd, 'plain', (cx) => {
            cx.filter = 'blur(2px)'
            ellipse(cx, 0, 1, gw, gd, 'rgba(48,39,27,.22)')
          }, 1)
          ctx.save(); ctx.translate(p.x, p.y + it.bob); ctx.scale(scale, scale)
          if (shadow) ctx.drawImage(shadow.cv, bnd.x, bnd.y, bnd.w, bnd.h)
          if (v.s * dpr >= srcScale * 0.95) {
            // zoomed in past the sprite's resolution: draw from the source (sharper, and cheap when enlarging)
            ctx.imageSmoothingQuality = 'high'
            buildingAtlas.draw(ctx, cell, footprint.x, footprint.y, footprint.width, footprint.height)
          } else {
            const fb = { x: footprint.x, y: footprint.y, w: footprint.width, h: footprint.height }
            const sp = cache.current.get(`bld:${key}`, fb, 'plain', (cx) => {
              buildingAtlas.draw(cx, cell, footprint.x, footprint.y, footprint.width, footprint.height)
            }, srcScale)
            if (sp) ctx.drawImage(sp.cv, fb.x, fb.y, fb.w, fb.h)
          }
          ctx.restore()
        } else if (b.w > 1) blit(cache.current.get(propKey(p), b, it.mode, (cx) => def.draw(cx, p)), 0, it.bob)
        if (def.anim && it.mode !== 'hidden' && !buildingAtlas?.ready) {
          setMode(it.mode)
          ctx.save(); ctx.translate(0, it.bob); def.anim(ctx, p, t, { beacon: st.beaconRestored }); ctx.restore()
          setMode('lit')
        }
        // Painted windows already contain their light. Procedural house lights are
        // much lower than the painted windows and otherwise put a yellow halo under the walls.
        if (it.mode === 'lit' && def.lights && !buildingAtlas?.ready) for (const l of def.lights(p)) lights.push([l[0], l[1] + it.bob, l[2]])
      }

      for (const isl of order) {
        if (islandMode(isl.id, st, access) !== 'lit') continue
        for (const p of isl.props.filter((p) => p.type === 'lamp')) lights.push([p.x, p.y - 16 + isl._bob, 14])
      }
      // 5. warm cream/gold light: windows, lamps, the beacon, bridge lanterns
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (const l of bridgeLights) lights.push(l)
      for (const [x, y, r] of lights) {
        if (x < vx0 - r || x > vx1 + r || y < vy0 - r || y > vy1 + r) continue
        const f = 0.85 + Math.sin(t * 7 + x * 0.3) * 0.05 + Math.sin(t * 13 + y) * 0.04
        glow(ctx, x, y, r * f, PAL.glow, 0.32)
      }
      if (st.beaconRestored) {
        const [cx, cy] = STARTER_BEACON
        ctx.translate(0, WORLD_ISLANDS.newHaven._bob)
        glow(ctx, cx, cy + 78, 120, '#fff3c4', 0.22)
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
        PROPS.airship.anim(ctx, { x, y, width: 104 }, t)
      }

      // 7. cloud sea in front of the island roots, then a soft navy vignette in screen space
      for (const c of seaClouds) {
        const b = { x: c.x - c.w * 0.6, y: c.y - c.w * 0.5, w: c.w * 1.2, h: c.w * 0.78 }
        blit(cache.current.get(`sea${c.seed}`, b, 'lit', (cx) => cloudBank(cx, c.x, c.y, c.w, c.seed, false)), Math.sin(t * 0.05 + c.seed) * 22, 0)
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      // (the soft navy vignette is a static CSS layer, .world-vignette, instead of a per-frame full-screen draw)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />
      <div className="world-vignette" aria-hidden="true" />
    </>
  )
}

