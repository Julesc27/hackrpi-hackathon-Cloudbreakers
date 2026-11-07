// Drawing routines for everything that stands on an island.
// Each prop type has:
//   draw(ctx, p)          static look (cached into a bitmap per zoom level)
//   anim?(ctx, p, t, env) parts that move every frame (blades, flags, water, smoke…)
//   lights?(p)            warm light sources for the glow pass when the island is lit
//   size                  [halfWidth, heightAbove, depthBelow] for the bitmap cache
import { PAL, col, poly, ellipse, circle, line, glow, box, iso, at, lit, rng, TAU } from './iso.js'

const EDGE = 'rgba(28,24,60,.30)'

/* ---------------------------------------------------------------- trees */
function tree(ctx, p) {
  const s = p.s || 1
  const tone = p.tone || 0
  ellipse(ctx, p.x, p.y + 1, 8 * s, 3.2 * s, 'rgba(18,24,60,.22)')
  line(ctx, p.x, p.y, p.x, p.y - 9 * s, col(PAL.woodDark), 2.4 * s, 'butt')
  line(ctx, p.x - 0.6 * s, p.y - 2 * s, p.x - 0.6 * s, p.y - 8 * s, col('#a87445', 0.55), 0.8 * s)
  if (p.kind === 'round') {
    const d = [PAL.leafDark, '#2f6b40', '#345f30'][tone % 3]
    const m = [PAL.leaf, '#4ea862', '#5aaa48'][tone % 3]
    const l = [PAL.leafLight, '#8ed48a', '#c6e98a'][tone % 3]
    circle(ctx, p.x + 1.2 * s, p.y - 12 * s, 8.2 * s, col(d))
    circle(ctx, p.x - 4.2 * s, p.y - 15 * s, 7.2 * s, col(d))
    circle(ctx, p.x + 4.6 * s, p.y - 16 * s, 6.4 * s, col(m))
    circle(ctx, p.x - 1.2 * s, p.y - 19 * s, 6.6 * s, col(m))
    circle(ctx, p.x + 2.2 * s, p.y - 21 * s, 4.4 * s, col(l))
    circle(ctx, p.x - 3.4 * s, p.y - 20 * s, 2.4 * s, col('#e8f6c8', 0.85))
  } else {
    const d = [PAL.pine, '#2c5e46', '#2e5a40'][tone % 3]
    const l = [PAL.pineLight, '#3f7f58', '#4d8a54'][tone % 3]
    for (let i = 0; i < 3; i++) {
      const y0 = p.y - (6 + i * 7) * s, w = (9 - i * 2.2) * s
      poly(ctx, [[p.x, y0 - 12 * s], [p.x + w, y0], [p.x - w, y0]], col(d))
      poly(ctx, [[p.x, y0 - 12 * s], [p.x - w * 0.15, y0 - 1], [p.x - w, y0]], col(l))
    }
  }
}

/* ---------------------------------------------------------------- houses */
const ROOFS = {
  blue: [PAL.roofBlue, PAL.roofBlueDark], red: [PAL.roofRed, PAL.roofRedDark],
  purple: [PAL.roofPurple, PAL.roofPurpleDark], teal: [PAL.roofTeal, PAL.roofTealDark],
  wood: ['#9a6a3e', '#6e4626'], slate: ['#6b7fa8', '#4b5d84'],
}

function gableRoof(ctx, x, y, a, b, h, rh, roof, wall) {
  const [rc, rd] = ROOFS[roof] || ROOFS.blue
  const A = a / 2 + 2.2, B = b / 2 + 2.2
  const p = (du, dv, dz) => iso(x, y, du, dv, dz)
  poly(ctx, [p(-A, -B, h), p(A, -B, h), p(A, 0, h + rh), p(-A, 0, h + rh)], col(rd), EDGE)
  poly(ctx, [p(a / 2, b / 2, h), p(a / 2, -b / 2, h), p(a / 2, 0, h + rh)], col(wall), EDGE)
  poly(ctx, [p(-A, B, h), p(A, B, h), p(A, 0, h + rh), p(-A, 0, h + rh)], col(rc), EDGE)
  // shingle lines
  for (let i = 1; i < 4; i++) {
    const t = i / 4
    const l1 = p(-A, B * (1 - t), h + rh * t), l2 = p(A, B * (1 - t), h + rh * t)
    line(ctx, l1[0], l1[1], l2[0], l2[1], col(rd, 0.55), 0.5)
  }
}

function windowsOn(ctx, x, y, a, b, h, n, lights) {
  const on = lit()
  for (let i = 0; i < n; i++) {
    const du = -a / 2 + (a / (n + 1)) * (i + 1)
    const c = iso(x, y, du, b / 2, h * 0.55)
    poly(ctx, [[c[0] - 1.6, c[1] - 2.2], [c[0] + 1.6, c[1] - 1.4], [c[0] + 1.6, c[1] + 1.6], [c[0] - 1.6, c[1] + 0.8]],
      on ? col(PAL.window) : col(PAL.windowOff), col(PAL.timber), 0.4)
    if (lights) lights.push([c[0], c[1], 9])
  }
}

function house(ctx, p) {
  const a = p.a || 18, b = p.b || 14, h = p.h || 12, rh = p.rh || 9
  ellipse(ctx, p.x, p.y + 2, (a + b) * 0.62, (a + b) * 0.26, 'rgba(18,24,60,.22)')
  box(ctx, p.x, p.y, a, b, h, { left: col(PAL.wall), right: col(PAL.wallShade), edge: EDGE })
  // cream stone flecks and a timber door
  const speckle = rng(((p.x * 13 + p.y * 7) | 0) || 1)
  for (let i = 0; i < 8; i++) {
    const c = iso(p.x, p.y, (speckle() - 0.5) * a * 0.72, b / 2 - 0.4, h * (0.18 + speckle() * 0.62))
    circle(ctx, c[0], c[1], 0.45, col(speckle() < 0.55 ? '#fffaf0' : '#cbb892', 0.85))
  }
  const d = iso(p.x, p.y, a / 2, b * 0.1, 0)
  poly(ctx, [[d[0], d[1] - 0.2], [d[0], d[1] - 7.5], [d[0] - 3.4, d[1] - 5.8], [d[0] - 3.4, d[1] + 1.5]], col(PAL.timber))
  poly(ctx, [[d[0] - 0.4, d[1] - 3.2], [d[0] - 2.6, d[1] - 2.2], [d[0] - 2.6, d[1] - 4.6], [d[0] - 0.4, d[1] - 5.2]], lit() ? col(PAL.window) : col(PAL.windowOff))
  windowsOn(ctx, p.x, p.y, a, b, h, Math.max(1, Math.round(a / 9)))
  if (p.chimney) box(ctx, ...iso(p.x, p.y, -a / 4, -b / 6, 0), 3.2, 3.2, h + rh + 4, { left: col('#d8c8a4'), right: col('#b49a74'), top: col('#6b5a44') })
  gableRoof(ctx, p.x, p.y, a, b, h, rh, p.roof || 'blue', PAL.wallShade)
  // ridge highlight so pastel roofs catch the light
  const ridgeL = iso(p.x, p.y, -(a / 2 + 2), 0, h + rh - 0.4)
  const ridgeR = iso(p.x, p.y, a / 2 + 2, 0, h + rh - 0.4)
  line(ctx, ridgeL[0], ridgeL[1], ridgeR[0], ridgeR[1], col('#fff6e4', 0.55), 0.8)
  const pot = iso(p.x, p.y, -a * 0.15, b / 2, 0.4)
  circle(ctx, pot[0] - 1.4, pot[1] - 2, 1.3, col('#ff8eae'))
  circle(ctx, pot[0] + 1.1, pot[1] - 2.4, 1.15, col('#ffe07a'))
  circle(ctx, pot[0], pot[1] - 3.3, 1.2, col(PAL.leafLight))
}
function houseLights(p) {
  const a = p.a || 18, b = p.b || 14, h = p.h || 12
  const out = []
  const n = Math.max(1, Math.round(a / 9))
  for (let i = 0; i < n; i++) {
    const c = iso(p.x, p.y, -a / 2 + (a / (n + 1)) * (i + 1), b / 2, h * 0.55)
    out.push([c[0], c[1] + 2, 12])
  }
  return out
}
function chimneySmoke(ctx, p, t) {
  if (!p.chimney || !lit()) return
  const a = p.a || 18, b = p.b || 14, h = p.h || 12, rh = p.rh || 9
  const c = iso(p.x, p.y, -a / 4, -b / 6, h + rh + 4)
  for (let i = 0; i < 4; i++) {
    const k = ((t * 0.25 + i / 4 + (p.x % 7) / 7) % 1)
    circle(ctx, c[0] + Math.sin(k * 6 + i) * 2 + k * 6, c[1] - k * 18, 1.4 + k * 3, `rgba(230,232,250,${0.35 * (1 - k)})`)
  }
}

/* ---------------------------------------------------------------- small street furniture */
function lamp(ctx, p) {
  ellipse(ctx, p.x, p.y + 0.6, 2.6, 1.2, 'rgba(18,24,60,.25)')
  line(ctx, p.x, p.y, p.x, p.y - 16, col('#3a3228'), 1.5)
  line(ctx, p.x - 0.4, p.y - 2, p.x - 0.4, p.y - 15, col(PAL.gold, 0.7), 0.5)
  poly(ctx, [[p.x - 2.6, p.y - 16], [p.x + 2.6, p.y - 16], [p.x + 1.7, p.y - 21], [p.x - 1.7, p.y - 21]], lit() ? col('#fff1c2') : col('#6d7299'), col(PAL.goldDark), 0.6)
  poly(ctx, [[p.x - 3.1, p.y - 21], [p.x + 3.1, p.y - 21], [p.x, p.y - 23.6]], col(PAL.goldDark))
  if (lit()) circle(ctx, p.x, p.y - 18.2, 1.1, col('#fffef4'))
}
function bench(ctx, p) {
  box(ctx, p.x, p.y, 10, 3, 2.4, { top: col(PAL.woodLight), left: col(PAL.wood), right: col(PAL.woodDark) })
  box(ctx, ...iso(p.x, p.y, 0, -1.4, 0), 10, 0.8, 5, { left: col(PAL.wood), right: col(PAL.woodDark), top: col(PAL.woodLight) })
}
function crate(ctx, p) {
  const s = p.s || 1
  box(ctx, p.x, p.y, 6 * s, 6 * s, 5 * s, { top: col('#d6a868'), left: col('#b98552'), right: col('#8a5a2e') })
}
function barrel(ctx, p) {
  ellipse(ctx, p.x, p.y, 3, 1.5, col('#6b4426'))
  ctx.fillStyle = col('#9a6a3e'); ctx.fillRect(p.x - 3, p.y - 7, 6, 7)
  ellipse(ctx, p.x, p.y - 7, 3, 1.5, col('#c99a5e'))
  line(ctx, p.x - 3, p.y - 2, p.x + 3, p.y - 2, col('#4a3020'), 0.6)
  line(ctx, p.x - 3, p.y - 5, p.x + 3, p.y - 5, col('#4a3020'), 0.6)
}
function fence(ctx, p) {
  const [[x1, y1], [x2, y2]] = p.pts
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7))
  for (let i = 0; i <= n; i++) {
    const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n
    line(ctx, x, y, x, y - 6, col(PAL.woodDark), 1.3, 'butt')
  }
  line(ctx, x1, y1 - 5, x2, y2 - 5, col(PAL.wood), 1.1)
  line(ctx, x1, y1 - 2.5, x2, y2 - 2.5, col(PAL.wood), 1.1)
}
function hedge(ctx, p) {
  const [[x1, y1], [x2, y2]] = p.pts
  const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 5))
  for (let i = 0; i <= n; i++) {
    const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n
    circle(ctx, x, y - 3.5, 3.8, col(PAL.leafDark)); circle(ctx, x - 1, y - 4.6, 2.4, col(PAL.leaf))
  }
}
function flowers(ctx, p) {
  const r = rng(p.x * 7 + p.y)
  const cs = ['#ff9ab0', '#ffd66b', '#ffffff', '#b99bff', '#ff8a5b']
  for (let i = 0; i < (p.n || 8); i++) {
    const x = p.x + (r() - 0.5) * (p.w || 16), y = p.y + (r() - 0.5) * (p.w || 16) * 0.45
    circle(ctx, x, y - 1.2, 1.1, col(PAL.leafDark)); circle(ctx, x, y - 1.8, 0.9, col(cs[i % cs.length]))
  }
}
function well(ctx, p) {
  ellipse(ctx, p.x, p.y, 6, 3, col(PAL.stoneSide))
  ctx.fillStyle = col(PAL.stoneSide); ctx.fillRect(p.x - 6, p.y - 5, 12, 5)
  ellipse(ctx, p.x, p.y - 5, 6, 3, col(PAL.stone)); ellipse(ctx, p.x, p.y - 5, 4.2, 2, col(PAL.waterDeep))
  line(ctx, p.x - 5, p.y - 5, p.x - 5, p.y - 14, col(PAL.woodDark), 1.2); line(ctx, p.x + 5, p.y - 5, p.x + 5, p.y - 14, col(PAL.woodDark), 1.2)
  poly(ctx, [[p.x - 7, p.y - 13], [p.x + 7, p.y - 13], [p.x, p.y - 19]], col(PAL.roofRed))
}

/* ---------------------------------------------------------------- banners & bunting */
function bannerPole(ctx, p) {
  const h = p.h || 34
  ellipse(ctx, p.x, p.y + 0.5, 2.4, 1.1, 'rgba(18,24,60,.25)')
  line(ctx, p.x, p.y, p.x, p.y - h, col(PAL.goldDark), 1.4)
  circle(ctx, p.x, p.y - h - 1.2, 1.4, col(PAL.gold))
}
function bannerCloth(ctx, p, t) {
  const h = p.h || 34, w = p.w || 9, len = p.len || 18
  const sway = Math.sin(t * 1.7 + p.x * 0.05) * 1.6
  const top = p.y - h + 2
  ctx.beginPath()
  ctx.moveTo(p.x, top)
  ctx.lineTo(p.x + w, top + 0.5)
  ctx.quadraticCurveTo(p.x + w + sway * 0.5, top + len / 2, p.x + w + sway, top + len)
  ctx.lineTo(p.x + w / 2 + sway, top + len - 3.5)
  ctx.lineTo(p.x + sway * 0.6, top + len)
  ctx.closePath()
  ctx.fillStyle = col(PAL.banner); ctx.fill()
  ctx.strokeStyle = col(PAL.gold); ctx.lineWidth = 0.6; ctx.stroke()
  // clover emblem
  const cx = p.x + w / 2 + sway * 0.4, cy = top + len * 0.42
  for (const [dx, dy] of [[-1.3, 0], [1.3, 0], [0, -1.3]]) circle(ctx, cx + dx, cy + dy, 1.35, col('#ffffff'))
  line(ctx, cx, cy, cx, cy + 2.6, col('#ffffff'), 0.7)
}
function bunting(ctx, p, t) {
  const [[x1, y1], [x2, y2]] = p.pts
  const h = p.h || 16
  const cs = ['#d9534f', '#f3d98f', '#3f68cf', '#7cc96a', '#b99bff']
  const sag = 6
  line(ctx, x1, y1, x1, y1 - h, col(PAL.woodDark), 1.1)
  line(ctx, x2, y2, x2, y2 - h, col(PAL.woodDark), 1.1)
  const n = Math.round(Math.hypot(x2 - x1, y2 - y1) / 6)
  const ptAt = (k) => [x1 + (x2 - x1) * k, y1 - h + (y2 - y1) * k + Math.sin(k * Math.PI) * sag]
  ctx.beginPath()
  for (let i = 0; i <= 20; i++) { const [x, y] = ptAt(i / 20); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
  ctx.strokeStyle = col('#4a3a2a'); ctx.lineWidth = 0.5; ctx.stroke()
  for (let i = 0; i < n; i++) {
    const [x, y] = ptAt((i + 0.5) / n)
    const sw = Math.sin(t * 2.4 + i) * 0.8
    poly(ctx, [[x - 2, y], [x + 2, y], [x + sw, y + 4.5]], col(cs[i % cs.length]))
  }
}

/* ---------------------------------------------------------------- market stall */
function stall(ctx, p) {
  const c = p.color || '#d9534f'
  ellipse(ctx, p.x, p.y + 2, 18, 7, 'rgba(18,24,60,.22)')
  box(ctx, p.x, p.y, 20, 10, 7, { top: col('#d6a868'), left: col('#b98552'), right: col('#8a5a2e') })
  // produce
  const goods = ['#f2a33a', '#86cf6a', '#d9534f', '#ffd66b']
  for (let i = 0; i < 4; i++) { const g = iso(p.x, p.y, -7 + i * 4.6, 1, 7); circle(ctx, g[0], g[1] - 1, 1.8, col(goods[i])) }
  // posts
  for (const [du, dv] of [[-10, 5], [10, 5], [-10, -5], [10, -5]]) { const q = iso(p.x, p.y, du, dv, 0); line(ctx, q[0], q[1], q[0], q[1] - 16, col(PAL.woodDark), 1) }
  // striped awning
  for (let i = 0; i < 5; i++) {
    const u0 = -12 + i * 4.8, u1 = u0 + 4.8
    poly(ctx, [iso(p.x, p.y, u0, 7, 13), iso(p.x, p.y, u1, 7, 13), iso(p.x, p.y, u1, -1, 19), iso(p.x, p.y, u0, -1, 19)], col(i % 2 ? '#fff4e0' : c), EDGE, 0.4)
  }
}

/* ---------------------------------------------------------------- New Haven: beacon tower */
function tower(ctx, p) {
  const x = p.x, y = p.y
  ellipse(ctx, x, y + 3, 30, 12, 'rgba(18,24,60,.25)')
  // base drum
  const drum = (yb, r, h, c1, c2) => {
    ctx.beginPath(); ctx.ellipse(x, yb, r, r / 2, 0, 0, Math.PI); ctx.lineTo(x - r, yb - h); ctx.ellipse(x, yb - h, r, r / 2, 0, Math.PI, 0, true); ctx.closePath()
    const g = ctx.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, col(c1)); g.addColorStop(0.7, col(c2)); g.addColorStop(1, col(PAL.stoneDark))
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 0.6; ctx.stroke()
    ellipse(ctx, x, yb - h, r, r / 2, col(PAL.stone), EDGE)
  }
  drum(y, 26, 10, '#f3ecdd', '#d4c9b2')
  drum(y - 10, 19, 12, '#f3ecdd', '#d4c9b2')
  // gold ring + arched windows on drum
  line(ctx, x - 19, y - 16, x + 19, y - 16, col(PAL.gold), 1)
  for (const dx of [-11, 0, 11]) {
    const wy = y - 15 + Math.abs(dx) * 0.12
    poly(ctx, [[x + dx - 2.2, wy], [x + dx + 2.2, wy], [x + dx + 2.2, wy - 5], [x + dx, wy - 7], [x + dx - 2.2, wy - 5]], lit() ? col(PAL.window) : col(PAL.windowOff))
  }
  // shaft
  const top = y - 22 - (p.h || 100)
  const g = ctx.createLinearGradient(x - 15, 0, x + 15, 0)
  g.addColorStop(0, col('#f6efe0')); g.addColorStop(0.65, col('#ddd2bb')); g.addColorStop(1, col('#b5a98f'))
  ctx.beginPath(); ctx.moveTo(x - 15, y - 22); ctx.lineTo(x - 11, top); ctx.lineTo(x + 11, top); ctx.lineTo(x + 15, y - 22); ctx.closePath()
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = EDGE; ctx.stroke()
  // blue inset with gold stars
  ctx.beginPath(); ctx.moveTo(x - 5.5, y - 30); ctx.lineTo(x - 4.5, top + 12); ctx.lineTo(x + 4.5, top + 12); ctx.lineTo(x + 5.5, y - 30); ctx.closePath()
  ctx.fillStyle = col(PAL.roofBlueDark); ctx.fill()
  for (let i = 0; i < 6; i++) { const sy = y - 40 - i * ((y - 30 - top - 12) / 6); circle(ctx, x, sy, 1.1, col(PAL.gold)) }
  // gold bands
  for (const k of [0.25, 0.55, 0.85]) {
    const by = y - 22 + (top - (y - 22)) * k, hw = 15 - 4 * k
    ctx.beginPath(); ctx.ellipse(x, by, hw, hw * 0.45, 0, 0, Math.PI); ctx.strokeStyle = col(PAL.gold); ctx.lineWidth = 1.6; ctx.stroke()
  }
  // crown
  ellipse(ctx, x, top, 13, 6, col(PAL.gold), col(PAL.goldDark))
  line(ctx, x, top, x, top - 10, col(PAL.goldDark), 2)
}
export function towerTop(p) { return [p.x, p.y - 22 - (p.h || 100) - 26] }
function towerAnim(ctx, p, t, env) {
  // armillary sphere: rings turn slowly; the orb is always gold, and floods the plaza once restored
  const [cx, cy] = towerTop(p)
  const on = env.beacon && lit()
  const pulse = 1 + Math.sin(t * 2) * 0.08
  glow(ctx, cx, cy, (on ? 56 : 22) * pulse, PAL.glow, on ? 0.62 : 0.28)
  if (on) glow(ctx, cx, cy + 70, 90, '#fff1c4', 0.16)
  circle(ctx, cx, cy, on ? 8.4 : 6.4, on ? '#fff8d4' : col('#e7c56a'))
  circle(ctx, cx - 2.2, cy - 2.2, on ? 3.2 : 2, '#ffffff')
  ctx.lineWidth = on ? 2 : 1.5
  ctx.strokeStyle = col(PAL.goldLight)
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, TAU); ctx.stroke()
  ctx.strokeStyle = col(PAL.gold)
  ctx.lineWidth = 1.35
  ctx.beginPath(); ctx.ellipse(cx, cy, 16, Math.abs(Math.cos(t * 0.55)) * 15 + 1.2, 0.4, 0, TAU); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(Math.sin(t * 0.42)) * 15 + 1.2, 16, -0.3, 0, TAU); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(cx, cy, 16, 5.5, t * 0.35, 0, TAU); ctx.stroke()
  line(ctx, cx, cy + 16, cx, cy + 24, col(PAL.goldDark), 2.2)
  circle(ctx, cx, cy - 17.5, 1.6, col(PAL.goldLight))
}

/* ---------------------------------------------------------------- energy: turbine & solar */
function turbine(ctx, p) {
  const h = p.h || 64
  ellipse(ctx, p.x, p.y + 1, 6, 2.6, 'rgba(18,24,60,.25)')
  poly(ctx, [[p.x - 2.6, p.y], [p.x + 2.6, p.y], [p.x + 1.2, p.y - h], [p.x - 1.2, p.y - h]], col('#f4efe6'), col('#bdb3a2'), 0.5)
  ellipse(ctx, p.x + 1.5, p.y - h, 3.6, 2.4, col('#e9e2d4'), col('#bdb3a2'), 0.5)
}
function turbineAnim(ctx, p, t) {
  const h = p.h || 64, cx = p.x, cy = p.y - h
  const a = t * (p.speed || 1.6) + (p.x % 10)
  for (let i = 0; i < 3; i++) {
    const ang = a + i * TAU / 3
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang)
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(4, -7, 4, -22, 0.8, -28); ctx.bezierCurveTo(-2.6, -22, -2.6, -7, 0, 0)
    ctx.fillStyle = col('#f2e3c0'); ctx.fill(); ctx.strokeStyle = col('#c9a96b'); ctx.lineWidth = 0.5; ctx.stroke()
    ctx.restore()
  }
  circle(ctx, cx, cy, 2.4, col(PAL.goldDark))
}
function solar(ctx, p) {
  const rows = p.rows || 2, cols = p.cols || 3
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const du = (c - (cols - 1) / 2) * 17, dv = (r - (rows - 1) / 2) * 13
      const q = (a, b, z) => iso(p.x, p.y, du + a, dv + b, z)
      line(ctx, ...q(-6, 3, 0), ...q(-6, 3, 4), col('#6b5b45'), 1)
      line(ctx, ...q(6, 3, 0), ...q(6, 3, 4), col('#6b5b45'), 1)
      poly(ctx, [q(-8, -5, 9), q(8, -5, 9), q(8, 5, 3), q(-8, 5, 3)], col('#1f4ec4'), col(PAL.gold), 1)
      line(ctx, ...q(0, -5, 9), ...q(0, 5, 3), col(PAL.panelLight), 0.4)
      line(ctx, ...q(-8, 0, 6), ...q(8, 0, 6), col(PAL.panelLight), 0.4)
      poly(ctx, [q(-7, -4.5, 8.8), q(-2, -4.5, 8.8), q(-4, 0, 6), q(-7, 0, 6)], 'rgba(255,255,255,.12)')
    }
  }
}

/* ---------------------------------------------------------------- water: reservoirs */
function tank(ctx, p) {
  const r = p.r || 24, h = p.h || 16, x = p.x, y = p.y
  ellipse(ctx, x, y + 3, r + 6, (r + 6) / 2, 'rgba(18,24,60,.22)')
  ctx.beginPath(); ctx.ellipse(x, y, r, r / 2, 0, 0, Math.PI); ctx.lineTo(x - r, y - h); ctx.ellipse(x, y - h, r, r / 2, 0, Math.PI, 0, true); ctx.closePath()
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0); g.addColorStop(0, col('#efe8da')); g.addColorStop(0.7, col('#cfc4ae')); g.addColorStop(1, col('#a99d86'))
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 0.6; ctx.stroke()
  // stone courses + arched openings
  for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x, y - h * k / 3, r, r / 2, 0, 0.1, Math.PI - 0.1); ctx.strokeStyle = col('#b9ad95'); ctx.lineWidth = 0.5; ctx.stroke() }
  for (const k of [-0.5, 0.15]) {
    const ax = x + r * k, ay = y + Math.sqrt(1 - k * k) * r / 2 - 2
    poly(ctx, [[ax - 3, ay], [ax + 3, ay], [ax + 3, ay - 6], [ax, ay - 8], [ax - 3, ay - 6]], col('#3b4d8a'))
  }
  ellipse(ctx, x, y - h, r, r / 2, col(PAL.stone), col(PAL.gold, 0.8), 1.1)
  const w = ctx.createRadialGradient(x - r * 0.35, y - h - r * 0.2, 1, x, y - h, r)
  w.addColorStop(0, col('#f4fdff')); w.addColorStop(0.35, col('#7eebf4')); w.addColorStop(1, col('#1490c8'))
  ellipse(ctx, x, y - h, r * 0.84, r * 0.4, w)
  ellipse(ctx, x - r * 0.22, y - h - r * 0.08, r * 0.28, r * 0.1, col('#ffffff', 0.55))
}
function tankAnim(ctx, p, t) {
  if (!lit()) return
  const r = p.r || 24, h = p.h || 16
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.3 + i * 0.5) % 1
    ctx.beginPath(); ctx.ellipse(p.x, p.y - h, r * 0.8 * k, r * 0.37 * k, 0, 0, TAU)
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - k)})`; ctx.lineWidth = 0.8; ctx.stroke()
  }
  if (p.spout) {
    // a spout pouring over the rim
    const sx = p.x + r * 0.55, sy = p.y - h + r * 0.2
    const g = ctx.createLinearGradient(0, sy, 0, sy + h + 10)
    g.addColorStop(0, 'rgba(200,236,255,.95)'); g.addColorStop(1, 'rgba(120,190,255,.25)')
    ctx.fillStyle = g; ctx.fillRect(sx - 2.5, sy, 5, h + 10)
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.4 + i / 3) % 1
      line(ctx, sx - 1.5 + i * 1.5, sy + k * (h + 8), sx - 1.5 + i * 1.5, sy + k * (h + 8) + 4, 'rgba(255,255,255,.8)', 0.7)
    }
  }
}

/* ---------------------------------------------------------------- Mercy: clinic */
function clinic(ctx, p) {
  const x = p.x, y = p.y
  ellipse(ctx, x, y + 4, 40, 16, 'rgba(18,24,60,.22)')
  // wings with blue barrel roofs
  for (const [du, dv, a, b] of [[-16, 10, 22, 14], [18, -6, 18, 16]]) {
    const c = iso(x, y, du, dv, 0)
    box(ctx, c[0], c[1], a, b, 10, { left: col('#f6f2ea'), right: col('#d9d2c4') })
    const q = (u, v, z) => iso(c[0], c[1], u, v, z)
    ctx.beginPath(); const s0 = q(-a / 2, b / 2, 10), s1 = q(a / 2, b / 2, 10), m = q(0, b / 2, 17)
    ctx.moveTo(...s0); ctx.quadraticCurveTo(m[0], m[1] - 2, ...s1); ctx.lineTo(...q(a / 2, -b / 2, 10)); ctx.quadraticCurveTo(...q(0, -b / 2, 17), ...q(-a / 2, -b / 2, 10)); ctx.closePath()
    ctx.fillStyle = col('#4c78c8'); ctx.fill(); ctx.strokeStyle = col('#2c4f96'); ctx.lineWidth = 0.6; ctx.stroke()
    for (let i = 1; i < 4; i++) { const l1 = q(-a / 2 + a * i / 4, b / 2, 14.5), l2 = q(-a / 2 + a * i / 4, -b / 2, 14.5); line(ctx, l1[0], l1[1], l2[0], l2[1], col('#9fc3e8'), 0.5) }
    windowsOn(ctx, c[0], c[1], a, b, 10, 2)
  }
  // central block with red cross
  box(ctx, x, y, 22, 20, 26, { left: col('#fbf8f2'), right: col('#dcd6ca'), top: col('#efe9de') })
  const f = iso(x, y, 0, 10, 16)
  ctx.fillStyle = col(PAL.red); ctx.fillRect(f[0] - 1.8, f[1] - 6, 3.6, 12); ctx.fillRect(f[0] - 6, f[1] - 1.8, 12, 3.6)
  // arched doors
  for (const du of [-5, 4]) {
    const d = iso(x, y, du, 10, 0)
    poly(ctx, [[d[0] - 3, d[1]], [d[0] + 3, d[1] + 1.5], [d[0] + 3, d[1] - 6.5], [d[0], d[1] - 9], [d[0] - 3, d[1] - 8]], lit() ? col('#ffcf6b') : col(PAL.windowOff), col('#8a6a35'), 0.5)
  }
}
function helipad(ctx, p) {
  // raised wooden pad
  box(ctx, p.x, p.y, 30, 22, 4, { top: col('#9a6a3e'), left: col('#7a4d26'), right: col('#5e3a1c') })
  const c = [p.x, p.y - 4]
  ellipse(ctx, c[0], c[1], 9, 4.5, null, col('#f3d98f'), 0.8)
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; line(ctx, c[0], c[1], c[0] + Math.cos(a) * 7, c[1] + Math.sin(a) * 3.5, col('#f3d98f'), 0.8) }
}
function airship(ctx, p, t) {
  const bob = Math.sin(t * 1.1 + p.x) * 2
  const x = p.x, y = p.y + bob
  ellipse(ctx, p.x, p.base || p.y + 30, 16, 5, 'rgba(18,24,60,.18)')
  if (p.rope) line(ctx, x - 10, y + 10, p.x - 14, p.base || p.y + 30, col('#8a6a35'), 0.6)
  ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.bezierCurveTo(x - 26, y - 13, x + 24, y - 13, x + 30, y); ctx.bezierCurveTo(x + 24, y + 13, x - 26, y + 13, x - 26, y)
  const g = ctx.createLinearGradient(0, y - 12, 0, y + 12); g.addColorStop(0, col('#ffffff')); g.addColorStop(1, col('#c9cbe0'))
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = col('#a88a4a'); ctx.lineWidth = 0.8; ctx.stroke()
  for (const dx of [-14, -3, 8, 18]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 10); ctx.quadraticCurveTo(x + dx + 3, y, x + dx, y + 10); ctx.strokeStyle = col('#c9a24f'); ctx.lineWidth = 0.8; ctx.stroke() }
  poly(ctx, [[x + 27, y - 3], [x + 34, y - 8], [x + 34, y + 8], [x + 27, y + 3]], col(PAL.banner), col(PAL.gold), 0.5)
  line(ctx, x - 8, y + 9, x - 6, y + 15, col('#8a6a35'), 0.7); line(ctx, x + 8, y + 9, x + 6, y + 15, col('#8a6a35'), 0.7)
  ctx.fillStyle = col('#8a5a2e'); ctx.fillRect(x - 9, y + 14, 18, 6)
  for (let i = 0; i < 3; i++) { ctx.fillStyle = lit() ? col(PAL.window) : col(PAL.windowOff); ctx.fillRect(x - 6 + i * 5, y + 15.5, 2.6, 2.2) }
  const prop = Math.abs(Math.sin(t * 18)) * 5 + 0.5
  ellipse(ctx, x - 28, y, 1, prop, col(PAL.gold))
}

/* ---------------------------------------------------------------- Gardens: greenhouse, windmill, crops */
function greenhouse(ctx, p) {
  const x = p.x, y = p.y, a = p.a || 40, b = p.b || 24
  ellipse(ctx, x, y + 3, 36, 14, 'rgba(18,24,60,.22)')
  box(ctx, x, y, a, b, 4, { top: col('#d9d1c1'), left: col('#bdb3a0'), right: col('#a59b88') })
  // plants inside
  for (let i = 0; i < 5; i++) { const c = iso(x, y, -a / 2 + 5 + i * (a - 10) / 4, 2, 6); circle(ctx, c[0], c[1], 3.5, col(i % 2 ? PAL.leafLight : PAL.leaf)) }
  // glass vault
  const q = (u, v, z) => iso(x, y, u, v, z)
  const arch = (v, alpha) => {
    ctx.beginPath(); const s0 = q(-a / 2, v, 4); ctx.moveTo(...s0)
    for (let i = 1; i <= 12; i++) { const k = i / 12; const u = -a / 2 + a * k; ctx.lineTo(...q(u, v, 4 + Math.sin(k * Math.PI) * 18)) }
    return alpha
  }
  arch(b / 2); ctx.lineTo(...q(a / 2, -b / 2, 4))
  for (let i = 12; i >= 0; i--) { const k = i / 12; ctx.lineTo(...q(-a / 2 + a * k, -b / 2, 4 + Math.sin(k * Math.PI) * 18)) }
  ctx.closePath(); ctx.fillStyle = lit() ? 'rgba(200,236,255,.32)' : col('#9aa8d0', 0.35); ctx.fill()
  ctx.strokeStyle = col('#eaf6ff', 0.9); ctx.lineWidth = 0.7
  for (let j = 0; j <= 4; j++) {
    const v = b / 2 - (b * j) / 4
    ctx.beginPath(); for (let i = 0; i <= 12; i++) { const k = i / 12; const pt = q(-a / 2 + a * k, v, 4 + Math.sin(k * Math.PI) * 18); i ? ctx.lineTo(...pt) : ctx.moveTo(...pt) } ctx.stroke()
  }
  for (let i = 0; i <= 6; i++) { const k = i / 6; const u = -a / 2 + a * k; const z = 4 + Math.sin(k * Math.PI) * 18; line(ctx, ...q(u, b / 2, z), ...q(u, -b / 2, z), col('#eaf6ff', 0.7), 0.5) }
}
function windmill(ctx, p) {
  const x = p.x, y = p.y
  ellipse(ctx, x, y + 2, 12, 5, 'rgba(18,24,60,.25)')
  poly(ctx, [[x - 9, y], [x + 9, y + 2], [x + 6, y - 34], [x - 6, y - 35]], col('#efe6d4'), EDGE)
  poly(ctx, [[x + 9, y + 2], [x + 12, y - 1], [x + 8, y - 34], [x + 6, y - 34]], col('#cbbf9f'), EDGE)
  poly(ctx, [[x - 8, y - 34], [x + 9, y - 34], [x + 1, y - 46]], col(PAL.roofRed), EDGE)
  poly(ctx, [[x - 2, y], [x + 3, y + 1], [x + 3, y - 8], [x - 2, y - 9]], col(PAL.timber))
  poly(ctx, [[x - 3, y - 20], [x + 1, y - 19.5], [x + 1, y - 24], [x - 3, y - 24.5]], lit() ? col(PAL.window) : col(PAL.windowOff))
}
function windmillAnim(ctx, p, t) {
  const cx = p.x + 1, cy = p.y - 36
  const a = t * 0.8
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a + i * Math.PI / 2); ctx.scale(1, 0.85)
    poly(ctx, [[-1, 0], [1, 0], [1.2, -27], [-1.2, -27]], col(PAL.woodDark))
    poly(ctx, [[1, -6], [7, -7], [7, -26], [1.2, -26]], col('#efe3c4'), col('#8a6a35'), 0.5)
    for (let k = 1; k < 4; k++) line(ctx, 1, -6 - k * 5, 7, -7 - k * 5, col('#8a6a35'), 0.4)
    ctx.restore()
  }
  circle(ctx, cx, cy, 2.2, col(PAL.woodDark))
}
function shed(ctx, p) {
  box(ctx, p.x, p.y, 12, 10, 9, { left: col('#a87445'), right: col('#8a5a2e') })
  gableRoof(ctx, p.x, p.y, 12, 10, 9, 6, 'wood', '#8a5a2e')
}

/* ---------------------------------------------------------------- dock / skyport */
function dockPosts(ctx, p) {
  for (const [du, dv] of p.posts || []) {
    const q = iso(p.x, p.y, du, dv, 0)
    ctx.fillStyle = col('#6b4426'); ctx.fillRect(q[0] - 1.5, q[1] - 8, 3, 8)
    circle(ctx, q[0], q[1] - 8, 1.6, col('#c99a5e'))
  }
}

/* ---------------------------------------------------------------- crystal battery */
function crystal(ctx, p) {
  const s = p.s || 1
  ellipse(ctx, p.x, p.y + 1, 9 * s, 3.5 * s, 'rgba(18,24,60,.25)')
  const c = p.c || '#c6a8ff'
  poly(ctx, [[p.x, p.y - 30 * s], [p.x + 7 * s, p.y - 12 * s], [p.x + 3 * s, p.y], [p.x - 4 * s, p.y], [p.x - 7 * s, p.y - 12 * s]], col(c), col('#f3eaff'), 0.6)
  poly(ctx, [[p.x, p.y - 30 * s], [p.x + 7 * s, p.y - 12 * s], [p.x + 3 * s, p.y], [p.x, p.y - 12 * s]], 'rgba(255,255,255,.3)')
}

/* ---------------------------------------------------------------- registry */
export const PROPS = {
  tree: { draw: tree, size: (p) => [16 * (p.s || 1), 40 * (p.s || 1), 5] },
  house: { draw: house, anim: chimneySmoke, lights: houseLights, size: (p) => [(p.a || 18) + (p.b || 14), (p.h || 12) + (p.rh || 9) + (p.b || 14) / 2 + 12, 14] },
  lamp: { draw: lamp, lights: (p) => [[p.x, p.y - 18, 18]], size: () => [6, 26, 3] },
  bench: { draw: bench, size: () => [10, 10, 5] },
  crate: { draw: crate, size: (p) => [8 * (p.s || 1), 10 * (p.s || 1), 6] },
  barrel: { draw: barrel, size: () => [5, 10, 3] },
  fence: { draw: fence, size: (p) => { const [[a, b], [c, d]] = p.pts; return [Math.abs(c - a) / 2 + 4, Math.abs(d - b) / 2 + 10, Math.abs(d - b) / 2 + 3] }, center: (p) => [(p.pts[0][0] + p.pts[1][0]) / 2, (p.pts[0][1] + p.pts[1][1]) / 2] },
  hedge: { draw: hedge, size: (p) => { const [[a, b], [c, d]] = p.pts; return [Math.abs(c - a) / 2 + 6, Math.abs(d - b) / 2 + 10, Math.abs(d - b) / 2 + 4] }, center: (p) => [(p.pts[0][0] + p.pts[1][0]) / 2, (p.pts[0][1] + p.pts[1][1]) / 2] },
  flowers: { draw: flowers, size: (p) => [(p.w || 16) / 2 + 2, (p.w || 16) / 4 + 4, (p.w || 16) / 4 + 2] },
  well: { draw: well, size: () => [9, 22, 4] },
  banner: { draw: bannerPole, anim: bannerCloth, size: (p) => [4, (p.h || 34) + 4, 3] },
  bunting: { draw: () => {}, anim: bunting, size: () => [0, 0, 0], center: (p) => [(p.pts[0][0] + p.pts[1][0]) / 2, Math.max(p.pts[0][1], p.pts[1][1])] },
  stall: { draw: stall, lights: (p) => [[p.x, p.y - 8, 16]], size: () => [26, 28, 10] },
  tower: { draw: tower, anim: towerAnim, size: (p) => [32, (p.h || 100) + 40, 16] },
  turbine: { draw: turbine, anim: turbineAnim, size: (p) => [8, (p.h || 64) + 6, 4] },
  solar: { draw: solar, size: (p) => [(p.cols || 3) * 12 + (p.rows || 2) * 8, (p.rows || 2) * 8 + 16, (p.cols || 3) * 6 + (p.rows || 2) * 6] },
  tank: { draw: tank, anim: tankAnim, size: (p) => [(p.r || 24) + 8, (p.h || 16) + (p.r || 24) / 2 + 4, (p.r || 24) / 2 + 6] },
  clinic: { draw: clinic, lights: (p) => [[p.x - 6, p.y + 2, 26], [p.x + 20, p.y - 6, 16]], size: () => [46, 56, 22] },
  helipad: { draw: helipad, size: () => [28, 16, 16] },
  airship: { draw: () => {}, anim: airship, size: () => [0, 0, 0] },
  greenhouse: { draw: greenhouse, lights: (p) => [[p.x, p.y - 10, 30]], size: (p) => [((p.a || 40) + (p.b || 24)) * 0.55 + 4, 34, 18] },
  windmill: { draw: windmill, anim: windmillAnim, size: () => [14, 50, 4] },
  shed: { draw: shed, size: () => [14, 24, 8] },
  dockPosts: { draw: dockPosts, size: () => [60, 14, 40] },
  crystal: { draw: crystal, size: (p) => [9 * (p.s || 1), 32 * (p.s || 1), 4] },
}

export { house, tank, solar, turbine, crystal, stall, shed, greenhouse }
