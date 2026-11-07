import { BUILDING_CELLS } from './world/paintedArt.js'
import { BUILDINGS } from '../game/data.js'
import PaintedSprite from './PaintedSprite.jsx'

export default function BuildingArt({ type, className = '' }) {
  const cell = BUILDING_CELLS[type]
  if (cell == null) return null
  return (
    <PaintedSprite sheet="buildings" cell={cell} label={BUILDINGS[type]?.name || type}
      className={`painted-building-preview ${className}`} />
  )
}
