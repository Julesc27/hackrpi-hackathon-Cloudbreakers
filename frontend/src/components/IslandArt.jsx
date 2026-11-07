import { PAINTED_ISLANDS } from './world/paintedArt.js'
import { ISLANDS } from '../game/data.js'
import PaintedSprite from './PaintedSprite.jsx'

// Reuse the same illustrations in the island drawer and chart.
export default function IslandArt({ id, className = '' }) {
  const art = PAINTED_ISLANDS[id]
  if (!art) return null
  return (
    <PaintedSprite sheet={art.sheet} cell={art.cell} label={`${ISLANDS[id].name} floating island`}
      className={`painted-island-preview ${className}`} />
  )
}
