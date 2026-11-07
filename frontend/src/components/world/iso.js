// Shared helpers for the procedural world renderer.
// Everything is drawn in "map units": the 1600 x 900 frame the concept art used.
// Isometric axes: moving +u goes right-down, +v goes left-down (2:1 isometric).

export const TAU = Math.PI * 2

/** Point on the ground plane: (cx, cy) base + du along U + dv along V, lifted by z. */
export function iso(cx, cy, du, dv, z = 0) {
  return [cx + du - dv, cy + (du + dv) / 2 - z]
}

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/* ---------------- colour + tint modes ----------------
 * Every colour goes through col(). The active mode recolours the whole scene:
 *  'lit'    – normal, warm night lighting
 *  'locked' – an island you can see but haven't reached: cool, desaturated, dim
 *  'hidden' – an uncharted silhouette
 */
let MODE = 'lit'
const cache = new Map()
export function setMode(m) { MODE = m }
export function getMode() { return MODE }

function hexToRgb(h) {
  if (h[0] === '#') h = h.slice(1)
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function col(hex, a = 1) {
  const key = MODE + hex + a
  let v = cache.get(key)
  if (v) return v
  let [r, g, b] = hexToRgb(hex)
  if (MODE === 'locked') {
    const l = 0.3 * r + 0.59 * g + 0.11 * b
    r = (r * 0.3 + l * 0.7) * 0.5 + 24
    g = (g * 0.3 + l * 0.7) * 0.54 + 30
    b = (b * 0.3 + l * 0.7) * 0.66 + 78
  } else if (MODE === 'hidden') {
    const l = 0.3 * r + 0.59 * g + 0.11 * b
    r = l * 0.16 + 26
    g = l * 0.18 + 34
    b = l * 0.24 + 82
  }
  v = `rgba(${r | 0},${g | 0},${b | 0},${a})`
  cache.set(key, v)
  return v
}
export const lit = () => MODE === 'lit'

/* ---------------- palette (sampled from the concept art) ---------------- */
export const PAL = {
  grass: '#79b062', grassDark: '#5a9452', grassLight: '#9ccc78', grassEdge: '#4e7e48',
  path: '#efe0bf', pathEdge: '#d7c39b', stone: '#e8dcc4', stoneSide: '#cbbb9c', stoneDark: '#a99a7e',
  rock: '#5b5fa8', rockMid: '#43478f', rockDark: '#2b2f6a', rockLight: '#8b8fd0',
  cloud: '#ffffff', cloudMid: '#e9e4fb', cloudShade: '#b9b2e6', cloudDeep: '#8f89c9',
  wall: '#f3e6c6', wallShade: '#d4c09a', wallDark: '#b8a37c', timber: '#7a4b2a',
  roofBlue: '#3e5bb0', roofBlueDark: '#2c4182', roofRed: '#c0603e', roofRedDark: '#8f3f27',
  roofPurple: '#6a5ac8', roofPurpleDark: '#4a3d96', roofTeal: '#3f8f9a', roofTealDark: '#2b6670',
  wood: '#a8743f', woodDark: '#6b4426', woodLight: '#c99a5e',
  gold: '#e3c27a', goldDark: '#a8792a', goldLight: '#fff0c0',
  water: '#4ea8ec', waterLight: '#bfe6ff', waterDeep: '#2a6fc0',
  glow: '#ffd66b', window: '#ffd97a', windowOff: '#59608a',
  leaf: '#3f8a5c', leafDark: '#2c5e46', leafLight: '#5aa86a', pine: '#2f6a4a', pineLight: '#46885a',
  banner: '#2c4fb0', bannerLight: '#3f68cf', white: '#ffffff', red: '#d23a3a',
  glass: '#bfe3ff', panel: '#2a4db5', panelLight: '#7fa2ff',
}

/* ---------------- primitive shapes ---------------- */
export function poly(ctx, pts, fill, stroke, lw = 0.6) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke() }
}

export function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 0.6) {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU)
  if (fill) { ctx.fillStyle = fill; ctx.fill() }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke() }
}

export function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); ctx.fillStyle = fill; ctx.fill()
}

export function line(ctx, x1, y1, x2, y2, stroke, lw = 1, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineCap = cap; ctx.stroke()
}

export function glow(ctx, x, y, r, color = PAL.glow, a = 0.55) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, col(color, a))
  g.addColorStop(1, col(color, 0))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
}

/** An isometric box. Footprint a (along U) x b (along V), height h, standing at (x, y) at elevation z. */
export function box(ctx, x, y, a, b, h, { top, left, right, z = 0, edge = 'rgba(30,25,60,.28)' }) {
  const A = a / 2, B = b / 2
  const p = (du, dv, dz) => iso(x, y, du, dv, z + dz)
  if (left) poly(ctx, [p(-A, B, 0), p(A, B, 0), p(A, B, h), p(-A, B, h)], left, edge)
  if (right) poly(ctx, [p(A, B, 0), p(A, -B, 0), p(A, -B, h), p(A, B, h)], right, edge)
  if (top) poly(ctx, [p(-A, -B, h), p(A, -B, h), p(A, B, h), p(-A, B, h)], top, edge)
}

/** Point helper bound to an object origin. */
export const at = (x, y, z0 = 0) => (du, dv, dz = 0) => iso(x, y, du, dv, z0 + dz)
