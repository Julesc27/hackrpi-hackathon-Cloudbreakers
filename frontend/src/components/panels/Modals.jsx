import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ISLANDS, MISSIONS, WEATHER, INTRO, BRIDGE_TYPES, RESOURCES } from '../../game/data.js'
import { caps, projectTurn, housing, islandAccess, bridgeLabel } from '../../game/engine.js'
import { Modal, YieldChips, Progress } from './Panel.jsx'
import { RES_ICON, WeatherIcon, People, Leaf, Smile, Check, Star } from '../icons.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useSync } from '../../game/CloudSync.jsx'

const sign = (v) => (v > 0 ? `+${v}` : `${v}`)

function syncText(sync) {
  switch (sync.status) {
    case 'loading': return 'Loading your town…'
    case 'saving': return 'Saving…'
    case 'error': return `Couldn’t save: ${sync.error}. Will retry.`
    case 'saved': return sync.savedAt ? `Saved to the cloud at ${new Date(sync.savedAt).toLocaleTimeString()}` : 'Saved to the cloud'
    default: return 'Changes save to the cloud every 30 seconds.'
  }
}

function AccountBox() {
  const auth = useAuth()
  const sync = useSync()
  const ui = useUI()
  if (!auth.backend) return <p className="muted">Your town saves automatically in this browser.</p>
  if (auth.status === 'authed') {
    return (
      <div className="account-box">
        <div>Logged in as <strong>{auth.player.username}</strong></div>
        <div className={`sync-line ${sync.status === 'error' ? 'error' : ''}`}>{syncText(sync)}</div>
        <div className="row-btns">
          <button className="btn-ghost" onClick={sync.saveNow} disabled={sync.status === 'saving' || sync.status === 'loading'}>Save now</button>
          <button className="btn-ghost" onClick={() => { ui.closeAll(); sync.logout() }}>Log out</button>
        </div>
      </div>
    )
  }
  return (
    <div className="account-box">
      <div>Playing as a <strong>guest</strong>. Your town is only saved in this browser.</div>
      <div className="row-btns">
        <button className="btn-gold" onClick={() => { ui.closeAll(); auth.openLogin() }}>Log in to save</button>
      </div>
    </div>
  )
}

export function JournalModal() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  useEffect(() => { dispatch({ type: 'READ_JOURNAL' }) }, [dispatch])
  const entries = [...state.journal].reverse()
  return (
    <Modal title="Journal" kicker="Discoveries, missions and events" onClose={() => ui.setPanel(null)} size="lg">
      <ol className="journal">
        {entries.map((e) => (
          <li key={e.id} className={`jentry jentry-${e.type}`}>
            <span className="jturn">Turn {e.turn}</span>
            <div>
              <strong>{e.title}</strong>
              {e.text && <p>{e.text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

export function StorageModal() {
  const { state } = useGame()
  const ui = useUI()
  const cap = caps(state)
  const { gain, use, net } = projectTurn(state)
  const rows = ['wood', 'water', 'food', 'energy', 'coins']
  return (
    <Modal title="Storage" kicker="Stock and flow next turn" onClose={() => ui.setPanel(null)}>
      <table className="table">
        <thead><tr><th>Resource</th><th>Stock</th><th>In</th><th>Out</th><th>Net</th></tr></thead>
        <tbody>
          {rows.map((k) => {
            const Icon = RES_ICON[k]
            return (
              <tr key={k}>
                <td><Icon size={18} /> {RESOURCES[k].label}</td>
                <td>{state.resources[k]}{cap[k] ? <span className="muted">/{cap[k]}</span> : null}</td>
                <td className="up">+{gain[k]}</td>
                <td className="down">−{use[k]}</td>
                <td className={net[k] > 0 ? 'up' : net[k] < 0 ? 'down' : ''}>{sign(net[k])}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="stat-row">
        <div><People size={20} /> Population <strong>{state.population}</strong> / {housing(state)} beds</div>
        <div><Smile size={20} /> Happiness <strong>{state.happiness}</strong></div>
        <div><Leaf size={20} /> Sustainability <strong>{state.sustainability}%</strong></div>
      </div>
      <p className="muted small">Each resident eats ½ food and drinks ½ water per turn. Projection uses this turn's weather ({WEATHER[state.weather].name}).</p>
    </Modal>
  )
}

export function MapModal() {
  const { state } = useGame()
  const ui = useUI()
  const access = islandAccess(state)
  return (
    <Modal title="Sky Chart" kicker="Islands and routes" onClose={() => ui.setPanel(null)} size="lg">
      <div className="chart-grid">
        {Object.entries(ISLANDS).map(([id, d]) => {
          const status = state.connected.includes(id) ? 'connected' : state.discovered.includes(id) ? 'discovered' : 'hidden'
          return (
            <button key={id} className={`chart-card card is-${status}`} onClick={() => ui.openIsland(id)}>
              <div className="chart-name">{status === 'hidden' ? 'Uncharted' : d.name}</div>
              <div className="muted small">{status === 'hidden' ? '???' : d.kind}</div>
              {status !== 'hidden' && id !== 'newHaven' && <YieldChips yields={d.yields} />}
              <div className={`status-chip status-${status === 'connected' ? (access[id] === 1 ? 'ok' : 'warn') : 'locked'}`}>
                {status === 'connected' ? (id === 'newHaven' ? 'Home' : access[id] === 1 ? 'Connected' : 'Strained') : status === 'discovered' ? 'Reachable' : 'Unknown'}
              </div>
            </button>
          )
        })}
      </div>
      {state.bridges.length > 0 && (
        <>
          <h3 className="section">Bridges</h3>
          <ul className="bridge-list">
            {state.bridges.map((b) => (
              <li key={b.route}>
                <button className="link" onClick={() => { ui.setPanel(null); ui.setBridgeRoute(b.route) }}>{bridgeLabel(b.route)}</button>
                <span className="muted small">{BRIDGE_TYPES[b.type].name}</span>
                <span className="cond"><Progress value={b.condition} max={100} color={b.condition < 40 ? 'linear-gradient(90deg,#ff7a4b,#ffb38f)' : 'linear-gradient(90deg,#5fb24f,#a8e08a)'} /></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  )
}

export function SettingsModal() {
  const { dispatch } = useGame()
  const ui = useUI()
  const [confirm, setConfirm] = useState(false)
  return (
    <Modal title="Settings" onClose={() => ui.setPanel(null)} size="sm">
      <AccountBox />
      {confirm ? (
        <div className="confirm">
          <p>Start over? All progress on this town will be lost.</p>
          <div className="row-btns">
            <button className="btn-danger" onClick={() => { dispatch({ type: 'NEW_GAME' }); ui.closeAll() }}>Yes, start a new game</button>
            <button className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" onClick={() => setConfirm(true)}>New game…</button>
      )}
      <p className="fine">Cloudbreakers · HackRPI · Small choices. Higher tomorrows.</p>
    </Modal>
  )
}

export function TurnReport() {
  const { state, dispatch } = useGame()
  const r = state.report
  if (!state.showReport || !r) return null
  const close = () => dispatch({ type: 'CLOSE_REPORT' })
  const w = WEATHER[r.weather]
  const nw = WEATHER[r.nextWeather]
  const keys = ['wood', 'water', 'food', 'energy', 'coins'].filter((k) => r.gained[k] || r.consumed[k])
  const dh = r.happiness.to - r.happiness.from
  const ds = r.sustainability.to - r.sustainability.from
  const dp = r.population.to - r.population.from
  return (
    <Modal
      title={`End of turn ${r.turn}`}
      kicker={`${w.name} — ${w.text}`}
      onClose={close}
      size="lg"
      footer={<button className="btn-gold" onClick={close} autoFocus>Begin turn {r.turn + 1}</button>}
    >
      {r.shortages.length > 0 && <div className="alert">Shortage: {r.shortages.join(', ')}. Happiness fell and residents may leave.</div>}
      <div className="report-grid">
        <section>
          <h3 className="section">Resources</h3>
          <table className="table compact">
            <thead><tr><th></th><th>Gained</th><th>Used</th><th>Net</th></tr></thead>
            <tbody>
              {keys.map((k) => {
                const Icon = RES_ICON[k]
                return (
                  <tr key={k}>
                    <td><Icon size={16} /> {RESOURCES[k].label}</td>
                    <td className="up">+{r.gained[k]}</td>
                    <td className="down">−{r.consumed[k]}</td>
                    <td className={r.net[k] > 0 ? 'up' : r.net[k] < 0 ? 'down' : ''}>{sign(r.net[k])}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <section>
          <h3 className="section">Town</h3>
          <div className="delta-row"><Smile size={18} /> Happiness <strong>{r.happiness.to}</strong> <span className={dh >= 0 ? 'up' : 'down'}>{sign(dh)}</span></div>
          <ul className="reasons">{r.happiness.reasons.map(([t, v]) => <li key={t}>{t} <span className={v >= 0 ? 'up' : 'down'}>{sign(v)}</span></li>)}</ul>
          <div className="delta-row"><People size={18} /> Population <strong>{r.population.to}</strong> <span className={dp >= 0 ? 'up' : 'down'}>{sign(dp)}</span> <span className="muted small">/{r.population.housing} beds</span></div>
          <div className="delta-row"><Leaf size={18} /> Sustainability <strong>{r.sustainability.to}%</strong> <span className={ds >= 0 ? 'up' : 'down'}>{sign(ds)}</span></div>
          {r.bridges.length > 0 && (
            <>
              <h3 className="section">Bridges</h3>
              <ul className="reasons">{r.bridges.map((b) => <li key={b.route}>{bridgeLabel(b.route)} <span className="down">{b.from}% → {b.to}%</span></li>)}</ul>
            </>
          )}
        </section>
      </div>
      <div className="report-foot">
        <div className="forecast-pill"><WeatherIcon kind={nw.icon} size={22} /> Next: <strong>{nw.name}</strong></div>
        {r.missionsCompleted.map((id) => (
          <div key={id} className="mission-pill"><Check size={16} /> {MISSIONS.find((m) => m.id === id).name}</div>
        ))}
      </div>
    </Modal>
  )
}

export function IntroModal() {
  const { state, dispatch } = useGame()
  if (state.seenIntro) return null
  const close = () => dispatch({ type: 'SEEN_INTRO' })
  return (
    <Modal title="A Place to Begin" kicker="Chapter 1" onClose={close} size="md"
      footer={<button className="btn-gold" onClick={close} autoFocus>Let's begin</button>}>
      <blockquote className="intro-quote">“{INTRO.text}”<cite>— {INTRO.speaker}</cite></blockquote>
      <ol className="steps">
        <li>Build a <strong>Shelter</strong> and a <strong>Bridge Anchor</strong> from the Build menu.</li>
        <li>Click New Haven to <strong>gather wood</strong>.</li>
        <li>Click a glowing <strong>+</strong> between islands to build your first bridge.</li>
        <li>You get <strong>3 actions</strong> per turn. Press <strong>End Turn</strong> to see what happens.</li>
      </ol>
    </Modal>
  )
}

function ToastItem({ t, onDone }) {
  useEffect(() => {
    const ms = t.kind === 'mission' || t.kind === 'level' ? 5000 : 2800
    const id = setTimeout(onDone, ms)
    return () => clearTimeout(id)
  }, [t.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`toast toast-${t.kind}`} onClick={onDone}>
      {(t.kind === 'mission' || t.kind === 'level' || t.kind === 'bridge') && <Star size={18} className="toast-star" />}
      <div>
        {t.title && <strong>{t.title}</strong>}
        <span>{t.text}</span>
      </div>
    </div>
  )
}

export function Toasts() {
  const { state, dispatch } = useGame()
  return (
    <div className="toasts" aria-live="polite">
      {state.toasts.slice(-4).map((t) => (
        <ToastItem key={t.id} t={t} onDone={() => dispatch({ type: 'DISMISS_TOAST', id: t.id })} />
      ))}
    </div>
  )
}

