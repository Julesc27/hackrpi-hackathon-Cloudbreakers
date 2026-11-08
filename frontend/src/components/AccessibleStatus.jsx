import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/GameContext.jsx'

export default function AccessibleStatus() {
  const { state, player } = useGame()
  const [task, setTask] = useState(''), [message, setMessage] = useState('')
  const announced = useRef(new Set())
  const previousId = useRef(state.nextId)
  useEffect(() => {
    const refresh = () => setTask(player.current.status)
    refresh(); const timer = setInterval(refresh,250)
    return () => clearInterval(timer)
  },[player])
  useEffect(() => {
    if (state.nextId < previousId.current) announced.current.clear()
    previousId.current = state.nextId
    const fresh = state.toasts.filter(toast => !announced.current.has(toast.id))
    if (!fresh.length) return
    for (const toast of fresh) announced.current.add(toast.id)
    setMessage(fresh.map(toast => [toast.title,toast.text].filter(Boolean).join('. ')).join('. '))
  },[state.toasts,state.nextId])
  return <div className="sr-only" data-live-announcements role="log" aria-live="polite" aria-relevant="text additions"><p>{task}</p><p>{message}</p></div>
}
