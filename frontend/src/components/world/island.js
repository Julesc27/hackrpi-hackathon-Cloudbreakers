// Draws the static body of a floating island: rocky underside, cloud nest, ground,
// paving, paths, crop fields, pools, decks and waterfall sheets.
import { PAL, col, poly, ellipse, circle, line, iso, rng, TAU, lit } from './iso.js'

const inside = (e, x, y, k = 1) => ((x - e[0]) / e[2]) ** 2 + ((y - e[1]) / e[3]) ** 2 < k

export function groundEdgeY(isl, x) {
  // lowest (front) ground edge directly below x
  let best = null
  for (const [cx, cy, rx, ry] of isl.ground) {
    const d = (x - cx) / rx
    if (Math.abs(d) >= 1) continue
    const y = cy + ry * Math.sqrt(1 - d * d)
    if (best === null || y > best) best = y
  }
  return best ?? isl.ground[0][1]
}

export function islandBounds(isl) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [cx, cy, rx, ry] of isl.ground) {
    x0 = Math.min(x0, cx - rx - 26); x1 = Math.max(x1, cx + rx + 26)
    y0 = Math.min(y0, cy - ry - 26); y1 = Math.max(y1, cy + ry + isl.depth + 30)
  }
  for (const w of isl.falls || []) y1 = Math.max(y1, groundEdgeY(isl, w.x) + w.len + 20)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function cloudPuff(ctx, x, y, r, shade = 1) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, r * 0.1, x, y, r)
  g.addColorStop(0, col(PAL.cloud))
  g.addColorStop(0.55, col(PAL.cloudMid))
  g.addColorStop(1, col(shade > 0.5 ? PAL.cloudShade : PAL.cloudDeep))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
}

/** A drifting cloud bank made of puffs. */
export function cloudBank(ctx, x, y, w, seed = 1, dim = false) {
  const r = rng(seed)
  const n = 6 + Math.floor(r() * 4)
  const g = ctx.createRadialGradient(x, y, 1, x, y, w * 0.6)
  ellipse(ctx, x, y + w * 0.06, w * 0.52, w * 0.12, col(dim ? PAL.cloudDeep : PAL.cloudShade))
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const arch = Math.sin(t * Math.PI)
    const px = x + (t - 0.5) * w * 0.85
    const py = y - arch * w * 0.16 + r() * w * 0.04
    cloudPuff(ctx, px, py, w * (0.13 + arch * 0.12 + r() * 0.05), dim ? 0 : 1)
  }
  return g
}

function boundaryPoints(isl, step = 7) {
  const pts = []
  isl.ground.forEach((e, i) => {
    const [cx, cy, rx, ry] = e
    const n = Math.max(12, Math.round((2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)) / step))
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry
      if (isl.ground.some((o, j) => j !== i && inside(o, x, y, 0.94))) continue
      pts.push({ x, y, a, nx: Math.cos(a), ny: Math.sin(a) })
    }
  })
  return pts
}

function rockBody(ctx, isl, r) {
  for (const [cx, cy, rx, ry] of isl.ground) {
    const depth = isl.depth * (0.45 + 0.55 * (rx / isl.ground[0][2]))
    const tipX = cx + (r() - 0.5) * rx * 0.3
    const g = ctx.createLinearGradient(0, cy, 0, cy + depth)
    g.addColorStop(0, col(PAL.rockLight)); g.addColorStop(0.18, col(PAL.rock)); g.addColorStop(0.7, col(PAL.rockMid)); g.addColorStop(1, col(PAL.rockDark))
    ctx.beginPath()
    ctx.moveTo(cx - rx, cy + 3)
    // jagged lower outline: a sequence of hanging spikes
    const n = 7 + Math.floor(rx / 30)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = cx - rx + t * rx * 2
      const env = Math.sin(t * Math.PI) ** 0.8
      const base = cy + 3 + env * depth * (0.55 + 0.45 * (1 - Math.abs(x - tipX) / rx))
      const spike = i % 2 ? base : base - depth * (0.12 + r() * 0.1) * env
      ctx.lineTo(x, spike)
    }
    ctx.lineTo(cx + rx, cy + 3)
    ctx.ellipse(cx, cy + 3, rx, ry, 0, 0, Math.PI, false)
    ctx.closePath()
    ctx.fillStyle = g; ctx.fill()
    // lit left facets + cracks
    ctx.save(); ctx.clip()
    const lg = ctx.createLinearGradient(cx - rx, 0, cx, 0)
    lg.addColorStop(0, col('#a8acec', 0.45)); lg.addColorStop(1, col('#a8acec', 0))
    ctx.fillStyle = lg; ctx.fillRect(cx - rx, cy, rx, depth)
    for (let i = 0; i < rx / 12; i++) {
      const x = cx - rx + r() * rx * 2, y = cy + ry * 0.6 + r() * depth * 0.6
      line(ctx, x, y, x + (r() - 0.5) * 6, y + 8 + r() * 18, col(PAL.rockDark, 0.6), 0.8)
    }
    ctx.restore()
  }
}

function deck(ctx, d) {
  const q = (u, v, z = 0) => iso(d.x, d.y, u, v, z)
  const A = d.a / 2, B = d.b / 2, t = 4
  // stilts down into the clouds
  for (const [u, v] of [[-A + 4, B - 3], [A - 4, B - 3], [A - 4, -B + 4], [0, B - 3], [-A + 4, 0]]) {
    const p = q(u, v)
    ctx.fillStyle = col('#5e3a1c'); ctx.fillRect(p[0] - 1.8, p[1], 3.6, d.legs || 70)
  }
  poly(ctx, [q(-A, B), q(A, B), q(A, B, -t), q(-A, B, -t)].map(([x, y]) => [x, y]), col('#7a4d26'))
  poly(ctx, [q(A, B), q(A, -B), q(A, -B, -t), q(A, B, -t)], col('#5e3a1c'))
  poly(ctx, [q(-A, -B), q(A, -B), q(A, B), q(-A, B)], col('#a8743f'), col('#5e3a1c'), 0.8)
  for (let i = 1; i < d.a / 5; i++) {
    const u = -A + i * 5
    line(ctx, ...q(u, -B), ...q(u, B), col('#7a4d26', 0.8), 0.6)
  }
  // rails along the front edges
  for (const [[u1, v1], [u2, v2]] of [[[-A, B], [A, B]], [[A, B], [A, -B]]]) {
    const n = Math.round(Math.hypot(u2 - u1, v2 - v1) / 8)
    for (let i = 0; i <= n; i++) { const p = q(u1 + (u2 - u1) * i / n, v1 + (v2 - v1) * i / n); line(ctx, p[0], p[1], p[0], p[1] - 6, col('#5e3a1c'), 1.2, 'butt') }
    const a1 = q(u1, v1, 6), a2 = q(u2, v2, 6)
    line(ctx, a1[0], a1[1], a2[0], a2[1], col('#c99a5e'), 1.2)
  }
}

function paved(ctx, p, r) {
  if (p.type === 'ellipse') {
    ellipse(ctx, p.x, p.y + 2.5, p.rx, p.ry, col(p.edge || PAL.pathEdge))
    ellipse(ctx, p.x, p.y, p.rx, p.ry, col(p.fill || PAL.stone))
    // flagstone joints
    ctx.save(); ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); ctx.clip()
    ctx.strokeStyle = col('#c9b894', 0.55); ctx.lineWidth = 0.5
    for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx * k / 5, p.ry * k / 5, 0, 0, TAU); ctx.stroke() }
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; line(ctx, p.x + Math.cos(a) * p.rx * 0.2, p.y + Math.sin(a) * p.ry * 0.2, p.x + Math.cos(a) * p.rx, p.y + Math.sin(a) * p.ry, col('#c9b894', 0.45), 0.5) }
    ctx.restore()
  } else if (p.type === 'tier') {
    // a raised round terrace with a low wall (New Haven's central plaza)
    const h = p.h || 8
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI); ctx.lineTo(p.x - p.rx, p.y - h); ctx.ellipse(p.x, p.y - h, p.rx, p.ry, 0, Math.PI, 0, true); ctx.closePath()
    const g = ctx.createLinearGradient(p.x - p.rx, 0, p.x + p.rx, 0)
    g.addColorStop(0, col('#efe6d4')); g.addColorStop(0.65, col('#d4c7ab')); g.addColorStop(1, col('#b3a68a'))
    ctx.fillStyle = g; ctx.fill()
    // stone blocks
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI; const x = p.x + Math.cos(a) * p.rx, y = p.y + Math.sin(a) * p.ry; line(ctx, x, y, x, y - h, col('#b8aa8c', 0.6), 0.5) }
    ellipse(ctx, p.x, p.y - h, p.rx, p.ry, col(PAL.stone), col('#c9b894'), 0.6)
    ctx.save(); ctx.beginPath(); ctx.ellipse(p.x, p.y - h, p.rx, p.ry, 0, 0, TAU); ctx.clip()
    ctx.strokeStyle = col('#cdbd99', 0.55); ctx.lineWidth = 0.5
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.ellipse(p.x, p.y - h, p.rx * k / 4, p.ry * k / 4, 0, 0, TAU); ctx.stroke() }
    ctx.restore()
    // balustrade along the front rim
    for (let k = 1; k < 30; k++) {
      const a = k / 30 * Math.PI
      const x = p.x + Math.cos(a) * p.rx, y = p.y - h + Math.sin(a) * p.ry
      line(ctx, x, y, x, y - 4, col('#f3ecdd'), 1.2, 'butt')
    }
    ctx.beginPath(); ctx.ellipse(p.x, p.y - h - 4, p.rx, p.ry, 0, 0, Math.PI); ctx.strokeStyle = col('#f6f0e2'); ctx.lineWidth = 1.4; ctx.stroke()
    if (p.stairs) {
      const [sx, sy] = p.stairs
      for (let i = 0; i < 4; i++) poly(ctx, [[sx - 9 + i * 1.5, sy - i * 2], [sx + 9 + i * 1.5, sy + 4 - i * 2], [sx + 9 + i * 1.5, sy + 2 - i * 2], [sx - 9 + i * 1.5, sy - 2 - i * 2]], col(i % 2 ? '#e8dcc4' : '#d4c7ab'))
    }
  } else if (p.type === 'path') {
    const stroke = (w, c) => {
      ctx.beginPath(); ctx.moveTo(p.pts[0][0], p.pts[0][1])
      for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i][0], p.pts[i][1])
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
    }
    stroke((p.w || 9) + 2.5, col(PAL.pathEdge))
    stroke(p.w || 9, col(PAL.path))
    // cobbles
    for (let i = 1; i < p.pts.length; i++) {
      const [x1, y1] = p.pts[i - 1], [x2, y2] = p.pts[i]
      const n = Math.round(Math.hypot(x2 - x1, y2 - y1) / 5)
      for (let k = 0; k < n; k++) {
        const t = k / n
        circle(ctx, x1 + (x2 - x1) * t + (r() - 0.5) * (p.w || 9) * 0.6, y1 + (y2 - y1) * t + (r() - 0.5) * 3, 0.7, col('#d6c39d', 0.8))
      }
    }
  } else if (p.type === 'crops') {
    const q = (u, v) => iso(p.x, p.y, u, v, 0)
    const A = p.a / 2, B = p.b / 2
    poly(ctx, [q(-A, -B), q(A, -B), q(A, B), q(-A, B)], col('#7a5236'))
    poly(ctx, [q(-A, B), q(A, B), [q(A, B)[0], q(A, B)[1] + 2], [q(-A, B)[0], q(-A, B)[1] + 2]], col('#5e3d25'))
    const rows = Math.max(2, Math.round(p.b / 6))
    const cs = p.colors || ['#5fae4f', '#7cc96a', '#a5c94f']
    for (let i = 0; i < rows; i++) {
      const v = -B + (i + 0.5) * (p.b / rows)
      const n = Math.round(p.a / 4)
      for (let k = 0; k < n; k++) {
        const c = q(-A + (k + 0.5) * (p.a / n), v)
        circle(ctx, c[0], c[1] - 1.5, 1.9, col(cs[(i + k) % cs.length]))
      }
    }
  } else if (p.type === 'pool') {
    ellipse(ctx, p.x, p.y + 2.5, p.rx + 3, p.ry + 1.5, col(PAL.stoneSide))
    ellipse(ctx, p.x, p.y, p.rx + 3, p.ry + 1.5, col(PAL.stone))
    const g = ctx.createRadialGradient(p.x - p.rx * 0.3, p.y - p.ry * 0.3, 1, p.x, p.y, p.rx)
    g.addColorStop(0, col(PAL.waterLight)); g.addColorStop(1, col(PAL.water))
    ellipse(ctx, p.x, p.y, p.rx, p.ry, g)
  } else if (p.type === 'deck') {
    deck(ctx, p)
  }
}

/** Static body of the island, cached as a bitmap by the renderer. */
export function drawIslandBase(ctx, isl) {
  const r = rng(isl.seed || 7)
  const pts = boundaryPoints(isl, 13)
  const scale = Math.min(1.3, Math.max(0.7, isl.ground[0][2] / 180))

  // 1. clouds behind the island (top half of the rim)
  for (const p of pts) {
    if (p.ny > 0.15 || r() < 0.3) continue
    cloudPuff(ctx, p.x + p.nx * 8, p.y + p.ny * 3 + 4, (8 + r() * 13) * scale, 1)
  }
  // 2. rocky underside, then a skirt of under-clouds
  rockBody(ctx, isl, r)
  for (const [cx, cy, rx, ry] of isl.ground) {
    for (let i = 0; i < Math.max(2, rx / 45); i++) {
      cloudPuff(ctx, cx + (r() - 0.5) * rx * 1.6, cy + ry * 0.8 + isl.depth * (0.35 + r() * 0.45), (12 + r() * 16) * scale, 0)
    }
  }
  // 3. waterfall sheets (animated streaks are drawn on top every frame)
  for (const w of isl.falls || []) {
    const y0 = groundEdgeY(isl, w.x) - 3
    const g = ctx.createLinearGradient(0, y0, 0, y0 + w.len)
    g.addColorStop(0, col('#d6f0ff', 0.95)); g.addColorStop(0.5, col('#7cc3ff', 0.8)); g.addColorStop(1, col('#7cc3ff', 0))
    ctx.fillStyle = g
    ctx.beginPath(); ctx.moveTo(w.x - w.w / 2, y0); ctx.lineTo(w.x + w.w / 2, y0); ctx.lineTo(w.x + w.w / 2 + 3, y0 + w.len); ctx.lineTo(w.x - w.w / 2 - 3, y0 + w.len); ctx.closePath(); ctx.fill()
  }
  // 4. ground: an earthy lip, then grass
  for (const [cx, cy, rx, ry] of isl.ground) ellipse(ctx, cx, cy + 5, rx, ry, col(isl.material === 'stone' ? PAL.stoneDark : PAL.grassEdge))
  for (const [cx, cy, rx, ry] of isl.ground) {
    const g = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 2, cx, cy, rx)
    g.addColorStop(0, col(PAL.grassLight)); g.addColorStop(0.6, col(PAL.grass)); g.addColorStop(1, col(PAL.grassDark))
    ellipse(ctx, cx, cy, rx, ry, g)
  }
  // grass texture
  ctx.save()
  ctx.beginPath(); for (const [cx, cy, rx, ry] of isl.ground) { ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU) }
  ctx.clip()
  const [bx, by, bw, bh] = (() => { const b = islandBounds(isl); return [b.x, b.y, b.w, b.h] })()
  for (let i = 0; i < (bw * bh) / 90; i++) {
    const x = bx + r() * bw, y = by + r() * bh
    if (!isl.ground.some((e) => inside(e, x, y, 0.92))) continue
    const k = r()
    if (k < 0.55) { line(ctx, x, y, x - 1, y - 2.4, col(PAL.grassDark, 0.8), 0.6); line(ctx, x, y, x + 1, y - 2.2, col(PAL.grassDark, 0.8), 0.6) }
    else if (k < 0.85) circle(ctx, x, y, 0.8, col(PAL.grassLight, 0.8))
    else circle(ctx, x, y, 0.7, col(['#ffd66b', '#ffffff', '#ff9ab0'][Math.floor(r() * 3)], 0.9))
  }
  ctx.restore()

  // 5. paving, paths, fields, pools, decks
  for (const p of isl.paved || []) paved(ctx, p, r)

  // 6. clouds in front of the rim (lower half)
  // clumps of cloud along the front rim, with gaps where the rock lip shows
  let run = 0
  for (const p of pts) {
    if (p.ny <= 0.15) continue
    if (run <= 0 && r() < 0.35) { run = 1 + Math.floor(r() * 3); continue }
    run--
    const big = r() < 0.25
    cloudPuff(ctx, p.x + p.nx * 9, p.y + p.ny * 7 + 6, (big ? 15 + r() * 8 : 7 + r() * 8) * scale, 1)
  }
}

/** Animated parts of the base: waterfall streaks, mist and pool ripples. */
export function animIslandBase(ctx, isl, t) {
  if (!lit()) return
  for (const w of isl.falls || []) {
    const y0 = groundEdgeY(isl, w.x) - 2
    for (let j = 0; j < 4; j++) {
      const x = w.x - w.w / 2 + (w.w * (j + 0.5)) / 4
      const sp = 0.8 + j * 0.23
      for (let k = 0; k < 3; k++) {
        const ph = ((t * sp + k / 3 + j * 0.17) % 1)
        const y = y0 + ph * w.len
        line(ctx, x + ph * 2, y, x + ph * 2, y + w.len * 0.12, `rgba(255,255,255,${0.75 * (1 - ph)})`, Math.max(0.8, w.w * 0.08))
      }
    }
    // spray at the lip
    for (let k = 0; k < 3; k++) {
      const ph = (t * 1.2 + k / 3) % 1
      circle(ctx, w.x + (k - 1) * w.w * 0.3, y0 + 2 - ph * 3, 1.2 + ph * 2, `rgba(255,255,255,${0.5 * (1 - ph)})`)
    }
  }
  for (const p of isl.paved || []) {
    if (p.type !== 'pool') continue
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.35 + i * 0.5) % 1
      ctx.beginPath(); ctx.ellipse(p.x + p.rx * 0.15, p.y, p.rx * k, p.ry * k, 0, 0, TAU)
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; ctx.lineWidth = 0.8; ctx.stroke()
    }
  }
}
