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
    // Night, but the neighborhood colors still read: purple roofs, blue water, white stone.
    const l = 0.3 * r + 0.59 * g + 0.11 * b
    r = r * 0.62 + l * 0.18 + 14
    g = g * 0.66 + l * 0.16 + 20
    b = b * 0.78 + l * 0.12 + 42
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
  grass: '#6fbf6a', grassDark: '#3f8a48', grassLight: '#b6e38a', grassEdge: '#3d7a40',
  path: '#f6ead0', pathEdge: '#c9ae78', stone: '#f4ead4', stoneSide: '#d9c7a4', stoneDark: '#b49a74',
  rock: '#6a6ec8', rockMid: '#454a96', rockDark: '#2a2e68', rockLight: '#b4b8ee',
  cloud: '#ffffff', cloudMid: '#f3efff', cloudShade: '#c9c2f0', cloudDeep: '#9b93d4',
  wall: '#fbf3e2', wallShade: '#e4d2b0', wallDark: '#cbb892', timber: '#7a4b2a',
  roofBlue: '#3a62c4', roofBlueDark: '#243e86', roofRed: '#d15a3a', roofRedDark: '#8d3824',
  roofPurple: '#8a6ad8', roofPurpleDark: '#5a429e', roofTeal: '#3f9aaa', roofTealDark: '#246878',
  wood: '#c48a4a', woodDark: '#6b3e22', woodLight: '#e8c48a',
  gold: '#f0d48a', goldDark: '#a8792a', goldLight: '#fff6d0',
  water: '#3ec6ea', waterLight: '#d8f7ff', waterDeep: '#1f78c4',
  glow: '#ffd66b', window: '#ffe7a0', windowOff: '#59608a',
  leaf: '#3f9a5c', leafDark: '#246044', leafLight: '#7ed48a', pine: '#2a6848', pineLight: '#4e9460',
  banner: '#2c4fb0', bannerLight: '#5a86e8', white: '#ffffff', red: '#e04545',
  glass: '#d7f3ff', panel: '#2456c8', panelLight: '#9ec0ff',
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

// Glows are drawn from a small pre-rendered radial sprite (one per colour) instead of
// building a new gradient for every light on every frame.
const glowSprites = new Map()
function glowSprite(color) {
  const key = col(color, 1)
  let sp = glowSprites.get(key)
  if (!sp) {
    sp = document.createElement('canvas')
    sp.width = sp.height = 64
    const g = sp.getContext('2d')
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, col(color, 1))
    gr.addColorStop(1, col(color, 0))
    g.fillStyle = gr
    g.fillRect(0, 0, 64, 64)
    glowSprites.set(key, sp)
  }
  return sp
}
export function glow(ctx, x, y, r, color = PAL.glow, a = 0.55) {
  if (a <= 0.004 || r <= 0) return
  const prev = ctx.globalAlpha
  ctx.globalAlpha = prev * a
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = prev
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
