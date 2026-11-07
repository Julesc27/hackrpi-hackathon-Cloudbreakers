import { bridgeCurve } from './people.js'
import { BRIDGE_APPROACHES, BRIDGE_ENDS, WORLD_ISLANDS } from './layout.js'
import { col, poly, line, circle, glow } from './iso.js'
import { getPaintedAtlas } from './paintedArt.js'

// The painted grain is projected onto the live deck, so islands can still float.
function paintedPlank(ctx, atlas, index, a, b, c) {
  const [sx, sy, sw, sh] = atlas.cells[0], row = sh / 8
  ctx.save()
  ctx.transform((b[0] - a[0]) / sw, (b[1] - a[1]) / sw,
    (c[0] - a[0]) / row, (c[1] - a[1]) / row, a[0], a[1])
  ctx.drawImage(atlas.image, sx, sy + index % 8 * row, sw, row, 0, 0, sw, row)
  ctx.restore()
}

function paintedRail(ctx, atlas, a, b, height) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  ctx.save()
  ctx.translate(...a); ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]))
  atlas.draw(ctx, 1, -.3, -height / 2, length + .6, height)
  ctx.restore()
}

// A transverse vector on the same 2:1 ground plane as the painted islands.
// Keeping its projected length prevents horizontal spans from becoming tall flat strips.
function crossVector(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const u = dx / 2 + dy, v = dy - dx / 2
  const length = Math.hypot(u, v) || 1
  return [(-v - u) / length, (u - v) / (2 * length)]
}

function drawApproach(ctx, route, end, progress) {
  const path = BRIDGE_APPROACHES[route]?.[end]
  if (!path || progress <= 0) return
  const island = BRIDGE_ENDS[route][end][0]
  const bob = WORLD_ISLANDS[island]._bob || 0
  ctx.save()
  ctx.translate(0, bob)
  ctx.globalAlpha = Math.min(1, progress)
  for (let segment = 0; segment < path.length - 1; segment++) {
    const a = path[segment], b = path[segment + 1]
    const cross = crossVector(a, b)
    const count = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 7))
    const at = (t, side) => [a[0] + (b[0] - a[0]) * t + cross[0] * side * 10.5,
      a[1] + (b[1] - a[1]) * t + cross[1] * side * 10.5]
    for (let i = 0; i < count; i++) {
      const t0 = i / count, t1 = (i + 1) / count
      // Fade the last few paving stones into the island's painted walkway.
      ctx.globalAlpha = Math.min(1, progress) * (segment === path.length - 2 ? 1 - t0 * .75 : 1)
      poly(ctx, [at(t0, -1), at(t1, -1), at(t1, 1), at(t0, 1)], col(i % 2 ? '#dfcfad' : '#ebddbd'), col('#bca883'), .35)
      const mid = at((t0 + t1) / 2, 0), seam = at((t0 + t1) / 2, i % 2 ? 1 : -1)
      line(ctx, ...mid, ...seam, col('#c1af8e'), .35)
    }
  }
  ctx.restore()
}

export function drawBridge(ctx, bridge, time, lights = null, progress = 1) {
  const materials = getPaintedAtlas('bridge')
  const points = bridgeCurve(bridge.route, 48).reverse()
  if (points.length < 2 || progress <= 0) return
  const start = points[0], end = points.at(-1)
  const length = Math.hypot(end[0] - start[0], end[1] - start[1])
  const tangent = [(end[0] - start[0]) / length, (end[1] - start[1]) / length]
  const cross = crossVector(start, end)
  const stone = bridge.type === 'reinforced', damaged = bridge.condition < 40
  const halfWidth = stone ? 10.5 : 9.5
  const count = Math.max(12, Math.ceil(length / 6))
  const sample = (t, side = 0, width = halfWidth) => {
    const f = Math.max(0, Math.min(1, t)) * (points.length - 1)
    const i = Math.min(points.length - 2, Math.floor(f)), mix = f - i
    return [points[i][0] + (points[i + 1][0] - points[i][0]) * mix + cross[0] * side * width,
      points[i][1] + (points[i + 1][1] - points[i][1]) * mix + cross[1] * side * width]
  }
  const trace = (pts, color, width) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.strokeStyle = col(color); ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke()
  }
  const edge = (side) => points.map((_, i) => sample(i / (points.length - 1), side))
  const near = cross[1] >= 0 ? 1 : -1
  const postCount = Math.max(3, Math.ceil(length / 34))
  const railHeight = 13

  // The crossing continues along actual paving on both shores. These paths bob
  // with their own island and leave a clear entrance beyond the bridge rails.
  drawApproach(ctx, bridge.route, 'b', progress * 5)
  drawApproach(ctx, bridge.route, 'a', Math.max(0, (progress - .88) / .12))
  ctx.save()
  // Reveal every layer together from home, including the landings and handrails.
  if (progress < 1) {
    const angle = Math.atan2(tangent[1], tangent[0])
    ctx.translate(...start); ctx.rotate(angle)
    ctx.beginPath(); ctx.rect(-22, -70, (length + 44) * progress, 140); ctx.clip()
    ctx.rotate(-angle); ctx.translate(-start[0], -start[1])
  }

  ctx.globalAlpha = .14
  trace(points.map(([x, y]) => [x, y + 13]), '#141d38', halfWidth * 1.3)
  ctx.globalAlpha = 1
  // Solid near fascia gives the deck thickness, with a continuous supporting stringer.
  const front = edge(near)
  poly(ctx, [...front, ...front.map(([x, y]) => [x, y + 5]).reverse()], col('#755336'))
  trace(edge(-near), '#88633e', 2.2)

  // Deck boards follow the route, but their width follows the island's ground projection.
  for (let i = 0; i < count; i++) {
    const t0 = i / count, t1 = (i + .94) / count
    if (damaged && i % 9 === 4) continue
    if (materials.ready) paintedPlank(ctx, materials, i, sample(t0, -1), sample(t0, 1), sample(t1, -1))
    else poly(ctx, [sample(t0, -1), sample(t1, -1), sample(t1, 1), sample(t0, 1)], col(i % 2 ? '#c49560' : '#d4aa75'), col('#86613e'), .35)
  }
  trace(front, '#8c613b', 1.5)
  // Keep the bracing inside a continuous timber frame, rather than a zigzag silhouette.
  for (let i = 0; i < postCount; i++) {
    const a = sample(i / postCount, near), b = sample((i + 1) / postCount, near)
    line(ctx, a[0], a[1] + 2, b[0], b[1] + 8, col(stone ? '#aa9a82' : '#88643e'), 1.7)
    line(ctx, a[0], a[1] + 8, b[0], b[1] + 2, col('#9f7a4c'), 1)
  }
  trace(front.map(([x, y]) => [x, y + 8]), '#7c5936', 2.2)

  // Flush thresholds join the approach paving. No legs or raised slabs on the path.
  for (const [point, direction] of [[start, 1], [end, -1]]) {
    const corner = (along, side, width) => [point[0] + tangent[0] * along * direction + cross[0] * side * width,
      point[1] + tangent[1] * along * direction + cross[1] * side * width]
    const top = [corner(-11, -1, halfWidth * 1.35), corner(12, -1, halfWidth), corner(12, 1, halfWidth), corner(-11, 1, halfWidth * 1.35)]
    poly(ctx, top, col('#ba8a55'), col('#927047'), .7)
    for (const at of [-6, 0, 6]) line(ctx, ...corner(at, -1, halfWidth), ...corner(at, 1, halfWidth), col('#dec08c'), .65)
  }

  const drawRail = (side) => {
    for (let i = 0; i <= postCount; i++) {
      const t = i / postCount, [x, y] = sample(t, side)
      const endpoint = i === 0 || i === postCount
      const height = endpoint ? railHeight + 3 : railHeight
      // The existing painted gateway pillars frame the ends; do not put new posts on top.
      if (materials.ready && !endpoint) {
        const cell = stone && i % 3 === 0 ? 3 : 2
        const bounds = materials.cells[cell], width = height * bounds[2] / bounds[3]
        materials.draw(ctx, cell, x - width / 2, y - height, width, height)
      } else if (!endpoint) {
        line(ctx, x, y, x, y - height, col('#795235'), 2.4)
        circle(ctx, x, y - height, 1.3, col('#c7a357'))
      }
      if (endpoint) {
        if (lights && (side === near) && (i === 0 || progress >= .98)) lights.push([x, y - 10, 6])
      }
      if (i === postCount) continue
      // Leave the inside of the eastern fork open for the village/crystal paths.
      if (i === 0 && ((bridge.route === 'prism-haven' && side === -near) || (bridge.route === 'hearth-haven' && side === near))) continue
      const cable = []
      for (let j = 0; j <= 8; j++) {
        const u = j / 8, p = sample((i + u) / postCount, side)
        cable.push([p[0], p[1] - railHeight + .7 * Math.sin(u * Math.PI)])
      }
      if (materials.ready) paintedRail(ctx, materials, cable[0], cable.at(-1), side === near ? 2.7 : 2.2)
      else trace(cable, '#a27a48', 2)
      trace(cable.map(([x, y]) => [x, y + 5]), '#9d7b50', 1.3)
    }
  }
  drawRail(-near)
  drawRail(near)
  ctx.restore()
  if (progress < 1) {
    const [x, y] = sample(progress)
    glow(ctx, x, y - 4, 12, '#ffe0a0', .45)
  }
}
