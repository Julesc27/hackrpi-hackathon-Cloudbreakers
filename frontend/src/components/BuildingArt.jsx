import { BUILDING_CELLS } from './world/paintedArt.js'

export default function BuildingArt({ type, className = '' }) {
  const cell = BUILDING_CELLS[type]
  if (cell == null) return null
  return (
    <div className={`painted-building-preview ${className}`} role="img" aria-label={type}>
      <div style={{ backgroundPosition: `${(cell % 4) / 3 * 100}% ${Math.floor(cell / 4) / 2 * 100}%` }} />
    </div>
  )
}
