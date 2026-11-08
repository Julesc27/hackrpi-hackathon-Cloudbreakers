import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ISLANDS } from '../../game/data.js'
import '../../styles/player.css'

export default function PlayerControls() {
  const { player } = useGame()
  const ui = useUI()
  const [view, setView] = useState(null)
  useEffect(() => {
    const refresh = () => {
      const p = player.current, a = p.avatar, target = p.nearby()
      if (!a) return
      setView({ x: a.x, y: a.y, island: a.isl, status: p.status, busy: Boolean(p.pending),
        work: a.task ? { ...a.task } : null,
        target: target?.reason || target?.label, available: target && !target.reason })
      if (a.act === 'walk') ui.camera.current?.followPoint(a.x, a.y)
    }
    refresh()
    const timer = setInterval(refresh, 150)
    const keys = new Set()
    const movement = () => player.current.setInput(
      Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
      Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')))
    const down = e => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || e.target.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]') || document.querySelector('.modal-backdrop')) return
      const key = e.key.toLowerCase()
      if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)) {
        e.preventDefault(); e.stopImmediatePropagation(); keys.add(key); movement()
      } else if (key === 'e' && !e.repeat) { e.preventDefault(); player.current.interact() }
      else if (key === 'escape' && player.current.pending) player.current.cancel()
    }
    const up = e => { if (keys.delete(e.key.toLowerCase())) { e.preventDefault(); movement() } }
    const blur = () => {
      const wasMoving = keys.size || player.current.input.some(Boolean)
      keys.clear()
      if (wasMoving) movement()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', blur)
    return () => {
      clearInterval(timer); blur()
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur)
    }
  }, [player, ui.camera])
  if (!view || ui.placing) return null
  const locate = () => {
    const a = player.current.avatar, camera = ui.camera.current
    camera?.flyTo(a.x, a.y, Math.max(1.2, camera.view().s), { duration: 300 })
  }
  return <section className="player-controls" aria-label="Captain controls" data-player-island={view.island || 'bridge'} data-player-x={view.x.toFixed(1)} data-player-y={view.y.toFixed(1)} data-player-busy={view.busy} data-player-task={view.work?.kind || ''}>
    <div className="captain-badge" aria-hidden="true">✦</div>
    <div className="captain-info"><strong>Your captain <span>{ISLANDS[view.island]?.name || 'Crossing the sky'}</span></strong>
      <span role="status">{view.status}</span>
      {view.work && <div className="captain-task" style={{ '--task-color': view.work.color }}><progress aria-label={view.work.label} max="1" value={view.work.progress} /><span>{Math.round(view.work.progress*100)}%</span></div>}
      <small>WASD / arrows to walk · E to interact · tap a path to walk</small></div>
    <button className="captain-use" aria-label={view.busy ? 'Cancel task' : undefined} onClick={() => view.busy ? player.current.cancel() : player.current.interact()} disabled={!view.busy && !view.available} title={view.busy ? 'Stop this task without spending resources' : view.target || 'Walk closer to a resource or workshop'}><kbd>{view.busy ? 'Esc' : 'E'}</kbd> {view.busy ? 'Cancel task' : view.target || 'Explore'}</button>
    <button className="captain-locate" onClick={locate} aria-label="Find my avatar" title="Find my avatar">◎</button>
    <div className="captain-dpad" aria-label="Walk controls">
      {[['↑',0,-1,'up'],['←',-1,0,'left'],['↓',0,1,'down'],['→',1,0,'right']].map(([label,x,y,name]) => <button key={name} aria-label={`Walk ${name}`} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); player.current.setInput(x,y) }} onPointerUp={() => player.current.setInput(0,0)} onPointerCancel={() => player.current.setInput(0,0)}>{label}</button>)}
    </div>
  </section>
}
