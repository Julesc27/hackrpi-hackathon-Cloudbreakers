import { useGame, useUI } from '../game/GameContext.jsx'
import { godsWord } from '../game/advisor.js'

// Friendly Cloud's aside about the gods, pointing to the Store where they can be consulted.
export default function GodsLine({ tip }) {
  const { state } = useGame()
  const ui = useUI()
  const word = godsWord(state, tip)
  return (
    <p className={`gods-line gods-${word.kind}`}>
      <span>{word.text}</span>
      {word.link && (
        <button className="gods-link" onClick={() => ui.setPanel('store')}>
          {word.link} <span aria-hidden="true">↗</span>
        </button>
      )}
    </p>
  )
}
