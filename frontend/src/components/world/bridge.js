import { bridgeCurve } from './people.js'
import { col, poly, line, circle, glow } from './iso.js'

// A transverse vector on the same 2:1 ground plane as the painted islands.
// Keeping its projected length prevents horizontal spans from becoming tall flat strips.
function crossVector(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const u = dx / 2 + dy, v = dy - dx / 2
  const length = Math.hypot(u, v) || 1
  return [(-v - u) / length, (u - v) / (2 * length)]
}

export function drawBridge(ctx, bridge, time, lights = null, progress = 1) {
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
  const postCount = Math.max(3, Math.ceil(length / 38))
  const railHeight = 13

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
  poly(ctx, [...front, ...front.map(([x, y]) => [x, y + 5]).reverse()], col(stone ? '#9a8b77' : '#65452f'))
  trace(edge(-near), stone ? '#b8a68a' : '#805938', 2.2)

  // Deck boards follow the route, but their width follows the island's ground projection.
  for (let i = 0; i < count; i++) {
    const t0 = i / count, t1 = (i + .94) / count
    if (damaged && i % 9 === 4) continue
    const colors = stone ? ['#ded2ba', '#eee3cc', '#d6c9b1'] : ['#c49560', '#d4aa75', '#b9844d', '#d0a06a']
    poly(ctx, [sample(t0, -1), sample(t1, -1), sample(t1, 1), sample(t0, 1)], col(colors[i % colors.length]), col(stone ? '#b0a08a' : '#86613e'), .35)
    const a = sample(t0 + .15 / count, -.82), b = sample(t0 + .15 / count, .82)
    line(ctx, ...a, ...b, col(stone ? '#f5ecd9' : '#ebc995'), .45)
  }
  trace(front, stone ? '#d0b779' : '#8c613b', 1.5)

  // A flared threshold overlaps each shore; short supports visually tie it into the cliff.
  for (const [point, direction] of [[start, 1], [end, -1]]) {
    const corner = (along, side, width) => [point[0] + tangent[0] * along * direction + cross[0] * side * width,
      point[1] + tangent[1] * along * direction + cross[1] * side * width]
    const top = [corner(-11, -1, halfWidth * 1.35), corner(12, -1, halfWidth), corner(12, 1, halfWidth), corner(-11, 1, halfWidth * 1.35)]
    poly(ctx, [top[2], top[3], [top[3][0], top[3][1] + 6], [top[2][0], top[2][1] + 6]], col(stone ? '#b2a18b' : '#785334'))
    poly(ctx, top, col(stone ? '#e7dcc5' : '#ba8a55'), col('#927047'), .7)
    for (const at of [-6, 0, 6]) line(ctx, ...corner(at, -1, halfWidth), ...corner(at, 1, halfWidth), col(stone ? '#c3b49a' : '#dec08c'), .65)
    for (const side of [-1, 1]) {
      const [x, y] = corner(-6, side, halfWidth * 1.23)
      line(ctx, x, y + 13, x, y - 1, col(stone ? '#998976' : '#745136'), 3.2)
    }
  }

  const drawRail = (side) => {
    for (let i = 0; i <= postCount; i++) {
      const t = i / postCount, [x, y] = sample(t, side)
      const endpoint = i === 0 || i === postCount
      const height = endpoint ? railHeight + 3 : railHeight
      poly(ctx, [[x - 1.6, y], [x + 1.6, y + .7], [x + 1.2, y - height], [x - 1.2, y - height - .5]], col(stone ? '#d8ccb5' : '#795235'), col(stone ? '#a49377' : '#573a29'), .45)
      line(ctx, x - .7, y - 1, x - .7, y - height, col(stone ? '#eee2c9' : '#bd9258'), .65)
      circle(ctx, x, y - height, endpoint ? 2 : 1.3, col('#c7a357'))
      if (endpoint) {
        circle(ctx, x, y - height - 4, 1.7, col('#ffdf9b'))
        if (lights && (side === near) && (i === 0 || progress >= .98)) lights.push([x, y - height - 4, 8])
      }
      if (i === postCount) continue
      const cable = []
      for (let j = 0; j <= 8; j++) {
        const u = j / 8, p = sample((i + u) / postCount, side)
        cable.push([p[0], p[1] - railHeight + (stone ? .6 : 2.3) * Math.sin(u * Math.PI)])
      }
      trace(cable, stone ? '#b59a53' : '#876344', side === near ? 1.7 : 1.2)
      trace(cable.map(([x, y]) => [x, y + 4.5]), stone ? '#c6b17e' : '#9d7b50', .7)
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
