import { useEffect, useRef } from 'react'
import { drawPerson } from './world/people.js'
import { avatarLook } from '../game/avatar.js'

// Draws the Captain with the same code as the residents on the map, so the portrait, the
// editor preview and the little figure walking around New Haven always match.
//   mode 'head' – head and shoulders, for the HUD
//   mode 'full' – the whole figure, walking in place (turning now and then) when `animate`
export default function AvatarPortrait({ avatar, mode = 'head', animate = false, size = 64, className = '', label }) {
  const ref = useRef(null)
  const avatarRef = useRef(avatar)
  avatarRef.current = avatar

  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const w = cv.width, h = cv.height
    let raf = 0, last = 0, phase = 0, start = 0
    const draw = (now) => {
      start ||= now
      const t = (now - start) / 1000
      const moving = animate && !reduce
      if (moving) phase += Math.min(0.1, (now - (last || now)) / 1000) * 7
      last = now
      // walk a few steps, pause, turn round and walk the other way (always facing the viewer)
      const cycle = moving ? Math.floor(t / 2.6) % 4 : 1
      const a = {
        ...avatarLook(avatarRef.current), carry: mode === 'full' ? 'toolbag' : null, id: 7, x: 0, y: 0,
        act: cycle === 0 || cycle === 2 ? 'walk' : 'idle', phase, dir: cycle >= 2 ? -1 : 1, back: false,
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (mode === 'full') {
        const k = h / 24
        ctx.setTransform(k, 0, 0, k, w / 2, h * 0.9)
      } else {
        const k = w / 9.5
        ctx.setTransform(k, 0, 0, k, w / 2, h / 2 + 14.6 * k)
      }
      drawPerson(ctx, a, moving ? t : 0, true)
      if (moving) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [animate, mode, avatar])

  const ratio = mode === 'full' ? 1.25 : 1
  const px = Math.round(size * 2)
  return (
    <canvas
      ref={ref}
      width={px}
      height={Math.round(px * ratio)}
      className={`avatar-portrait avatar-${mode} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  )
}
