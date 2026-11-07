// Paths to painted art cut from the concept images (public/art)
export const islandCardArt = (id) =>
  id === 'rain' ? '/art/card-rain.webp' : id === 'verdant' ? '/art/card-verdant.webp' : `/art/island-${id}.webp`

// Round badge shown on island cards: an image file or a painted icon
export const ISLAND_BADGE = {
  rain: { img: '/art/badge-drop.webp' },
  gardens: { img: '/art/badge-leaf.webp' },
  verdant: { icon: 'wood', ring: '#2f6a3c' },
  mistral: { icon: 'energy', ring: '#2b3f8f' },
  mercy: { icon: 'happiness', ring: '#8a3a54' },
  hearth: { icon: 'coins', ring: '#7a4b22' },
  skyport: { icon: 'coins', ring: '#4b3f8f' },
  newHaven: { icon: 'sun', ring: '#1f2a5a' },
}
