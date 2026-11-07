import { useEffect, useRef, useState, useCallback } from 'react'
import { RES_ICON } from '../icons.jsx'
import { INTERACTION_POINTS } from '../../game/mapLayout.js'
import { WORLD } from '../map/Camera.jsx'
import { useUI } from '../../game/GameContext.jsx'

function ResIcon({ res, size = 20 }) {
  const Icon = RES_ICON[res]
  return Icon ? <Icon size={size} /> : null
}

function getSiteScreenPos(siteId, worldX, worldY, cam) {
  // 1. Try finding matching DOM element
  if (siteId) {
    const el = document.querySelector(`[data-site-id="${siteId}"]`) || document.querySelector(`[data-site-action="${siteId}"]`)
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
    }
  }

  // 2. Camera conversion if world coordinates are provided
  const pt = (worldX != null && worldY != null) ? [worldX, worldY] : (siteId ? INTERACTION_POINTS[siteId] : null)
  if (pt && cam) {
    const c = cam.view?.() || cam
    const camEl = document.querySelector('.camera')
    const cr = camEl ? camEl.getBoundingClientRect() : { left: 0, top: 0 }
    return {
      x: cr.left + (pt[0] - WORLD.x) * c.s + c.x,
      y: cr.top + (pt[1] - WORLD.y) * c.s + c.y,
    }
  }

  // Fallback: screen center
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function getResourceTargetPos(res) {
  const el = document.querySelector(`[data-resource="${res}"]`) || document.querySelector('.topbar')
  if (el) {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }
  return { x: window.innerWidth / 2, y: 35 }
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
    // 1. Spawn impact flash
    const impactId = nextId.current++
    setImpacts((prev) => [...prev, { id: impactId, x: p.targetX, y: p.targetY, res: p.res }])
    setTimeout(() => {
      setImpacts((prev) => prev.filter((x) => x.id !== impactId))
    }, 450)

    // 2. Bump target element in DOM
    const targetEl = document.querySelector(`[data-resource="${p.res}"]`) || document.querySelector('.topbar')
    if (targetEl) {
      targetEl.classList.remove('res-bump')
      void targetEl.offsetWidth
      targetEl.classList.add('res-bump')
    }

    // 3. Dispatch arrival notification for TopBar
    window.dispatchEvent(
      new CustomEvent('cloudbreakers:resource-token-arrive', {
        detail: { res: p.res, amount: p.amount, isLast: p.isLast },
      })
    )

    // 4. Remove particle from active list
    particleRefs.current.delete(p.id)
    setParticles((prev) => prev.filter((item) => item.id !== p.id))
  }, [])

  // Listen to flight trigger events
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

      const targetPos = getResourceTargetPos(res)

      // Determine number of tokens to fly (2 to 5)
      const count = Math.min(5, Math.max(2, Math.round(totalAmount / 1.5)))
      // Split amount across tokens
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

        // Spread out at launch
        const fan = (i - (count - 1) / 2)
        const burstAngle = -Math.PI / 2 + fan * 0.45
        const burstDist = 32 + (i % 2) * 14
        const burstX = Math.cos(burstAngle) * burstDist
        const burstY = Math.sin(burstAngle) * burstDist

        // Control point creates a natural arc towards the top
        const midX = (startPos.x + targetPos.x) / 2
        const controlX = midX + fan * 50
        const controlY = Math.min(startPos.y, targetPos.y) - 50 - Math.abs(startPos.x - targetPos.x) * 0.08

        newParticles.push({
          id,
          res,
          amount: tokenAmount,
          isLast: i === count - 1,
          startX: startPos.x,
          startY: startPos.y,
          burstX,
          burstY,
          controlX,
          controlY,
          targetX: targetPos.x,
          targetY: targetPos.y,
          startTime: now + delay,
          duration,
        })
      }

      setParticles((prev) => [...prev, ...newParticles])
    }

    window.addEventListener('cloudbreakers:fly-resource', onFly)
    return () => window.removeEventListener('cloudbreakers:fly-resource', onFly)
  }, [ui.camera])

  // RAF loop driving smooth 60fps positions without re-rendering JSX
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
          // Pop outward from harvest site
          const k = t / 0.16
          const popEase = Math.sin((k * Math.PI) / 2)
          curX = p.startX + p.burstX * popEase
          curY = p.startY + p.burstY * popEase
          scale = 0.5 + 0.65 * popEase
          opacity = Math.min(1, k * 1.8)
        } else {
          // Arc towards top bar with acceleration
          const k = (t - 0.16) / 0.84
          const easeK = k * k * (3 - 2 * k) // smooth ease-in-out
          const burstStartX = p.startX + p.burstX
          const burstStartY = p.startY + p.burstY

          const oneMinusK = 1 - easeK
          curX = oneMinusK * oneMinusK * burstStartX + 2 * oneMinusK * easeK * p.controlX + easeK * easeK * p.targetX
          curY = oneMinusK * oneMinusK * burstStartY + 2 * oneMinusK * easeK * p.controlY + easeK * easeK * p.targetY

          scale = 1.15 - 0.45 * easeK
          opacity = k > 0.85 ? Math.max(0.2, (1 - k) / 0.15) : 1
        }

        el.style.opacity = String(opacity)
        el.style.transform = `translate3d(${curX - 19}px, ${curY - 19}px, 0) scale(${scale})`

        if (t >= 1) {
          triggerArrival(p)
        }
      }

      if (particlesRef.current.length > 0) {
        animId = requestAnimationFrame(step)
      }
    }

    if (particles.length > 0) {
      animId = requestAnimationFrame(step)
    }

    return () => {
      if (animId) cancelAnimationFrame(animId)
    }
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
