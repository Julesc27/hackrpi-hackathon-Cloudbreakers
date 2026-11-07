import { useEffect, useRef, useState, useCallback } from 'react'
import { RES_ICON } from '../icons.jsx'
import { INTERACTION_POINTS } from '../../game/mapLayout.js'
import { WORLD } from '../map/Camera.jsx'
import { useUI } from '../../game/GameContext.jsx'

// Resources that have a tile in the TopBar. Everything else flies to the storage box.
const TOP_BAR_RESOURCES = new Set(['energy', 'water', 'happiness', 'food', 'wood', 'stone', 'coins'])

function ResIcon({ res, size = 20 }) {
  const Icon = RES_ICON[res]
  return Icon ? <Icon size={size} /> : null
}

/** Returns the screen-space centre of the site icon (start of the flight). */
function getSiteScreenPos(siteId, worldX, worldY, cam) {
  // Try a tagged DOM element first
  if (siteId) {
    const el =
      document.querySelector(`[data-site-id="${siteId}"]`) ||
      document.querySelector(`[data-site-action="${siteId}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
    }
  }

  // Convert world coordinates via camera transform
  const pt =
    worldX != null && worldY != null
      ? [worldX, worldY]
      : siteId
      ? INTERACTION_POINTS[siteId]
      : null
  if (pt && cam) {
    const c = cam.view?.() || cam
    const camEl = document.querySelector('.camera')
    const cr = camEl ? camEl.getBoundingClientRect() : { left: 0, top: 0 }
    return {
      x: cr.left + (pt[0] - WORLD.x) * c.s + c.x,
      y: cr.top + (pt[1] - WORLD.y) * c.s + c.y,
    }
  }

  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

/**
 * Returns the screen-space centre of the destination for this resource:
 *   • TopBar tile  → if the resource is shown in the top bar
 *   • Storage button (bottom nav) → for all other resources (seeds, crystals, fish, materials…)
 *
 * Also returns `inTopBar` so callers can arc tokens in the right direction.
 */
function getResourceTargetPos(res) {
  if (TOP_BAR_RESOURCES.has(res)) {
    const el = document.querySelector(`[data-resource="${res}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, inTopBar: true }
    }
  }

  // Not in the top bar — target the Storage nav button at the bottom
  const storageEl =
    document.querySelector('[data-tutorial="nav-storage"]') ||
    document.querySelector('.bottom-nav')
  if (storageEl) {
    const r = storageEl.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, inTopBar: false }
  }

  return { x: window.innerWidth / 2, y: window.innerHeight - 60, inTopBar: false }
}

/** Returns the DOM element that should receive the bump animation on token landing. */
function getBumpTarget(res) {
  if (TOP_BAR_RESOURCES.has(res)) {
    const el = document.querySelector(`[data-resource="${res}"]`)
    if (el) return el
  }
  return (
    document.querySelector('[data-tutorial="nav-storage"]') ||
    document.querySelector('.bottom-nav')
  )
}

export default function FlyingResources() {
  const ui = useUI()
  const [particles, setParticles] = useState([])
  const [impacts, setImpacts] = useState([])
  const particleRefs = useRef(new Map())
  const particlesRef = useRef([])
  particlesRef.current = particles
  const nextId = useRef(1)

  const triggerArrival = useCallback((p) => {
    // 1. Impact flash at landing position
    const impactId = nextId.current++
    setImpacts((prev) => [
      ...prev,
      { id: impactId, x: p.targetX, y: p.targetY, res: p.res },
    ])
    setTimeout(() => {
      setImpacts((prev) => prev.filter((x) => x.id !== impactId))
    }, 450)

    // 2. Bounce the target element (top bar tile or storage button)
    const targetEl = getBumpTarget(p.res)
    if (targetEl) {
      targetEl.classList.remove('res-bump')
      void targetEl.offsetWidth // force reflow to restart animation
      targetEl.classList.add('res-bump')
    }

    // 3. Notify other components (TopBar gain flash, etc.)
    window.dispatchEvent(
      new CustomEvent('cloudbreakers:resource-token-arrive', {
        detail: {
          res: p.res,
          amount: p.amount,
          isLast: p.isLast,
          fromBubble: p.fromBubble,
          totalAmount: p.totalAmount,
        },
      })
    )

    // 4. Remove this particle
    particleRefs.current.delete(p.id)
    setParticles((prev) => prev.filter((item) => item.id !== p.id))
  }, [])

  // Listen for fly-resource events fired by Fx.jsx after each gather or bubble tap
  useEffect(() => {
    const onFly = (e) => {
      const detail = e.detail || {}
      const res = detail.res || 'wood'
      const totalAmount = detail.amount || 1
      const cam = ui.camera?.current

      let startPos
      if (detail.startX != null && detail.startY != null) {
        startPos = { x: detail.startX, y: detail.startY }
      } else {
        startPos = getSiteScreenPos(detail.siteId, detail.worldX, detail.worldY, cam)
      }

      const { x: targetX, y: targetY, inTopBar } = getResourceTargetPos(res)

      // 2–5 tokens per resource, staggered
      const count = Math.min(5, Math.max(2, Math.round(totalAmount / 1.5)))
      const portion = Math.max(1, Math.floor(totalAmount / count))
      const remainder = totalAmount - portion * count

      const now = performance.now()
      const delayOffset = detail.delayOffset || 0
      const newParticles = []

      for (let i = 0; i < count; i++) {
        const id = nextId.current++
        const tokenAmount = portion + (i === count - 1 ? remainder : 0)
        const delay = delayOffset + i * 70
        const duration = 680 + (i % 2) * 40

        // Fan-out burst from the origin icon
        const fan = i - (count - 1) / 2
        const burstAngle = -Math.PI / 2 + fan * 0.45
        const burstDist = 32 + (i % 2) * 14
        const burstX = Math.cos(burstAngle) * burstDist
        const burstY = Math.sin(burstAngle) * burstDist

        // Bézier control point:
        //   • Top-bar targets  → arc peaks above both endpoints (tokens arc upward)
        //   • Storage targets  → arc peaks above the start point (tokens lob downward)
        const midX = (startPos.x + targetX) / 2
        const controlX = midX + fan * 50
        const controlY = inTopBar
          ? Math.min(startPos.y, targetY) - 55 - Math.abs(startPos.x - targetX) * 0.08
          : startPos.y - 70 - Math.abs(startPos.x - targetX) * 0.04

        newParticles.push({
          id,
          res,
          amount: tokenAmount,
          totalAmount,
          fromBubble: detail.fromBubble,
          isLast: i === count - 1,
          inTopBar,
          startX: startPos.x,
          startY: startPos.y,
          burstX,
          burstY,
          controlX,
          controlY,
          targetX,
          targetY,
          startTime: now + delay,
          duration,
        })
      }

      setParticles((prev) => [...prev, ...newParticles])
    }

    window.addEventListener('cloudbreakers:fly-resource', onFly)
    return () => window.removeEventListener('cloudbreakers:fly-resource', onFly)
  }, [ui.camera])

  // RAF loop — drives smooth motion without per-frame React re-renders
  useEffect(() => {
    let animId

    const step = () => {
      const now = performance.now()
      const active = particlesRef.current

      for (const p of active) {
        const el = particleRefs.current.get(p.id)
        if (!el) continue

        const elapsed = now - p.startTime
        if (elapsed < 0) {
          el.style.opacity = '0'
          continue
        }

        const t = Math.min(1, elapsed / p.duration)
        let curX, curY, scale, opacity

        if (t < 0.16) {
          // Phase 1: pop outward from the harvest site / building
          const k = t / 0.16
          const popEase = Math.sin((k * Math.PI) / 2)
          curX = p.startX + p.burstX * popEase
          curY = p.startY + p.burstY * popEase
          scale = 0.5 + 0.65 * popEase
          opacity = Math.min(1, k * 1.8)
        } else {
          // Phase 2: arc to destination
          const k = (t - 0.16) / 0.84
          const easeK = k * k * (3 - 2 * k) // smoothstep
          const bx = p.startX + p.burstX
          const by = p.startY + p.burstY
          const mk = 1 - easeK
          curX = mk * mk * bx + 2 * mk * easeK * p.controlX + easeK * easeK * p.targetX
          curY = mk * mk * by + 2 * mk * easeK * p.controlY + easeK * easeK * p.targetY
          scale = 1.15 - 0.45 * easeK
          opacity = k > 0.85 ? Math.max(0.2, (1 - k) / 0.15) : 1
        }

        el.style.opacity = String(opacity)
        el.style.transform = `translate3d(${curX - 19}px, ${curY - 19}px, 0) scale(${scale})`

        if (t >= 1) triggerArrival(p)
      }

      if (particlesRef.current.length > 0) {
        animId = requestAnimationFrame(step)
      }
    }

    if (particles.length > 0) animId = requestAnimationFrame(step)
    return () => { if (animId) cancelAnimationFrame(animId) }
  }, [particles.length, triggerArrival])

  if (particles.length === 0 && impacts.length === 0) return null

  return (
    <div className="flying-resources-layer" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          ref={(el) => {
            if (el) particleRefs.current.set(p.id, el)
            else particleRefs.current.delete(p.id)
          }}
          className={`flying-token flying-token-${p.res}`}
          style={{ opacity: 0 }}
        >
          <ResIcon res={p.res} size={22} />
        </div>
      ))}

      {impacts.map((imp) => (
        <div
          key={imp.id}
          className={`res-impact-burst impact-${imp.res}`}
          style={{ left: `${imp.x}px`, top: `${imp.y}px` }}
        />
      ))}
    </div>
  )
}
