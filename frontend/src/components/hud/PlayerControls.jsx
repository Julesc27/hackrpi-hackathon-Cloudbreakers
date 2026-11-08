import { useEffect, useRef, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { centerCameraOnAvatar } from '../../game/player.js'
import { isTypingTarget, isNavigationTarget, keyboardShouldWalk } from '../../game/travelInput.js'
import '../../styles/player.css'

export default function PlayerControls() {
  const { player } = useGame()
  const ui = useUI()
  const [view, setView] = useState(null)
  const keys = useRef(new Set())
  const uiBusy = Boolean(ui.panel || ui.placing || ui.bridgeRoute)
  useEffect(() => {
    if (!uiBusy) return
    keys.current.clear()
    player.current.setInput(0, 0)
  }, [uiBusy, player])
  useEffect(() => {
    const refresh = () => {
      const p = player.current, a = p.avatar
      if (!a) return
      setView({ x: a.x, y: a.y, island: a.isl, busy: Boolean(p.pending),
        task: a.task?.kind || '', progress: a.task ? a.task.progress : null })
      if (a.act === 'walk') ui.camera.current?.followPoint(a.x, a.y)
    }
    refresh()
    const timer = setInterval(refresh, 150)
    const held = keys.current
    const movement = () => player.current.setInput(
      Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft')),
      Number(held.has('s') || held.has('arrowdown')) - Number(held.has('w') || held.has('arrowup')))
    const blocked = (e) => isTypingTarget(e.target) || isNavigationTarget(e.target) || uiBusy || Boolean(document.querySelector('.modal-backdrop, .tutorial-root'))
    const down = e => {
      if (e.key === 'Escape' && !uiBusy && !document.querySelector('.modal-backdrop, .tutorial-root') && player.current.pending) {
        e.preventDefault(); player.current.cancel(); return
      }
      if (blocked(e) || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        if (held.size) { held.clear(); movement() }
        return
      }
      const key = e.key.toLowerCase()
      if (keyboardShouldWalk({ key, target: e.target, uiBusy })) {
        e.preventDefault(); e.stopImmediatePropagation(); held.add(key); movement()
      } else if (key === 'e' && !e.repeat) { e.preventDefault(); player.current.interact() }
      else if (key === 'escape' && player.current.pending) player.current.cancel()
    }
    const up = e => { if (held.delete(e.key.toLowerCase())) { e.preventDefault(); movement() } }
    const blur = () => {
      const wasMoving = held.size || player.current.input.some(Boolean)
      held.clear()
      if (wasMoving) movement()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', blur)
    return () => {
      clearInterval(timer); blur()
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur)
    }
  }, [player, ui.camera, uiBusy])
  if (!view || ui.placing) return null
  return (
    <button
      type="button"
      className="center-me"
      onClick={() => centerCameraOnAvatar(ui.camera.current, player.current.avatar)}
      aria-label="Center me"
      title="Center the view on your captain. They stay where they are."
      data-player-island={view.island || 'bridge'}
      data-player-x={view.x.toFixed(1)}
      data-player-y={view.y.toFixed(1)}
      data-player-busy={view.busy}
      data-player-task={view.task}
      data-player-progress={view.progress == null ? '' : view.progress.toFixed(3)}
    >
      Center me
    </button>
  )
}
