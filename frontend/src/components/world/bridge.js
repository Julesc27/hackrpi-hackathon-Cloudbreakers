import { bridgeCurve } from './people.js'
import { WORLD_ISLANDS, PRISM_GATE, BRIDGE_GATE_INSETS, BRIDGE_GATEWAYS } from './layout.js'
import { col, poly, line, circle, glow } from './iso.js'
import { getPaintedAtlas } from './paintedArt.js'
import { cloudBank } from './island.js'

const supportClouds = new Map()
function supportCloud(seed) {
  if (!supportClouds.has(seed)) {
    const canvas = document.createElement('canvas')
    canvas.width = 80; canvas.height = 40
    const brush = canvas.getContext('2d')
    brush.filter = 'blur(1.4px)'
    cloudBank(brush, 40, 23, 32, seed, false)
    supportClouds.set(seed, canvas)
  }
  return supportClouds.get(seed)
}

// The painted grain is projected onto the live deck, so islands can still float.
function paintedPlank(ctx, atlas, index, a, b, c) {
  const [sx, sy, sw, sh] = atlas.cells[0], row = sh / 8
  ctx.save()
  ctx.transform((b[0] - a[0]) / sw, (b[1] - a[1]) / sw,
    (c[0] - a[0]) / row, (c[1] - a[1]) / row, a[0], a[1])
  ctx.drawImage(atlas.image, sx, sy + index % 8 * row, sw, row, 0, 0, sw, row)
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

// Reuse the island's own painted masonry for the new lower-terrace gateway.
// Render the threshold below the deck and its front pier above it.
const gatewayLayers = new Map()
function gatewayLayer(atlas, foreground) {
  if (gatewayLayers.has(foreground)) return gatewayLayers.get(foreground)
  // Include the whole lamp and foliage, then soften the surrounding terrain.
  // Cache the composite so masking never runs in the animation loop.
  const bounds = foreground ? [1138, 656, 39, 64] : [1106, 552, 151, 230]
  const [x, y, w, h] = bounds
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const brush = canvas.getContext('2d')
  brush.drawImage(atlas.image, x, y, w, h, 0, 0, w, h)
  brush.globalCompositeOperation = 'destination-in'
  const feather = (x0, y0, x1, y1, fade) => {
    const gradient = brush.createLinearGradient(x0, y0, x1, y1)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(fade, 'rgba(0,0,0,1)')
    gradient.addColorStop(1, 'rgba(0,0,0,1)')
    brush.fillStyle = gradient
    brush.fillRect(0, 0, w, h)
  }
  feather(0, 0, w, 0, foreground ? 8/w : 40/w)
  feather(w, 0, 0, 0, foreground ? 8/w : 12/w)
  feather(0, 0, 0, h, foreground ? 6/h : 34/h)
  feather(0, h, 0, 0, foreground ? 14/h : 36/h)
  const layer = { canvas, bounds }
  gatewayLayers.set(foreground, layer)
  return layer
}

export function drawPrismGateway(ctx, progress = 1, foreground = false) {
  const atlas = getPaintedAtlas('starter')
  if (!atlas.ready || progress <= 0) return
  const sx = 660 / 1204, sy = 645 / 1211
  const { canvas, bounds: [x, y, w, h] } = gatewayLayer(atlas, foreground)
  ctx.save()
  ctx.translate(0, WORLD_ISLANDS.newHaven._bob || 0)
  ctx.globalAlpha = Math.min(1, progress * 5)
  ctx.drawImage(canvas, PRISM_GATE[0] + (x - 1186) * sx,
    PRISM_GATE[1] + (y - 650) * sy, w * sx, h * sy)
  ctx.restore()
}

export function drawBridge(ctx, bridge, time, lights = null, progress = 1) {
  const materials = getPaintedAtlas('bridge')
  const points = bridgeCurve(bridge.route, 48, bridge.type).reverse()
  if (points.length < 2 || progress <= 0) return
  const start = points[0], end = points.at(-1)
  const length = Math.hypot(end[0] - start[0], end[1] - start[1])
  const tangent = [(end[0] - start[0]) / length, (end[1] - start[1]) / length]
  const cross = crossVector(start, end)
  const stone = bridge.type === 'reinforced', damaged = bridge.condition < 40
  const halfWidth = stone ? 12 : 10.5
  const gateway = BRIDGE_GATEWAYS[bridge.route]?.home
  const count = Math.max(12, Math.ceil(length / 6))
  const sample = (t, side = 0, width = halfWidth) => {
    const f = Math.max(0, Math.min(1, t)) * (points.length - 1)
    const i = Math.min(points.length - 2, Math.floor(f)), mix = f - i
    const entryWidth = .8 + .2 * Math.min(1, t * length / 18, (1-t) * length / 18)
    const shoulder = gateway ? Math.max(0, 1 - t * length / 35) : 0
    const offset = cross.map((value, axis) => value * halfWidth * entryWidth
      + shoulder * ((gateway?.cross[axis] || 0) - value * halfWidth * .8))
    return [points[i][0] + (points[i + 1][0] - points[i][0]) * mix + offset[0] * side * width / halfWidth,
      points[i][1] + (points[i + 1][1] - points[i][1]) * mix + offset[1] * side * width / halfWidth]
  }
  const trace = (pts, color, width) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    ctx.strokeStyle = col(color); ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke()
  }
  const edge = (side) => points.map((_, i) => sample(i / (points.length - 1), side))
  const near = cross[1] >= 0 ? 1 : -1
  const postCount = Math.max(6, Math.ceil(length / 18))
  const inset = BRIDGE_GATE_INSETS[bridge.route]
  const homeGate = inset.home / length, awayGate = 1 - inset.away / length

  ctx.save()
  // Reveal every layer together from home, including the landings and handrails.
  if (progress < 1) {
    const angle = Math.atan2(tangent[1], tangent[0])
    ctx.translate(...start); ctx.rotate(angle)
    ctx.beginPath(); ctx.rect(-22, -80, (length + 44) * progress, stone ? 210 : 150); ctx.clip()
    ctx.rotate(-angle); ctx.translate(-start[0], -start[1])
  }

  ctx.globalAlpha = .14
  trace(points.slice(3, -3).map(([x, y]) => [x, y + 13]), '#141d38', halfWidth * 1.3)
  ctx.globalAlpha = 1
  if (stone) {
    const supportCount = Math.max(1, Math.ceil(length / 180) - 1)
    const bays = [homeGate, ...Array.from({ length: supportCount }, (_, i) =>
      homeGate + (awayGate - homeGate) * (i + 1) / (supportCount + 1)), awayGate]
    // Curved timber braces rise from the piers to the heavier deck frame.
    for (let bay = 0; bay < bays.length - 1; bay++) {
      const leftDepth = bay === 0 ? 8 : 34, rightDepth = bay === bays.length-2 ? 8 : 34
      const archDepth = u => 10 + (leftDepth-10)*Math.max(0, 1-2*u)**2 + (rightDepth-10)*Math.max(0, 2*u-1)**2
      const arch = Array.from({ length: 17 }, (_, i) => {
        const u = i / 16, p = sample(bays[bay] + (bays[bay+1] - bays[bay]) * u, near)
        return [p[0], p[1] + archDepth(u)]
      })
      trace(arch, '#594534', 6)
      trace(arch.map(([x,y]) => [x,y-1]), '#b08b57', 3)
      for (const u of [.25, .5, .75]) {
        const p = sample(bays[bay] + (bays[bay+1] - bays[bay]) * u, near)
        line(ctx, p[0], p[1]+5, p[0], p[1]+archDepth(u), col('#745536'), 2.8)
      }
      for (const u of [.25, .75]) {
        const p = sample(bays[bay] + (bays[bay+1] - bays[bay]) * u, near)
        const anchor = sample(u < .5 ? bays[bay] : bays[bay+1], near)
        const bottom = anchor[1] + (u < .5 ? leftDepth : rightDepth)
        line(ctx, anchor[0], bottom, p[0], p[1]+6, col('#654c34'), 4)
        line(ctx, anchor[0], bottom-1, p[0], p[1]+5, col('#b38e59'), 1.4)
      }
    }
    for (const t of bays.slice(1, -1)) {
      const [x, y] = sample(t, near), base = y + 48
      poly(ctx, [[x-10,y+6],[x+7,y+6],[x+13,y+2],[x-4,y+2]], col('#d8d0bd'), col('#908c8c'), .7)
      poly(ctx, [[x+7,y+6],[x+13,y+2],[x+13,base],[x+7,base+4]], col('#8e8fa1'), col('#686d84'), .6)
      poly(ctx, [[x-10,y+6],[x+7,y+6],[x+7,base+4],[x-10,base+4]], col('#c4bda8'))
      if (materials.ready) {
        const [sx, sy, sw, sh] = materials.cells[3]
        ctx.drawImage(materials.image, sx+sw*.77, sy+sh*.35, sw*.14, sh*.43, x-10, y+6, 17, 42)
      }
      for (let row = 1; row < 6; row++) line(ctx, x-10, y+6+row*7, x+7, y+6+row*7, col('#93909a'), .65)
      poly(ctx, [[x-13,base],[x+7,base],[x+16,base-4],[x+16,base+3],[x+7,base+7],[x-13,base+7]], col('#b9b7b4'), col('#7e8192'), .6)
      ctx.drawImage(supportCloud(Math.round(t*1000)), x-39, base-14)
      // Warm lamps on the support columns match the gateway lanterns.
      line(ctx, x-2, y+12, x-2, y+20, col('#a27e45'), 2.8)
      line(ctx, x-2, y+13, x-2, y+18, col('#ffe0a0'), 1.6)
      if (lights) lights.push([x-2, y+15, 8])
    }
  }
  // Solid near fascia gives the deck thickness, with a continuous supporting stringer.
  const front = edge(near)
  const depth = t => Math.min(1, t * length / 20, (1-t) * length / 20)
  poly(ctx, [...front, ...front.map(([x, y],i) => [x, y + (stone ? 9 : 5) * depth(i/(front.length-1))]).reverse()], col(stone ? '#625144' : '#755336'))
  trace(edge(-near), '#88633e', 2.2)

  // Deck boards follow the route, but their width follows the island's ground projection.
  for (let i = 0; i < count; i++) {
    const t0 = i / count, t1 = (i + .94) / count
    if (damaged && i % 9 === 4) continue
    if (materials.ready) paintedPlank(ctx, materials, i, sample(t0, -1), sample(t0, 1), sample(t1, -1))
    else poly(ctx, [sample(t0, -1), sample(t1, -1), sample(t1, 1), sample(t0, 1)], col(i % 2 ? '#c49560' : '#d4aa75'), col('#86613e'), .35)
  }
  trace(front, '#8c613b', 1.5)
  if (stone) {
    trace(front.map(([x,y]) => [x,y+3]), '#c1a272', 1.4)
    trace(front.map(([x,y],i) => [x,y+8*depth(i/(front.length-1))]), '#4d4540', 2.5)
    for (let i = 1; i < postCount; i++) {
      const p = sample(i/postCount, near)
      circle(ctx, p[0], p[1]+4, 1.05, col('#c4b5a0'))
    }
  }
  // A slim curved timber frame follows the sagging deck, without a rigid truss.
  trace(front.map(([x, y], i) => [x, y + 4 * depth(i / (front.length - 1))]), '#8a6945', 2)

  const lantern = (x, y) => {
    glow(ctx, x, y - 4, 13, '#ffcf75', .28)
    poly(ctx, [[x-3,y-7],[x+3,y-7],[x+2.3,y],[x-2.3,y]], col('#ffe6a1'), col('#9e743b'), .65)
    line(ctx, x, y-7, x, y, col('#bd9046'), .65)
    poly(ctx, [[x-4,y-7],[x,y-10],[x+4,y-7]], col('#a78244'), col('#e4c17e'), .6)
    line(ctx, x, y-10, x, y-12, col('#c5a362'), .8)
    line(ctx, x-2.6, y+.5, x+2.6, y+.5, col('#96703d'), 1)
    if (lights) lights.push([x, y-4, 12])
  }
  const towerPosition = (t, side) => {
    if (gateway && t === homeGate) {
      const p = side === near ? gateway.near : gateway.far
      return [p[0], p[1] + (WORLD_ISLANDS.newHaven._bob || 0)]
    }
    return sample(t, side, halfWidth + 7)
  }
  const tower = (t, side) => {
    // Stand outside the walking surface, leaving a clear gateway between piers.
    const [x, floor] = towerPosition(t, side)
    const base = floor + 4, height = 40, width = 21
    if (materials.ready) {
      const [sx, sy, sw, sh] = materials.cells[3]
      // Omit the atlas's round finial; a lit lantern crowns each tower instead.
      ctx.drawImage(materials.image, sx, sy+76, sw, sh-76, x-width/2, base-height, width, height)
    } else {
      poly(ctx, [[x-9,base],[x+9,base],[x+9,base-height],[x-9,base-height]], col('#d1c7b0'), col('#8b8997'), .7)
    }
    lantern(x, base-height-1)
    // Small trailing vines soften the junction between masonry and cliff.
    if (side === near) for (let strand = 0; strand < 2; strand++) {
      const vx = x - 8 + strand * 14
      for (let j = 0; j < 7; j++) {
        const vy = base - 5 + j * 2.7, px = vx + Math.sin(j*1.8 + strand)*1.5
        line(ctx, vx, vy-2, px, vy+2, col('#657944'), .7)
        circle(ctx, px + (j%2 ? 1.2 : -1.2), vy, 1.35, col(j%2 ? '#7e9454' : '#586f40'))
      }
    }
  }
  const drawRail = (side) => {
    if (stone) {
      // Reinforced bridges have short posts and rigid rails instead of tall suspension ropes.
      for (let i = 0; i <= postCount; i++) {
        const p = sample(i/postCount, side)
        line(ctx, p[0], p[1], p[0], p[1]-9, col('#665d53'), 2.2)
        circle(ctx, p[0], p[1]-9, 1.6, col('#aaa393'))
      }
      trace(edge(side).map(([x,y]) => [x,y-8]), '#68665f', 2.5)
      trace(edge(side).map(([x,y]) => [x,y-8.5]), '#b4a688', .9)
      trace(edge(side).map(([x,y]) => [x,y-3.5]), '#987b52', 1)
      return
    }
    const cable = u => {
      const t = homeGate + (awayGate - homeGate) * u
      const height = 11 + 19 * (2*u-1)**2
      const p = sample(t, side, halfWidth + 7 * Math.abs(2*u-1)**6)
      const anchor = towerPosition(homeGate, side), shoulder = sample(homeGate, side, halfWidth + 7)
      p[0] += (anchor[0] - shoulder[0]) * (1-u)**4
      p[1] += (anchor[1] - shoulder[1]) * (1-u)**4
      return [p[0], p[1] - height]
    }
    const cablePoints = points.map((_, i) => cable(i/(points.length-1)))
    for (let i = 1; i < postCount; i++) {
      const u = i / postCount, t = homeGate + (awayGate - homeGate) * u
      const bottom = sample(t, side), top = cable(u)
      line(ctx, ...top, bottom[0], bottom[1]-1, col('#b99757'), .85)
      line(ctx, top[0]+.4, top[1], bottom[0]+.4, bottom[1]-1, col('#eed49b'), .3)
    }
    trace(cablePoints, '#85663b', 2.1)
    trace(cablePoints.map(([x,y]) => [x,y-.45]), '#dbb875', 1.15)
    trace(edge(side).map(([x,y]) => [x,y-6]), '#ab844c', 1.25)
    trace(edge(side).map(([x,y]) => [x,y-6.5]), '#dec18b', .45)
  }
  // Far masonry is behind the suspension lines; near masonry frames the entrances.
  tower(homeGate, -near)
  tower(awayGate, -near)
  drawRail(-near)
  drawRail(near)
  tower(homeGate, near)
  tower(awayGate, near)
  ctx.restore()
  if (progress < 1) {
    const [x, y] = sample(progress)
    glow(ctx, x, y - 4, 12, '#ffe0a0', .45)
  }
}
