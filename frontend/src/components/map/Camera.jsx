import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { ISLANDS } from '../../game/data.js'

// The playable world is larger than the painted art: the 1600x900 concept frame sits in
// the middle of a WORLD-sized sky the player can pan around, like Dragon City / Homescapes.
export const WORLD = { x: -520, y: -380, w: 2840, h: 1660 }
const HOME = { x: 810, y: 540 }
const DRAG_THRESHOLD = 6

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * Pan / zoom camera.
 * - drag (mouse or one finger) to pan, with momentum
 * - wheel or pinch to zoom around the pointer
 * - keyboard: arrows/WASD pan, +/- zoom, 0 / Home recentres
 * - a tap that moved less than DRAG_THRESHOLD still counts as a click on the world
 *
 * Children are rendered in world units (a WORLD.w x WORLD.h box whose origin is WORLD.x/WORLD.y).
 * `far` and `near` render parallax layers that move slower / faster than the world.
 */
export default function Camera({ apiRef, children, far, mid, near, onMove }) {
  const viewport = useRef(null)
  const worldEl = useRef(null)
  const farEl = useRef(null)
  const nearEl = useRef(null)
  const cam = useRef({ x: 0, y: 0, s: 1 }) // screen = (world - WORLD.xy) * s + cam.xy
  const limits = useRef({ min: 0.4, max: 2, fit: 1 })
  const anim = useRef(null)
  const moving = useRef(0)

  const size = () => {
    const r = viewport.current.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }

  const clampCam = useCallback((c) => {
    const { w, h } = size()
    const s = clamp(c.s, limits.current.min, limits.current.max)
    const ww = WORLD.w * s, wh = WORLD.h * s
    const x = ww <= w ? (w - ww) / 2 : clamp(c.x, w - ww, 0)
    const y = wh <= h ? (h - wh) / 2 : clamp(c.y, h - wh, 0)
    return { x, y, s }
  }, [])

  const apply = useCallback(() => {
    const { x, y, s } = cam.current
    if (worldEl.current) worldEl.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
    viewport.current?.style.setProperty('--ui-k', String(Math.min(1.15, limits.current.fit / s)))
    const { w, h } = size()
    // parallax relative to the centred home view
    const cx = x + (HOME.x - WORLD.x) * s - w / 2
    const cy = y + (HOME.y - WORLD.y) * s - h / 2
    if (farEl.current) farEl.current.style.transform = `translate3d(${cx * 0.18}px, ${cy * 0.18}px, 0) scale(${1 + (s - limits.current.fit) * 0.08})`
    if (nearEl.current) nearEl.current.style.transform = `translate3d(${x - cx * 0.25}px, ${y - cy * 0.25}px, 0) scale(${s})`
    onMove?.(cam.current)
  }, [onMove])

  const set = useCallback((c) => {
    cam.current = clampCam(c)
    apply()
  }, [apply, clampCam])

  const markMoving = useCallback(() => {
    viewport.current?.classList.add('is-moving')
    clearTimeout(moving.current)
    moving.current = setTimeout(() => viewport.current?.classList.remove('is-moving'), 160)
  }, [])

  const stop = () => { if (anim.current) cancelAnimationFrame(anim.current); anim.current = null }

  // Zoom keeping the screen point (px, py) fixed
  const zoomAt = useCallback((factor, px, py) => {
    const c = cam.current
    const s = clamp(c.s * factor, limits.current.min, limits.current.max)
    const k = s / c.s
    set({ s, x: px - (px - c.x) * k, y: py - (py - c.y) * k })
    markMoving()
  }, [markMoving, set])

  // Animate the camera so that world point (wx, wy) lands on screen point (sx, sy) at scale s
  const flyTo = useCallback((wx, wy, s, opts = {}) => {
    stop()
    const { w, h } = size()
    const sx = opts.sx ?? w / 2, sy = opts.sy ?? h / 2
    s = clamp(s, limits.current.min, limits.current.max)
    const target = clampCam({ s, x: sx - (wx - WORLD.x) * s, y: sy - (wy - WORLD.y) * s })
    const from = { ...cam.current }
    const dur = opts.duration ?? 700
    const t0 = performance.now()
    const step = (t) => {
      const k = ease(Math.min(1, (t - t0) / dur))
      cam.current = { x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k, s: from.s + (target.s - from.s) * k }
      apply()
      markMoving()
      anim.current = k < 1 ? requestAnimationFrame(step) : null
    }
    anim.current = requestAnimationFrame(step)
  }, [apply, clampCam, markMoving])

  const fit = useCallback(() => {
    const { w, h } = size()
    // leave room for the HUD bars; aim to show the whole painted archipelago
    const usableH = Math.max(200, h - (w < 900 ? 300 : 170))
    const cover = Math.max(w / WORLD.w, h / WORLD.h) // never zoom out past the edge of the sky
    const f = Math.max(Math.min(w / 2040, usableH / 1170), cover * 1.05)
    limits.current = { fit: f, min: Math.max(f * 0.7, cover), max: Math.max(f * 2.8, 1.5) }
    return f
  }, [])

  const home = useCallback((duration = 600) => {
    const f = fit()
    const { h } = size()
    flyTo(HOME.x, HOME.y, f, { duration, sy: h / 2 + (h < 700 ? 10 : 30) })
  }, [fit, flyTo])

  const focusIsland = useCallback((id, panelOnRight = true, zoom = 1.4) => {
    const isl = ISLANDS[id]
    if (!isl) return
    const { w } = size()
    const [cx, cy, rx] = isl.hit
    const s = clamp(Math.min(limits.current.fit * zoom, (w * 0.55) / (rx * 2)), limits.current.fit, limits.current.max)
    const sx = panelOnRight && w > 900 ? (w - 380) / 2 : w / 2
    flyTo(cx, cy, s, { sx })
  }, [flyTo])

  useImperativeHandle(apiRef, () => ({
    flyTo, home, focusIsland,
    zoomIn: () => { const { w, h } = size(); zoomAt(1.35, w / 2, h / 2) },
    zoomOut: () => { const { w, h } = size(); zoomAt(1 / 1.35, w / 2, h / 2) },
    view: () => cam.current,
    get scale() { return cam.current.s },
    get fitScale() { return limits.current.fit },
  }), [flyTo, home, focusIsland, zoomAt])

  // initial framing + keep framing sane on resize
  useEffect(() => {
    fit()
    const { w, h } = size()
    const f = limits.current.fit
    const s0 = Math.max(f * 0.82, limits.current.min)
    cam.current = clampCam({ s: s0, x: w / 2 - (HOME.x - WORLD.x) * s0, y: h / 2 - (HOME.y - WORLD.y) * s0 })
    apply()
    // a small intro "swoop" into the town
    const t = setTimeout(() => home(1300), 80)
    const onResize = () => { fit(); set(cam.current) }
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- pointer input -------------------------------------------------------
  useEffect(() => {
    const el = viewport.current
    const pointers = new Map()
    let dragging = false
    let start = null
    let last = null
    let vel = { x: 0, y: 0 }
    let pinch = null
    let suppressClick = false

    const local = (e) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onDown = (e) => {
      if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return
      stop()
      pointers.set(e.pointerId, local(e))
      if (pointers.size === 1) {
        start = local(e); last = { ...start, t: performance.now() }; vel = { x: 0, y: 0 }; dragging = false
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
        dragging = true
      }
    }

    const onMoveP = (e) => {
      if (!pointers.has(e.pointerId)) return
      const p = local(e)
      pointers.set(e.pointerId, p)
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const c = cam.current
        set({ ...c, x: c.x + mid.x - pinch.mid.x, y: c.y + mid.y - pinch.mid.y })
        zoomAt(d / pinch.d, mid.x, mid.y)
        pinch = { d, mid }
        return
      }
      if (!dragging && Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD) {
        dragging = true
        el.setPointerCapture?.(e.pointerId)
        el.classList.add('is-dragging')
      }
      if (dragging) {
        const now = performance.now()
        const dx = p.x - last.x, dy = p.y - last.y
        const dt = Math.max(1, now - last.t)
        vel = { x: 0.8 * (dx / dt) + 0.2 * vel.x, y: 0.8 * (dy / dt) + 0.2 * vel.y }
        last = { ...p, t: now }
        const c = cam.current
        set({ ...c, x: c.x + dx, y: c.y + dy })
        markMoving()
      }
    }

    const onUp = (e) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)
      if (pointers.size === 1) { // one finger left after a pinch: continue as a pan from here
        const p = [...pointers.values()][0]
        last = { ...p, t: performance.now() }; start = p; pinch = null; vel = { x: 0, y: 0 }
        return
      }
      if (pointers.size > 0) return
      pinch = null
      el.classList.remove('is-dragging')
      if (dragging) {
        suppressClick = true
        setTimeout(() => { suppressClick = false }, 0)
        // momentum
        let v = { x: vel.x * 16, y: vel.y * 16 }
        if (performance.now() - last.t > 80) v = { x: 0, y: 0 }
        const glide = () => {
          v = { x: v.x * 0.92, y: v.y * 0.92 }
          if (Math.hypot(v.x, v.y) < 0.3) { anim.current = null; return }
          const c = cam.current
          set({ ...c, x: c.x + v.x, y: c.y + v.y })
          markMoving()
          anim.current = requestAnimationFrame(glide)
        }
        anim.current = requestAnimationFrame(glide)
      }
      dragging = false
    }

    const onClickCapture = (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault() } }

    const onWheel = (e) => {
      e.preventDefault()
      stop()
      const p = local(e)
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        // ctrlKey = trackpad pinch on most browsers
        const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018))
        zoomAt(k, p.x, p.y)
      } else {
        const c = cam.current
        set({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY })
        markMoving()
      }
    }

    const onDbl = (e) => {
      const p = local(e)
      if (e.target.closest?.('.no-dblzoom, [role=button], button, a, input, select, textarea')) return
      stop()
      const c = cam.current
      const factor = c.s > limits.current.fit * 1.9 ? limits.current.fit / c.s : 1.6
      const from = c.s, to = clamp(c.s * factor, limits.current.min, limits.current.max)
      const t0 = performance.now()
      const step = (t) => {
        const k = ease(Math.min(1, (t - t0) / 320))
        const target = from + (to - from) * k
        zoomAt(target / cam.current.s, p.x, p.y)
        anim.current = k < 1 ? requestAnimationFrame(step) : null
      }
      anim.current = requestAnimationFrame(step)
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMoveP)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('click', onClickCapture, true)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('dblclick', onDbl)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMoveP)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('click', onClickCapture, true)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dblclick', onDbl)
    }
  }, [markMoving, set, zoomAt])

  // ---- keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [role="dialog"]')) return
      if (document.querySelector('.modal-backdrop')) return
      const step = 60
      const c = cam.current
      const { w, h } = size()
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') set({ ...c, x: c.x + step })
      else if (k === 'arrowright' || k === 'd') set({ ...c, x: c.x - step })
      else if (k === 'arrowup' || k === 'w') set({ ...c, y: c.y + step })
      else if (k === 'arrowdown' || k === 's') set({ ...c, y: c.y - step })
      else if (k === '+' || k === '=') zoomAt(1.2, w / 2, h / 2)
      else if (k === '-' || k === '_') zoomAt(1 / 1.2, w / 2, h / 2)
      else if (k === '0' || k === 'home') home()
      else return
      e.preventDefault()
      markMoving()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [home, markMoving, set, zoomAt])

  return (
    <div className="camera" ref={viewport} aria-label="Sky map — drag to move, scroll or pinch to zoom">
      <div className="cam-layer cam-far" ref={farEl}>{far}</div>
      {mid}
      <div className="cam-layer cam-world" ref={worldEl} style={{ width: WORLD.w, height: WORLD.h }}>
        {children}
      </div>
      <div className="cam-layer cam-near" ref={nearEl} style={{ width: WORLD.w, height: WORLD.h }}>{near}</div>
    </div>
  )
}
