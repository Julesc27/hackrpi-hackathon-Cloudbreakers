// Smooth camera follow for the Captain.
//
// The Captain can walk freely inside a "dead zone" in the middle of the screen without the
// camera moving at all. Once they step outside it, the camera glides after them with
// a critically damped spring (the same feel at 30, 60 or 144 fps) instead of snapping in
// short jumps. Pure functions, so the maths is unit-tested without a browser.

// Fraction of the screen, per side, that is outside the dead zone. Phones get a tighter
// zone so the Captain doesn't disappear under the HUD.
export function deadZone(w, h) {
  const phone = w < 700
  const sideX = phone ? 0.36 : 0.32
  return {
    x0: w * sideX, x1: w * (1 - sideX),
    // a little lower than centre: the HUD takes more room at the top
    y0: h * (phone ? 0.38 : 0.34), y1: h * (phone ? 0.6 : 0.64),
  }
}

/** How far (in screen px) the point is outside the dead zone; 0 on an axis when inside. */
export function overshoot(sx, sy, zone) {
  const ex = sx < zone.x0 ? sx - zone.x0 : sx > zone.x1 ? sx - zone.x1 : 0
  const ey = sy < zone.y0 ? sy - zone.y0 : sy > zone.y1 ? sy - zone.y1 : 0
  return { ex, ey }
}

// How long the camera takes to catch up, roughly. Lower = snappier.
export const SMOOTH_TIME = 0.28

/**
 * Critically damped spring towards `target` (the SmoothDamp used by game engines): it speeds
 * up and slows down gradually, never overshoots a still target, and is frame-rate independent.
 * Returns [position, velocity].
 */
export function smoothDamp(current, target, velocity, smoothTime, dt) {
  if (dt <= 0) return [current, velocity]
  const omega = 2 / smoothTime
  const x = omega * dt
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const change = current - target
  const temp = (velocity + omega * change) * dt
  let v = (velocity - omega * temp) * decay
  let out = target + (change + temp) * decay
  // never pass a target we were moving towards (with no gap left there is nothing to pass:
  // just coast to a stop)
  if (change !== 0 && (target - current > 0) === (out > target)) { out = target; v = 0 }
  return [out, v]
}

/**
 * One frame of following. `cam` maps world to screen as screen = (world - origin) * s + cam.xy;
 * `vel` is the camera's current velocity in px/s. Returns { cam, vel }, or null when the
 * Captain is inside the dead zone and the camera has come to rest.
 */
export function followStep(cam, point, { w, h, origin, dt, reduceMotion = false }, vel = { x: 0, y: 0 }) {
  const sx = (point[0] - origin.x) * cam.s + cam.x
  const sy = (point[1] - origin.y) * cam.s + cam.y
  const { ex, ey } = overshoot(sx, sy, deadZone(w, h))
  const outside = Math.abs(ex) >= 0.5 || Math.abs(ey) >= 0.5
  if (!outside && Math.hypot(vel.x, vel.y) < 2) return null
  // Reduced motion: keep the Captain in view without any easing drift.
  if (reduceMotion) return outside ? { cam: { ...cam, x: cam.x - ex, y: cam.y - ey }, vel: { x: 0, y: 0 } } : null
  const [x, vx] = smoothDamp(cam.x, cam.x - ex, vel.x, SMOOTH_TIME, dt)
  const [y, vy] = smoothDamp(cam.y, cam.y - ey, vel.y, SMOOTH_TIME, dt)
  return { cam: { ...cam, x, y }, vel: { x: vx, y: vy } }
}
