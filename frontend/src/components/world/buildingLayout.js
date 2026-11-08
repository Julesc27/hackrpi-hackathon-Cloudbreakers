import { STARTER_PLOT_WIDTHS } from '../../game/mapLayout.js'

// Plot coordinates mark the centre of the stone foundation, not the sprite's bottom tip.
// The canvas, placement ghost and inspect target all use this same footprint.
export function buildingLayout(type, island, slot, bounds) {
  const desiredWidth = type === 'shelter' ? 52 : type === 'communityHall' ? 82 : 62
  const width = island === 'newHaven'
    ? Math.min(desiredWidth, STARTER_PLOT_WIDTHS[slot] || desiredWidth)
    : desiredWidth * .8
  const aspect = bounds ? bounds[3] / bounds[2] : type === 'windTurbine' ? 1.55 : .95
  const height = width * aspect
  const foundation = type === 'shelter' ? .93 : type === 'windTurbine' ? .92 : .84
  return { x: -width / 2, y: -height * foundation, width, height,
    groundWidth: width * (type === 'shelter' ? .35 : .44),
    groundDepth: width * (type === 'shelter' ? .10 : .16),
  }
}

// Solid ground occupied by the whole isometric base, plus walking clearance.
// The smaller groundWidth/groundDepth above describe the painted shadow only.
export function buildingObstacle(type, island, slot, clearance = 1.5) {
  const { width } = buildingLayout(type, island, slot)
  return { rx: width*.5 + clearance, ry: width*.25 + clearance }
}
