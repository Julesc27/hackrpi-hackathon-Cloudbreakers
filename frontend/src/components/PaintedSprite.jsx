import { useEffect, useId, useState } from 'react'
import { getPaintedAtlas, PAINTED_ATLASES } from './world/paintedArt.js'

// Fit the actual artwork, rather than the padded atlas cell, into every card.
export function usePaintedAtlas(sheet) {
  const atlas = getPaintedAtlas(sheet)
  const [ready, setReady] = useState(atlas.ready)

  useEffect(() => {
    const loaded = () => setReady(atlas.ready)
    loaded()
    atlas.image.addEventListener('load', loaded)
    return () => atlas.image.removeEventListener('load', loaded)
  }, [atlas])
  return ready ? atlas : null
}

export function SpriteImage({ sheet, cell = 0, ...props }) {
  const atlas = usePaintedAtlas(sheet)
  const clipId = useId()
  const bounds = atlas?.cells[cell]
  if (!bounds) return null
  return (
    <svg viewBox={bounds.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true" {...props}>
      <defs><clipPath id={clipId}><rect x={bounds[0]} y={bounds[1]} width={bounds[2]} height={bounds[3]} /></clipPath></defs>
      <image href={PAINTED_ATLASES[sheet].src} width={atlas.image.naturalWidth} height={atlas.image.naturalHeight} clipPath={`url(#${clipId})`} />
    </svg>
  )
}

export default function PaintedSprite({ sheet, cell = 0, label, className = '' }) {
  return (
    <div className={`painted-sprite ${className}`} role="img" aria-label={label}
      data-art-source={PAINTED_ATLASES[sheet].src} data-art-cell={cell}>
      <SpriteImage sheet={sheet} cell={cell} />
    </div>
  )
}
