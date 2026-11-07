import { buildingSprite } from './world/paintedArt.js'
import { BUILDINGS } from '../game/data.js'
import PaintedSprite from './PaintedSprite.jsx'

export default function BuildingArt({ type, className = '' }) {
  const { sheet, cell } = buildingSprite(type)
  if (cell == null) return null
  return (
    <PaintedSprite sheet={sheet} cell={cell} label={BUILDINGS[type]?.name || type}
      className={`painted-building-preview ${className}`} />
  )
}
