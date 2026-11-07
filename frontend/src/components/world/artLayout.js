// Where each painted island sits in the 1600×900 world frame.
// The webps in /art are crops of the concept painting at 1.6× this grid,
// aligned so paths, bridges and residents stay on the illustrated ground.
export const ART_SCALE = 1 / 1.6

export const ISLAND_ART = {
  newHaven: [507.5, 220.8],
  mistral: [147.9, 48.6],
  rain: [691.6, 103.6],
  mercy: [147.4, 273.7],
  hearth: [980.3, 333.4],
  verdant: [337.5, 547.8],
  gardens: [729.1, 594.5],
  skyport: [1344.3, 372.2],
}

// Armillary orb on the painted New Haven tower (grid units).
export const PAINTED_BEACON = [765, 287]

const images = {}
export function islandImage(id) {
  if (!ISLAND_ART[id]) return null
  if (!images[id]) {
    const img = new Image()
    img.decoding = 'async'
    img.src = `/art/island-${id}.webp`
    images[id] = img
  }
  return images[id]
}

export function artReady(id) {
  const img = islandImage(id)
  return !!(img && img.complete && img.naturalWidth)
}
