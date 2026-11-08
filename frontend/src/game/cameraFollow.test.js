import test from 'node:test'
import assert from 'node:assert/strict'
import { deadZone, followStep, overshoot, smoothDamp } from './cameraFollow.js'

const origin = { x: 0, y: 0 }
const view = { w: 1400, h: 900, origin }
const screen = (cam, p) => [(p[0] - origin.x) * cam.s + cam.x, (p[1] - origin.y) * cam.s + cam.y]

// Run the follow loop like Camera.jsx does; `path(t)` gives the Captain's world position.
function simulate(path, { seconds, fps = 60, cam = { x: 0, y: 0, s: 1 }, onFrame } = {}) {
  let vel = { x: 0, y: 0 }
  for (let i = 0; i < seconds * fps; i++) {
    const p = path(i / fps)
    const before = cam
    const next = followStep(cam, p, { ...view, dt: 1 / fps }, vel)
    if (next) { cam = next.cam; vel = next.vel } else vel = { x: 0, y: 0 }
    onFrame?.(cam, before, p)
  }
  return cam
}

test('the camera stays still while the Captain walks inside the dead zone', () => {
  const cam = { x: 0, y: 0, s: 1 }
  const z = deadZone(1400, 900)
  assert.equal(followStep(cam, [700, 450], { ...view, dt: 1 / 60 }), null)
  assert.equal(followStep(cam, [z.x1 - 1, z.y0 + 1], { ...view, dt: 1 / 60 }), null)
})

test('outside the dead zone the camera starts gently and only moves towards the Captain', () => {
  const z = deadZone(1400, 900)
  const next = followStep({ x: 0, y: 0, s: 1 }, [z.x1 + 200, 450], { ...view, dt: 1 / 60 })
  const moved = -next.cam.x
  assert.ok(moved > 0 && moved < 10, `first frame moved ${moved}`)
  assert.equal(next.cam.y, 0)
})

test('frame-rate independent: 30, 60 and 144 fps end up in the same place', () => {
  const z = deadZone(1400, 900)
  const point = () => [z.x1 + 300, z.y1 + 120]
  const a = simulate(point, { seconds: 0.5, fps: 60 }), b = simulate(point, { seconds: 0.5, fps: 30 }), c = simulate(point, { seconds: 0.5, fps: 144 })
  for (const o of [b, c]) assert.ok(Math.abs(a.x - o.x) < 3 && Math.abs(a.y - o.y) < 3, JSON.stringify({ a, o }))
})

test('it settles with the Captain on the edge of the dead zone without overshooting', () => {
  const z = deadZone(1400, 900)
  const point = [-200, 1400]
  let prev = overshoot(...screen({ x: 0, y: 0, s: 1 }, point), z)
  const cam = simulate(() => point, { seconds: 4, onFrame: (c) => {
    const now = overshoot(...screen(c, point), z)
    assert.ok(Math.abs(now.ex) <= Math.abs(prev.ex) + 1e-9 && Math.abs(now.ey) <= Math.abs(prev.ey) + 1e-9)
    prev = now
  } })
  const end = overshoot(...screen(cam, point), z)
  assert.ok(Math.abs(end.ex) < 0.5 && Math.abs(end.ey) < 0.5)
})

test('a walking Captain is followed smoothly: no jumps, no sudden changes of speed', () => {
  const z = deadZone(1400, 900)
  let maxStep = 0, maxChange = 0, lastStep = 0, maxOut = 0
  simulate((t) => [400 + 85 * t, 300], { seconds: 10, cam: { x: 0, y: 0, s: 1.5 }, onFrame: (c, before, p) => {
    const step = Math.hypot(c.x - before.x, c.y - before.y)
    maxStep = Math.max(maxStep, step); maxChange = Math.max(maxChange, Math.abs(step - lastStep)); lastStep = step
    const [sx, sy] = screen(c, p)
    assert.ok(sx > 0 && sx < 1400 && sy > 0 && sy < 900)
    maxOut = Math.max(maxOut, sx - z.x1)
  } })
  // walking at 85 units/s x 1.5 zoom = ~2.1 px per frame; the camera never moves much faster
  assert.ok(maxStep < 3, `largest step ${maxStep.toFixed(2)}px`)
  assert.ok(maxChange < 0.3, `largest change in speed ${maxChange.toFixed(2)}px/frame`)
  assert.ok(maxOut < 80, `trails the dead zone by at most ${maxOut.toFixed(1)}px`)
})

test('when the Captain stops the camera eases to a halt instead of stopping dead', () => {
  const z = deadZone(1400, 900)
  const steps = []
  simulate((t) => [400 + 85 * Math.min(t, 6), 300], { seconds: 9, cam: { x: 0, y: 0, s: 1.5 }, onFrame: (c, before) => steps.push(Math.abs(c.x - before.x)) })
  const afterStop = steps.slice(6 * 60)
  for (let i = 1; i < afterStop.length; i++) assert.ok(afterStop[i] <= afterStop[i - 1] + 1e-9, 'slows down monotonically')
  assert.ok(afterStop.at(-1) < 0.01)
  void z
})

test('smoothDamp never passes a still target', () => {
  let x = 0, v = 0
  for (let i = 0; i < 200; i++) { [x, v] = smoothDamp(x, 100, v, 0.28, 1 / 60); assert.ok(x <= 100) }
  assert.ok(Math.abs(x - 100) < 0.01)
})

test('reduced motion keeps the Captain in view without easing', () => {
  const z = deadZone(1400, 900)
  const next = followStep({ x: 0, y: 0, s: 1 }, [z.x1 + 100, 450], { ...view, dt: 1 / 60, reduceMotion: true })
  assert.equal(overshoot(...screen(next.cam, [z.x1 + 100, 450]), z).ex, 0)
})

test('with no gap left the camera coasts to a stop rather than halting in one frame', () => {
  let x = 0, v = 120
  const [x1, v1] = smoothDamp(x, x, v, 0.28, 1 / 60)
  assert.ok(x1 > 0 && v1 > 0 && v1 < v)
  for (let i = 0; i < 120; i++) [x, v] = smoothDamp(x, x, v, 0.28, 1 / 60)
  assert.ok(Math.abs(v) < 1)
})
