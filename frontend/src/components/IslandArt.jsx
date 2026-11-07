import { PAINTED_ISLANDS } from './world/paintedArt.js'

// Reuse the same illustrations in the island drawer and chart.
export default function IslandArt({ id, className = '' }) {
  const art = PAINTED_ISLANDS[id]
  if (!art) return null
  const x = art.cell % 2, y = Math.floor(art.cell / 2)
  return (
    <div className={`painted-island-preview ${className}`} role="img" aria-label={`${id} floating island`}>
      <div style={{ backgroundImage: `url(${art.src || `/art/islands-${art.sheet === 'civic' ? 'civic' : 'settlement'}.png`})`, backgroundPosition: art.src ? 'center' : `${x * 100}% ${y * 100}%`, backgroundSize: art.src ? 'contain' : '200% 200%' }} />
    </div>
  )
}
