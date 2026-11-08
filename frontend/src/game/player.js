import { Crowd, bridgeAt } from '../components/world/people.js'
import { bridgePoints } from '../components/world/layout.js'
import { GATHER_SITES, BUILDINGS, ISLANDS, ROUTES, BEACON_COST } from './data.js'
import { INTERACTION_POINTS } from './mapLayout.js'
import { islandAccess, gatherAvailability, canAfford, backpackUsed, storageDepots } from './engine.js'
import { taskAnimation } from './taskAnimations.js'

const WORKSHOP = [635, 610]
const BEACON = [795, 407]
const TASKS = new Set(['GATHER_AT_SITE', 'GATHER_WOOD', 'HARVEST_FOREST', 'BUILD', 'BUILD_BRIDGE', 'UPGRADE_BRIDGE', 'REPAIR_BRIDGE', 'RESTORE_BEACON', 'DEPOSIT_BACKPACK'])
export const isPlayerTask = action => TASKS.has(action.type)

// The player uses the same traced paths and live bridge curves as the residents,
// but moves only under the player's control and completes tasks on arrival.
export class Player extends Crowd {
  constructor(state) {
    super()
    this.input = [0, 0]
    this.pending = null
    this.manualBridge = null
    this.status = 'Explore New Haven'
    this.sync(state)
    const saved = state.player
    if (saved && this.islands.includes(saved.island) && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const point = this.recoveryPoint(saved.island, saved.x, saved.y)
      if (point) Object.assign(this.avatar, { isl: saved.island, x: point[0], y: point[1] })
    } else {
      const point = this.walkPoint('newHaven', 775, 540)
      Object.assign(this.avatar, { isl: 'newHaven', x: point[0], y: point[1] })
    }
    this.status = `Explore ${ISLANDS[this.avatar.isl].name}`
    this.remember()
  }

  get avatar() { return this.agents[0] }
  plan() {} // No autonomous wandering for the player.

  sync(state) {
    this.state = state
    if (this.lastBridges === state.bridges && this.lastBuildings === state.buildings && this.lastConnected === state.connected) return
    const pending = this.pending
    const before = this.avatar && [this.avatar.isl, this.avatar.x, this.avatar.y]
    super.setState(state, islandAccess(state), 1)
    Object.assign(this.avatar, { kid: false, role: 'captain', shirt: '#265aa4', trim: '#f1cb75',
      pants: '#263550', hat: 'aviator', carry: 'toolbag', cloak: null, speed: 85 })
    this.lastBridges = state.bridges; this.lastBuildings = state.buildings; this.lastConnected = state.connected
    if (this.manualBridge && !this.bridgeTypes[this.manualBridge.route]) this.manualBridge = null
    if (before && (before[0] !== this.avatar.isl || before[1] !== this.avatar.x || before[2] !== this.avatar.y)) this.remember()
    if (pending && this.avatar.isl) {
      // A second building may change the clear working spot while travelling.
      const point = pending.action?.type === 'BUILD' ? this.task(pending.action)?.point : pending.point
      if (!point || !this.go(pending.island, point, pending.action, pending.label)) this.pending = null
    }
  }

  task(action) {
    if (action.type === 'DEPOSIT_BACKPACK') {
      const a = this.avatar
      const depots = storageDepots(this.state)
      const depot = action.storageId ? depots.find(d => d.id === action.storageId) : depots.sort((p,q) => Number(q.island === a.isl)-Number(p.island === a.isl) || Math.hypot(p.point[0]-a.x,p.point[1]-a.y)-Math.hypot(q.point[0]-a.x,q.point[1]-a.y))[0]
      if (!depot) return null
      return { island: depot.island, point: this.recoveryPoint(depot.island, ...depot.point), focus: depot.point, label: 'Deposit backpack' }
    }
    const siteId = action.type === 'GATHER_WOOD' ? 'grove' : action.type === 'HARVEST_FOREST' ? 'forest' : action.siteId
    if (siteId && GATHER_SITES[siteId]) {
      const site = GATHER_SITES[siteId], focus = INTERACTION_POINTS[siteId]
      // Stand beside the landmark, clear of its floating resource marker.
      const point = this.recoveryPoint(site.island, focus[0]+32, focus[1]+30)
      return { island: site.island, point, focus, label: site.label }
    }
    if (action.type === 'RESTORE_BEACON') return { island: 'newHaven', point: BEACON, label: 'Restore the beacon' }
    if (action.type === 'BUILD') {
      const def = BUILDINGS[action.buildingType]
      return { island: action.island, point: def?.infrastructure ? WORKSHOP : this.constructionPoint(action.buildingType, action.island, action.slot), label: `Build ${def?.name || 'building'}` }
    }
    const route = ROUTES.find(r => r.id === action.routeId)
    if (route) return { island: 'newHaven', point: bridgePoints(route.id).b,
      label: `${action.type === 'BUILD_BRIDGE' ? 'Build' : action.type === 'REPAIR_BRIDGE' ? 'Repair' : 'Reinforce'} ${ISLANDS[route.b].name} bridge` }
    return null
  }

  request(action, dispatch) {
    if (action.type === 'DEPOSIT_BACKPACK' && !backpackUsed(this.state)) { this.status = 'Your backpack is empty'; return false }
    const task = this.task(action)
    if (!task?.point) return false
    const site = action.siteId || (action.type === 'GATHER_WOOD' ? 'grove' : action.type === 'HARVEST_FOREST' ? 'forest' : null)
    const reason = site && gatherAvailability(this.state, site)
    if (reason) { this.status = reason; return false }
    this.dispatchTask = dispatch
    return this.go(task.island, task.point, action, task.label)
  }

  go(island, destination, action = null, label = 'Explore') {
    if (!this.islands.includes(island)) { this.status = 'Build a working bridge to reach this island'; return false }
    if (!this.avatar.isl) { this.status = 'Finish crossing the bridge first'; return false }
    const point = this.recoveryPoint(island, ...destination)
    if (!point) { this.status = 'That spot is not reachable'; return false }
    const a = this.avatar, queue = [{ island: a.isl, hops: [] }], seen = new Set([a.isl])
    let hops = null
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i]
      if (entry.island === island) { hops = entry.hops; break }
      for (const link of this.links[entry.island] || []) if (!seen.has(link.to)) {
        seen.add(link.to); queue.push({ island: link.to, hops: [...entry.hops, link] })
      }
    }
    if (!hops) { this.status = 'There is no working bridge to that island'; return false }
    const legs = []
    let current = a.isl, x = a.x, y = a.y
    for (const hop of hops) {
      const ends = bridgePoints(hop.route), entry = hop.from === 0 ? ends.a : ends.b, exit = hop.from === 0 ? ends.b : ends.a
      const walk = this.gridLeg(current, x, y, ...entry)
      if (!walk) { this.status = 'The path to the bridge is blocked'; return false }
      legs.push(walk, { route: hop.route, from: hop.from, toIsl: hop.to, u: 0 }, { isl: hop.to, pts: [exit], i: 0 })
      current = hop.to; [x, y] = exit
    }
    const walk = this.gridLeg(island, x, y, ...point)
    if (!walk) { this.status = 'The path is blocked — try another approach'; return false }
    legs.push(walk)
    this.input = [0, 0]; this.manualBridge = null
    Object.assign(a, { leg: null, legs, wait: 0, act: 'walk', task: null })
    this.pending = { island, point, action, label, work: 0, animation: taskAnimation(action) }
    this.status = action ? `Walking to ${label.toLowerCase()}` : `Walking around ${ISLANDS[island].name}`
    this.onTaskStart?.()
    return true
  }

  setInput(dx, dy) {
    this.input = [dx, dy]
    if (!dx && !dy) { if (!this.pending) this.remember(); return }
    const a = this.avatar
    if (a.leg?.route) this.manualBridge = { ...a.leg }
    this.pending = null
    Object.assign(a, { legs: [], leg: null, wait: 0, task: null, act: 'idle' })
    this.status = 'Exploring'
  }

  cancel() {
    if (!this.pending) return
    const a = this.avatar
    if (a.leg?.route) this.manualBridge = { ...a.leg }
    this.pending = null; this.input = [0, 0]
    Object.assign(a, { legs: [], leg: null, wait: 0, act: 'idle', task: null })
    this.status = 'Task cancelled — ready to explore'
    this.remember()
  }

  remember() {
    const a = this.avatar
    if (a?.isl) {
      this.safePosition = { island: a.isl, x: a.x, y: a.y }
      this.onSave?.(this.safePosition)
    }
  }

  nearby() {
    const a = this.avatar
    if (!a?.isl) return null
    const choices = Object.entries(GATHER_SITES).filter(([, s]) => s.island === a.isl).map(([id, site]) => ({
      id, point: this.task({ type: 'GATHER_AT_SITE', siteId: id }).point || INTERACTION_POINTS[id], label: site.label, action: { type: 'GATHER_AT_SITE', siteId: id }, reason: gatherAvailability(this.state, id),
    }))
    if (backpackUsed(this.state)) for (const depot of storageDepots(this.state).filter(d => d.island === a.isl)) choices.push({ id: 'deposit', point: depot.point, label: 'Deposit backpack', action: { type: 'DEPOSIT_BACKPACK', storageId: depot.id } })
    if (a.isl === 'newHaven') {
      choices.push({ id: 'workshop', point: WORKSHOP, label: 'Open workshop', menu: 'build' })
      if (!this.state.beaconRestored) choices.push({ id: 'beacon', point: BEACON, label: 'Restore the beacon', action: { type: 'RESTORE_BEACON' },
        reason: canAfford(this.state.resources, BEACON_COST) ? null : 'Needs 20 wood and 10 energy' })
      for (const route of ROUTES) choices.push({ id: route.id, point: bridgePoints(route.id).b,
        label: `${this.bridgeTypes[route.id] ? 'Manage' : 'Plan'} ${ISLANDS[route.b].name} bridge`, menu: 'bridge', route: route.id })
    }
    for (const choice of choices) {
      const point = this.walkPoint(a.isl, ...choice.point)
      choice.distance = point ? Math.hypot(a.x-point[0], a.y-point[1]) : Infinity
    }
    return choices.filter(c => c.distance <= 35).sort((a,b) => a.distance-b.distance)[0] || null
  }

  interact() {
    if (this.pending) return
    const target = this.nearby()
    if (!target) { this.status = 'Walk closer to a resource, the workshop or the beacon'; return }
    if (target.reason) { this.status = target.reason; return }
    if (target.menu === 'build') this.onOpenBuild?.()
    else if (target.menu === 'bridge') this.onOpenBridge?.(target.route)
    else this.request(target.action, this.dispatchTask)
  }

  update(dt) {
    dt = Math.min(.1, Math.max(0, dt))
    const a = this.avatar
    if (!a) return
    let [dx, dy] = this.input
    const size = Math.hypot(dx, dy)
    if (size) { dx /= size; dy /= size }
    if (this.manualBridge) {
      const leg = this.manualBridge, ends = bridgePoints(leg.route)
      const entry = leg.from === 0 ? ends.a : ends.b, exit = leg.from === 0 ? ends.b : ends.a
      const length = Math.hypot(exit[0]-entry[0], exit[1]-entry[1])
      const direction = (dx*(exit[0]-entry[0]) + dy*(exit[1]-entry[1])) / length
      leg.u = Math.max(0, Math.min(1, leg.u + direction*a.speed*dt/length))
      const p = bridgeAt(leg.route, leg.from === 0 ? leg.u : 1-leg.u, this.bridgeTypes[leg.route])
      Object.assign(a, { x: p[0], y: p[1], isl: null, act: size ? 'walk' : 'idle', dir: dx < 0 ? -1 : 1 })
      a.phase += Math.abs(direction)*dt*35
      if (leg.u === 1 || (leg.u === 0 && direction < 0)) {
        const landed = leg.u === 1 ? exit : entry
        a.x = landed[0]; a.y = landed[1]
        a.isl = leg.u === 1 ? leg.toIsl : leg.from === 0 ? ROUTES.find(r=>r.id===leg.route).b : 'newHaven'
        this.manualBridge = null; this.remember()
      }
      return
    }
    if (size && a.isl) {
      for (const link of this.links[a.isl] || []) {
        const ends = bridgePoints(link.route), entry = link.from === 0 ? ends.a : ends.b, exit = link.from === 0 ? ends.b : ends.a
        const length = Math.hypot(exit[0]-entry[0], exit[1]-entry[1])
        const approach = this.walkPoint(a.isl, ...entry) || entry
        if (Math.hypot(a.x-approach[0], a.y-approach[1]) < 16 && (dx*(exit[0]-entry[0])+dy*(exit[1]-entry[1]))/length > .75) {
          this.manualBridge = { ...link, toIsl: link.to, u: 0 }; return
        }
      }
      // Check each world unit so a slow frame cannot skip a stair landing or
      // slide off its angled treads before guidance can reconnect.
      const steps = Math.max(1, Math.ceil(a.speed*dt)), distance = a.speed*dt/steps
      let moved = false
      for (let i = 0; i < steps; i++) {
        const from = [a.x, a.y]
        const guided = this.stairStep(a.isl, from, [dx,dy], distance)
        const options = [guided, [a.x+dx*distance,a.y+dy*distance], [a.x+dx*distance,a.y], [a.x,a.y+dy*distance]].filter(Boolean)
        const next = options.find(p => Math.hypot(p[0]-from[0], p[1]-from[1]) > .001 && this.canStep(a.isl, from, p))
        if (!next) break
        a.x=next[0]; a.y=next[1]; a.phase += distance*.6; moved = true
      }
      a.act = moved ? 'walk' : 'idle'; if (dx) a.dir = dx < 0 ? -1 : 1; a.back = dy < -Math.abs(dx)*.3
      return
    }
    if (!this.pending) { a.act = 'idle'; a.task = null; return }
    if (a.leg || a.legs.length) { super.update(dt); return }
    if (this.pending.action) {
      const animation = this.pending.animation
      if (!a.task) {
        const action = this.pending.action
        const target = action.type === 'BUILD' && !BUILDINGS[action.buildingType]?.infrastructure
          ? ISLANDS[action.island]?.plots[action.slot] : this.task(action)?.focus || this.task(action)?.point
        if (target) { if (Math.abs(target[0]-a.x) > 2) a.dir = target[0] < a.x ? -1 : 1; a.back = target[1] < a.y-3 }
        a.task = { ...animation, elapsed: 0, progress: 0, label: this.pending.label }
      }
      this.pending.work += dt; a.act = 'work'; a.phase += dt*5
      a.task.elapsed = this.pending.work
      a.task.progress = Math.min(1, this.pending.work / animation.duration)
      this.status = this.pending.label
      if (this.pending.work < animation.duration) return
      const action = this.pending.action
      this.pending = null; a.act='idle'; a.task=null; this.status='Task complete'
      this.remember(); this.dispatchTask?.(action)
    } else { this.pending=null; a.act='idle'; this.status='Explore or press E nearby'; this.remember() }
  }
}
