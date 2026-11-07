import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext.jsx'
import { Modal } from './Panel.jsx'

// Shown on first visit (until the player logs in or picks guest) and from Settings.
export default function AuthModal() {
  const auth = useAuth()
  const [mode, setMode] = useState('login') // login | register
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await (mode === 'login' ? auth.login : auth.register)(username.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m) => { setMode(m); setError(null) }
  // First-visit gate can't be dismissed except via "play as guest".
  const dismissable = auth.guestChosen

  return (
    <Modal
      title={mode === 'login' ? 'Welcome back' : 'Create an account'}
      kicker="Cloudbreakers"
      size="sm"
      dismissable={dismissable}
      onClose={auth.closeLogin}
    >
      {auth.notice && <p className="auth-notice">{auth.notice}</p>}
      <div className="auth-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchMode('login')}>Log in</button>
        <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>Sign up</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            minLength={mode === 'register' ? 3 : 1}
            maxLength={32}
            pattern={mode === 'register' ? '[A-Za-z0-9_]+' : undefined}
            title={mode === 'register' ? 'Letters, numbers and underscores' : undefined}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 6 : 1}
            maxLength={128}
          />
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="btn-gold full" type="submit" disabled={busy}>
          {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
      <p className="muted auth-sub">Logging in saves your town to your account so it follows you to any device.</p>
      {!auth.guestChosen && (
        <button type="button" className="btn-ghost auth-guest" onClick={auth.playAsGuest}>
          Play as guest (saved in this browser only)
        </button>
      )}
    </Modal>
  )
}
