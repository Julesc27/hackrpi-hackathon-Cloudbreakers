// Independent, transparent sprites: the reference painting is never used as a map backdrop.
export const PAINTED_ATLASES = {
  starter: { cells: [[29, 22, 1204, 1211]], src: '/art/starter-island-expanded.webp', columns: 1, rows: 1 },
  forest: { cells: [[24, 26, 1204, 1169]], src: '/art/verdant-forest.webp', columns: 1, rows: 1 },
  prism: { cells: [[15, 38, 1229, 1185]], src: '/art/prism-shelf.webp', columns: 1, rows: 1 },
  civic: { cells: [[134, 2, 534, 505], [858, 41, 550, 463], [108, 545, 562, 459], [866, 552, 572, 461]], src: '/art/islands-civic-layered.webp', columns: 2, rows: 2 },
  settlement: { cells: [[75, 12, 630, 488], [825, 50, 646, 446], [67, 538, 648, 470], [835, 533, 632, 478]], src: '/art/islands-settlement.webp', columns: 2, rows: 2 },
  buildings: { cells: [[26, 46, 308, 289], [382, 68, 324, 252], [741, 65, 327, 268], [1104, 47, 324, 286], [21, 399, 322, 297], [381, 425, 326, 256], [742, 391, 324, 303], [1104, 395, 325, 302], [22, 746, 317, 325], [437, 728, 211, 335], [785, 750, 243, 310], [1105, 780, 323, 262]], src: '/art/buildings.webp', columns: 4, rows: 3 },
}

export const PAINTED_ISLANDS = {
  newHaven: { sheet: 'starter', src: '/art/starter-island-expanded.webp', cell: 0, rect: [445, 185, 660, 645] },
  verdant: { sheet: 'forest', src: '/art/verdant-forest.webp', cell: 0, rect: [120, 20, 470, 395] },
  rain: { sheet: 'civic', cell: 2, rect: [980, 20, 430, 365] },
  prism: { sheet: 'prism', src: '/art/prism-shelf.webp', cell: 0, rect: [1130, 750, 450, 405] },
  mercy: { sheet: 'civic', cell: 3, rect: [-25, 350, 380, 330] },
  hearth: { sheet: 'settlement', cell: 0, rect: [1220, 300, 435, 365] },
}

export const BUILDING_CELLS = {
  shelter: 0, bridgeAnchor: 1, garden: 2, waterCollector: 3,
  storageHouse: 4, solarFarm: 5, market: 6, clinic: 7,
  communityHall: 8, windTurbine: 9, battery: 10, greenhouse: 11,
}

// Each cell's alpha bounds are measured ahead of time (they used to be found by scanning
// every pixel in the browser at load, which froze the page for a moment). If you replace an
// image, re-measure: for each cell, the box around pixels with alpha >= 32, as [x, y, w, h].
export class PaintedAtlas {
  constructor(src, columns, rows, cells) {
    this.cells = cells || []
    this.ready = false
    this.image = new Image()
    this.image.decoding = 'async'
    this.image.onload = () => {
      // decode off the main thread before the first draw, so it doesn't stall a frame
      const done = () => { this.ready = true }
      if (this.image.decode) this.image.decode().then(done, done)
      else done()
    }
    this.image.src = src
  }

  draw(ctx, cell, x, y, width, height) {
    const bounds = this.cells[cell]
    if (!this.ready || !bounds) return false
    ctx.drawImage(this.image, ...bounds, x, y, width, height)
    return true
  }
}

// Share both the image and its measured sprite bounds between the world and panels.
const atlases = new Map()
export function getPaintedAtlas(sheet) {
  if (!atlases.has(sheet)) {
    const { src, columns, rows, cells } = PAINTED_ATLASES[sheet]
    atlases.set(sheet, new PaintedAtlas(src, columns, rows, cells))
  }
  return atlases.get(sheet)
}
