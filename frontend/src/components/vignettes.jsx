import IslandArt from './IslandArt.jsx'
import BuildingArt from './BuildingArt.jsx'
import { PAINTED_ISLANDS, BUILDING_CELLS } from './world/paintedArt.js'
import { CloudIcon, Hammer } from './icons.jsx'

// Panel illustrations share the current world artwork instead of older miniature scenes.
export default function Vignette({ kind, className = '' }) {
  const island = kind === 'log' || kind === 'bridgeAnchor' ? 'newHaven' : kind
  if (kind === 'uncharted') {
    return <div className={`vignette uncharted-art ${className}`} role="img" aria-label="Uncharted island behind clouds">
      <CloudIcon size={88} /><span aria-hidden="true">✧</span>
    </div>
  }
  if (kind === 'crossing') {
    return <div className={`vignette crossing-art ${className}`} role="img" aria-label="Route from New Haven to Verdant Reach">
      <svg viewBox="0 0 240 150" aria-hidden="true"><path d="M80 88 Q120 115 166 64" fill="none" stroke="#d9b56e" strokeWidth="3" strokeDasharray="5 5" /></svg>
      <IslandArt id="newHaven" /><IslandArt id="verdant" />
    </div>
  }
  if (PAINTED_ISLANDS[island]) {
    return <div className={`vignette painted-scene ${className}`}>
      <IslandArt id={island} />
      {kind === 'bridgeAnchor' && <span className="workshop-art-badge" aria-label="Workshop upgrade"><Hammer size={24} /></span>}
    </div>
  }
  if (BUILDING_CELLS[kind] != null) {
    return <BuildingArt type={kind} className={`vignette ${className}`} />
  }
  return <IslandArt id="newHaven" className={`vignette ${className}`} />
}
