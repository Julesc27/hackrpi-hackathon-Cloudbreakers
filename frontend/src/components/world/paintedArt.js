// Independent, transparent sprites: the reference painting is never used as a map backdrop.
export const PAINTED_ATLASES = {
  starter: { src: '/art/starter-island-expanded.png', columns: 1, rows: 1 },
  forest: { src: '/art/verdant-forest.png', columns: 1, rows: 1 },
  prism: { src: '/art/prism-shelf.png', columns: 1, rows: 1 },
  civic: { src: '/art/islands-civic-layered.png', columns: 2, rows: 2 },
  settlement: { src: '/art/islands-settlement.png', columns: 2, rows: 2 },
  buildings: { src: '/art/buildings.png', columns: 4, rows: 3 },
}

export const PAINTED_ISLANDS = {
  newHaven: { sheet: 'starter', src: '/art/starter-island-expanded.png', cell: 0, rect: [445, 185, 660, 645] },
  verdant: { sheet: 'forest', src: '/art/verdant-forest.png', cell: 0, rect: [120, 20, 470, 395] },
  rain: { sheet: 'civic', cell: 2, rect: [980, 20, 430, 365] },
  prism: { sheet: 'prism', src: '/art/prism-shelf.png', cell: 0, rect: [1130, 750, 450, 405] },
  mercy: { sheet: 'civic', cell: 3, rect: [-25, 350, 380, 330] },
  hearth: { sheet: 'settlement', cell: 0, rect: [1220, 300, 435, 365] },
}

export const BUILDING_CELLS = {
  shelter: 0, bridgeAnchor: 1, garden: 2, waterCollector: 3,
  storageHouse: 4, solarFarm: 5, market: 6, clinic: 7,
  communityHall: 8, windTurbine: 9, battery: 10, greenhouse: 11,
}

// Bound each cell by its alpha so different sprite margins don't change its world position.
// This runs once at load, never during animation or zooming.
export class PaintedAtlas {
  constructor(src, columns, rows) {
    this.cells = []
    this.ready = false
    this.image = new Image()
    this.image.onload = () => {
      const image = this.image
      const width = image.naturalWidth / columns, height = image.naturalHeight / rows
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        context.clearRect(0, 0, width, height)
        context.drawImage(image, column * width, row * height, width, height, 0, 0, width, height)
        const pixels = context.getImageData(0, 0, width, height).data
        let left = width, top = height, right = 0, bottom = 0
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if (pixels[(y * width + x) * 4 + 3] < 32) continue
          left = Math.min(left, x); right = Math.max(right, x)
          top = Math.min(top, y); bottom = Math.max(bottom, y)
        }
        this.cells.push(right > left ? [column * width + left, row * height + top, right - left + 1, bottom - top + 1] : null)
      }
      this.ready = true
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
    const { src, columns, rows } = PAINTED_ATLASES[sheet]
    atlases.set(sheet, new PaintedAtlas(src, columns, rows))
  }
  return atlases.get(sheet)
}
