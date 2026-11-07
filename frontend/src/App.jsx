import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="container">
      <h1>Cloudbreakers</h1>
      <p className="subtitle">HackRPI — React + Vite, running in Docker.</p>

      <button onClick={() => setCount((c) => c + 1)}>
        Clicked {count} {count === 1 ? 'time' : 'times'}
      </button>

      <p className="hint">
        Edit <code>frontend/src/App.jsx</code> and save — the page reloads automatically.
      </p>
    </main>
  )
}
