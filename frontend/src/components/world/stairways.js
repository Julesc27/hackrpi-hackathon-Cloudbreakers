import { PAINTED_ISLANDS, PAINTED_ATLASES } from './paintedArt.js'

// Stair centre lines and full tread widths, measured in the source paintings.
// Unlike colour tracing, these remain walkable through grey risers and shadows.
const PAINTED_STAIRS = {
  newHaven: [
    { id: 'upper-west', from: [406, 337], to: [385, 368], width: 34 },
    { id: 'upper-west-east', from: [455, 354], to: [438, 387], width: 34 },
    { id: 'beacon', from: [691, 453], to: [710, 530], width: 43 },
    { id: 'grove', from: [238, 599], to: [215, 637], width: 35 },
    { id: 'central-west', from: [454, 613], to: [432, 678], width: 31 },
    { id: 'central-front', from: [708, 698], to: [742, 777], width: 43 },
    { id: 'upper-east', from: [858, 531], to: [835, 560], width: 32 },
    { id: 'east-terrace', from: [1037, 581], to: [1077, 646], width: 37 },
  ],
  verdant: [{ id: 'bridge', from: [938, 539], to: [990, 619], width: 46 }],
  prism: [
    { id: 'crystal', from: [701, 545], to: [725, 602], width: 36 },
    { id: 'west-terrace', from: [564, 601], to: [519, 660], width: 36 },
  ],
}

export const STAIRWAYS = Object.entries(PAINTED_STAIRS).flatMap(([island, flights]) => {
  const art = PAINTED_ISLANDS[island], [x, y, w, h] = art.rect
  const [sx, sy, sw, sh] = PAINTED_ATLASES[art.sheet].cells[art.cell]
  const point = ([px, py]) => [x + (px-sx)*w/sw, y + (py-sy)*h/sh]
  return flights.map(flight => ({ id: `${island}-${flight.id}`, island,
    from: point(flight.from), to: point(flight.to), halfWidth: flight.width*Math.min(w/sw, h/sh)/2 }))
})

export function stairProjection(stair, point) {
  const dx = stair.to[0]-stair.from[0], dy = stair.to[1]-stair.from[1]
  const length = Math.hypot(dx, dy)
  const t = ((point[0]-stair.from[0])*dx + (point[1]-stair.from[1])*dy)/(length*length)
  const clamped = Math.max(0, Math.min(1, t))
  return { t, length, direction: [dx/length, dy/length],
    distance: Math.hypot(point[0]-stair.from[0]-clamped*dx, point[1]-stair.from[1]-clamped*dy) }
}
