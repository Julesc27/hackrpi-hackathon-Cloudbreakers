import React from 'react'

// Last line of defence: if any panel throws while rendering, show a way back instead of a blank
// page. "Back to the sky" remounts the game, which reloads the town from its save with every
// panel closed, so a broken panel can't trap the player.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, attempt: 0 }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Cloudbreakers hit an error', error, info?.componentStack)
  }

  render() {
    const { error, attempt } = this.state
    if (!error) return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>
    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <h1>The skies hit a snag</h1>
          <p>Something went wrong while opening that. Your town is saved.</p>
          <div className="crash-actions">
            <button type="button" className="btn-gold" onClick={() => this.setState({ error: null, attempt: attempt + 1 })}>Back to the sky</button>
            <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>Reload</button>
          </div>
          <details>
            <summary>Details</summary>
            <code>{String(error?.message || error)}</code>
          </details>
        </div>
      </div>
    )
  }
}
