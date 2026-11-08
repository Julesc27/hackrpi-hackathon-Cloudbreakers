import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { centerCameraOnAvatar } from '../../game/player.js'
import '../../styles/player.css'

export default function PlayerControls() {
  const { player } = useGame()
  const ui = useUI()
  const [view, setView] = useState(null)
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
