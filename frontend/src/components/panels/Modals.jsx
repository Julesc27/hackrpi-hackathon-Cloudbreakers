import { useEffect, useRef, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ISLANDS, WEATHER, INTRO, RESOURCES, MISSIONS, CONSULT_COST } from '../../game/data.js'
import { caps, projectProduction, housing, islandAccess, bridgeLabel, openRoutes, otherEnd, bridgeCost, canAfford, backpackUsed, storageDepots, storageUsed } from '../../game/engine.js'
import { STORAGE_CAP } from '../../game/data.js'
import '../../styles/storage.css'
import { consultGods } from '../../api/client.js'
import { ISLAND_BADGE } from '../artPaths.js'
import IslandArt from '../IslandArt.jsx'
import Vignette from '../vignettes.jsx'
import { Modal, YieldChips, Progress, CostChips } from './Panel.jsx'
import { RES_ICON, People, Leaf, Smile, Check, Star, ArtIcon, WeatherIcon } from '../icons.jsx'
import { useAuth } from '../../auth/AuthContext.jsx'
import { useSync } from '../../game/CloudSync.jsx'
import Backpack from './Backpack.jsx'
import { RemoveButton } from './Removal.jsx'

const sign = (v) => (v > 0 ? `+${v}` : `${v}`)

function syncText(sync) {
  switch (sync.status) {
    case 'loading':
      return 'Loading your town…'
    case 'saving':
      return 'Saving…'
    case 'error':
      return `Couldn’t save: ${sync.error}. Will retry.`
    case 'saved':
      return sync.savedAt
        ? `Saved to the cloud at ${new Date(sync.savedAt).toLocaleTimeString()}`
        : 'Saved to the cloud'
    default:
      return 'Changes save to the cloud every 30 seconds.'
  }
}

function AccountBox() {
  const auth = useAuth()
  const sync = useSync()
  const ui = useUI()

  if (!auth.backend) {
    return <p className="muted">Your town saves automatically in this browser.</p>
  }

  if (auth.status === 'authed') {
    return (
      <div className="account-box">
        <div>
          Logged in as <strong>{auth.player.username}</strong>
        </div>
        <div className={`sync-line ${sync.status === 'error' ? 'error' : ''}`}>
          {syncText(sync)}
        </div>
        <div className="row-btns">
          <button
            className="btn-ghost"
            onClick={sync.saveNow}
            disabled={sync.status === 'saving' || sync.status === 'loading'}
          >
            Save now
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              ui.closeAll()
              sync.logout()
            }}
          >
            Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="account-box">
      <div>
        Playing as a <strong>guest</strong>. Your town is only saved in this browser.
      </div>
      <div className="row-btns">
        <button
          className="btn-gold"
          onClick={() => {
            ui.closeAll()
            auth.openLogin()
          }}
        >
          Log in to save
        </button>
      </div>
    </div>
  )
}

export function JournalModal() {
  const { state, dispatch } = useGame()
  const ui = useUI()

  useEffect(() => {
    dispatch({ type: 'READ_JOURNAL' })
  }, [dispatch])

  const entries = [...state.journal].reverse()

  return (
    <Modal
      title="Journal"
      kicker="Discoveries · missions · events"
      onClose={() => ui.setPanel(null)}
      size="lg"
    >
      <ol className="journal">
        {entries.map((e, i) => (
          <li key={e.id} className={`jentry jentry-${e.type}`} data-tutorial={i === 0 ? 'journal-first' : undefined}>
            <span className="jturn">Level {e.level}</span>
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

export function BackpackModal() {
  const ui = useUI()
  return <Modal title="Backpack" kicker="Supplies for the journey" onClose={() => ui.setPanel(null)}><Backpack /></Modal>
}

export function StorageHouseModal() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const building = state.buildings.find(b => b.id === ui.selected && b.type === 'storageHouse')
  if (!building) return null
  const connected = storageDepots(state).some(depot => depot.id === building.id)
  const capacity = caps(state), carried = backpackUsed(state)
  return <Modal title="Storage House" kicker={ISLANDS[building.island].name} onClose={() => ui.setPanel(null)}>
    <p>This storage house adds <strong>25 capacity each</strong> for food, water and energy. Your current town capacity is:</p>
    <div className="storage-capacities">{['food','water','energy'].map(key => { const Icon = RES_ICON[key]; return <div key={key}><Icon size={24} /><span>{RESOURCES[key].label}</span><strong>{capacity[key]}</strong></div> })}</div>
    <h3 className="section">Unload supplies here</h3>
    <p>Connected storage houses accept backpack supplies and deliver them to shared town stock for building and upgrades.</p>
    <p><strong>{carried} items</strong> in your backpack.</p>
    {!connected && <p className="backpack-full" role="status">Reconnect this island’s bridge to use this drop-off point.</p>}
    <div className="action-stack">
      <button className="btn-gold" disabled={!carried || !connected} onClick={() => dispatch({ type: 'DEPOSIT_BACKPACK', storageId: building.id })}>Deposit All Here</button>
      <button className="btn-ghost" onClick={() => ui.setPanel('storage')}>View Town Storage</button>
      <RemoveButton buildingId={building.id} />
    </div>
    <p className="muted small">Your captain walks to this house and unloads on arrival. Press E beside it to deposit supplies again.</p>
  </Modal>
}

export function StorageModal() {
  const { state } = useGame()
  const ui = useUI()
  const cap = caps(state)
  const { gain, use, net } = projectProduction(state)
  const rows = Object.keys(RESOURCES)
  const used = storageUsed(state.resources)
  const full = used >= STORAGE_CAP
  return (
    <Modal
      title="Storehouse"
      kicker="Stock and flow next action"
      onClose={() => ui.setPanel(null)}
    >
      <p className={`storage-total${full ? ' is-full' : ''}`} data-tutorial="storage-total" role="status">
        <strong>{used}/{STORAGE_CAP}</strong>
        {used > STORAGE_CAP
          ? ' Storage is over 250. These supplies stay. Spend some before anything new can be stored.'
          : full
            ? ' Storage is full. Spend wood, stone, food, water, seeds, fish, materials, or crystals to make room.'
            : ' Shared storage for wood, stone, food, seeds, water, fish, materials, and crystals. Energy and coins are separate.'}
      </p>
      <p className="muted small">Town stock is available for building and upgrades. Supplies in your backpack become available here after you deposit them.</p>
      <table className="table" data-tutorial="storage-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Stock</th>
            <th>In</th>
            <th>Out</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => {
            const Icon = RES_ICON[k]

            return (
              <tr key={k}>
                <td><Icon size={18} /> {RESOURCES[k].label}</td>
                <td>
                  {state.resources[k]}
                  {cap[k] ? <span className="muted">/{cap[k]}</span> : null}
                </td>
                <td className="up">+{gain[k]}</td>
                <td className="down">−{use[k]}</td>
                <td className={net[k] > 0 ? 'up' : net[k] < 0 ? 'down' : ''}>
                  {sign(net[k])}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="stat-row">
        <div>
          <People size={20} /> Population <strong>{state.population}</strong> / {housing(state)} beds
        </div>
        <div>
          <Smile size={20} /> Happiness <strong>{state.happiness}</strong>
          {net.happiness != null && (
            <span className={`delta ${net.happiness > 0 ? 'up' : net.happiness < 0 ? 'down' : 'zero'}`} style={{ marginLeft: 6 }}>
              {net.happiness > 0 ? `+${net.happiness}` : net.happiness === 0 ? '±0' : net.happiness}
            </span>
          )}
        </div>
        <div>
          <Leaf size={20} /> Sustainability <strong>{state.sustainability}%</strong>
        </div>
      </div>

      <p className="muted small">
        Each resident eats ½ food and drinks ½ water per action.
        Projection uses current weather ({WEATHER[state.weather].name}).
      </p>
    </Modal>
  )
}

function IslandBadge({ id }) {
  const b = ISLAND_BADGE[id] || {}
  return <span className="card-badge ring" style={{ background: b.ring || '#1f2a5a' }}><ArtIcon name={b.icon || 'cloud'} size={30} /></span>
}

const ISLAND_SUMMARIES = {
  verdant: 'Renewable timber, crops, seeds and building materials.',
  rain: 'Fresh water, fish and stone from cascading pools.',
  prism: 'Energy crystals and components for advanced technology.',
  mercy: 'Hospital care and happier residents for your growing town.',
  hearth: 'A welcoming village with eight extra homes and food.',
}

// "The Skyway Chart — choose your next horizon"
export function MapModal() {
  const { state } = useGame()
  const ui = useUI()
  const cardsRef = useRef(null)
  const [scrollEdges, setScrollEdges] = useState({ start: true, end: true })

  useEffect(() => {
    const cards = cardsRef.current
    const updateEdges = () => setScrollEdges({
      start: cards.scrollLeft <= 2,
      end: cards.scrollLeft + cards.clientWidth >= cards.scrollWidth - 2,
    })
    // A normal mouse wheel browses the horizontal cards.
    const onWheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? cards.clientWidth : 1)
      const next = Math.max(0, Math.min(cards.scrollWidth - cards.clientWidth, cards.scrollLeft + delta))
      if (Math.abs(next - cards.scrollLeft) < .5) return
      event.preventDefault()
      cards.scrollLeft = next
    }
    const resize = new ResizeObserver(updateEdges)
    resize.observe(cards)
    cards.addEventListener('scroll', updateEdges, { passive: true })
    cards.addEventListener('wheel', onWheel, { passive: false })
    updateEdges()
    return () => {
      resize.disconnect()
      cards.removeEventListener('scroll', updateEdges)
      cards.removeEventListener('wheel', onWheel)
    }
  }, [])

  const scrollCards = (direction) => {
    const cards = cardsRef.current
    const step = cards.children[1]?.offsetLeft - cards.children[0]?.offsetLeft || cards.clientWidth
    cards.scrollBy({ left: direction * step, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  const access = islandAccess(state)
  const routes = openRoutes(state)
  const ids = Object.keys(ISLANDS).filter((id) => id !== 'newHaven')

  const rank = (id) => (
    routes.some((r) => otherEnd(r, state.connected) === id)
      ? 0
      : state.connected.includes(id)
        ? 1
        : 2
  )

  ids.sort((a, b) => rank(a) - rank(b))

  return (
    <Modal
      title="The Skyway Chart"
      kicker="Choose your next horizon"
      onClose={() => ui.setPanel(null)}
      size="xl"
      className="chart"
      footer={
        <div className="chart-navigation" aria-label="Browse islands">
          <button className="chart-scroll-btn" aria-label="Previous islands" disabled={scrollEdges.start} onClick={() => scrollCards(-1)}>‹</button>
          <div className="chart-scroll-hint"><strong>{ids.length} islands to explore</strong><span>Scroll, swipe or use the arrows</span>
            {state.bridges.length > 0 && <button className="link chart-manage-bridges" onClick={() => ui.setPanel('bridges')}>Manage bridges</button>}
          </div>
          <button className="chart-scroll-btn" aria-label="Next islands" disabled={scrollEdges.end} onClick={() => scrollCards(1)}>›</button>
        </div>
      }
    >
      <div className="chart-cards" ref={cardsRef} role="region" aria-label="Island cards" tabIndex={0}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            scrollCards(event.key === 'ArrowLeft' ? -1 : 1)
          }
        }}>
        {ids.map((id, idx) => {
          const d = ISLANDS[id]
          const status = state.connected.includes(id)
            ? 'connected'
            : state.discovered.includes(id)
              ? 'discovered'
              : 'hidden'
          const route = routes.find((r) => otherEnd(r, state.connected) === id)
          const hidden = status === 'hidden'

          return (
            <article key={id} className={`chart-card is-${status}`} data-tutorial={idx === 0 ? 'chart-first-card' : undefined}>
              <IslandBadge id={id} />
              <div className="cc-art">{hidden ? <Vignette kind="uncharted" /> : <IslandArt id={id} />}</div>
              <h3>{hidden ? 'Uncharted' : d.name}</h3>
              <p className="cc-desc">
                {hidden
                  ? 'Connect a neighbouring island to chart this horizon.'
                  : ISLAND_SUMMARIES[id] || d.desc}
              </p>

              {!hidden && (
                <>
                  <div className="cc-label">
                    {status === 'connected' ? 'Produces per action' : 'Connection cost'}
                  </div>
                  <div className="cc-cost">
                    {status === 'connected'
                      ? <YieldChips yields={d.yields} suffix="" />
                      : route
                        ? <CostChips cost={bridgeCost(route, 'rope')} resources={constructionResources(state)} />
                        : <span className="muted small">No route yet</span>}
                  </div>
                </>
              )}

              {status === 'connected' ? (
                <button className="btn-connected" onClick={() => ui.openIsland(id)} aria-label={`Explore ${d.name}`}>
                  <Check size={18} /> {access[id] === 1 ? 'Connected · explore' : 'Bridge damaged · inspect'}
                </button>
              ) : (
                <button
                  className="btn-pill"
                  disabled={!route}
                  onClick={() => {
                    ui.setPanel(null)
                    ui.setBridgeRoute(route.id)
                  }}
                >
                  Chart Route <span aria-hidden="true">›</span>
                </button>
              )}
            </article>
          )
        })}
      </div>


    </Modal>
  )
}

// Store listings.
const STORE_ITEMS = [
  {
    id: 'consultGods',
    name: 'Consult the Gods',
    icon: 'ancestors',
    desc: 'Light a lantern and ask the founders who came before.',
    promise: 'The gods have read the laws beneath the sky. Their counsel is always right, and never plain.',
    cost: CONSULT_COST,
  },
]

// The poem walks in line by line; Cloud's reaction waits until the last line has landed.
const LINE_DELAY_MS = 900

function RevealPoem({ poem }) {
  const lines = poem.split('\n')
  return (
    <>
      <blockquote className="oracle-poem" aria-label={poem}>
        {lines.map((line, i) => (
          <span key={i} className="oracle-line" style={{ animationDelay: `${i * LINE_DELAY_MS}ms` }} aria-hidden="true">
            {line || '\u00a0'}
          </span>
        ))}
      </blockquote>
      <p className="oracle-cloud oracle-line" style={{ animationDelay: `${lines.length * LINE_DELAY_MS + 400}ms` }}>
        <ArtIcon name="cloud" size={22} />
        <span><strong>Friendly Cloud:</strong> Oh, that’s far beyond me. But the gods have never once been wrong.</span>
      </p>
    </>
  )
}

function ConsultGodsCard({ item }) {
  const { state, dispatch } = useGame()
  const auth = useAuth()
  const [phase, setPhase] = useState('idle') // idle | asking | spoken | silent
  const [poem, setPoem] = useState('')
  const [error, setError] = useState('')
  const affordable = canAfford(state.resources, item.cost)
  const loggedIn = auth.backend && auth.status === 'authed'

  const ask = async () => {
    setPhase('asking')
    setError('')
    try {
      const res = await consultGods(state)
      setPoem(res.poem)
      setPhase('spoken')
      dispatch({ type: 'CONSULT_GODS', poem: res.poem, focus: res.focus }) // charged only once a poem arrives
    } catch (e) {
      setError(e.status === 429 ? 'The gods grow weary of questions. Return later.'
        : e.status === 503 && /cannot be done/.test(e.message) ? 'The gods would only counsel what cannot be done right now, so they hold their tongue. Nothing was spent.'
        : 'The gods are silent. Nothing was spent.')
      setPhase('silent')
    }
  }

  const label = !loggedIn ? 'Log in to consult' : phase === 'asking' ? 'The gods are considering…' : phase === 'spoken' ? 'Ask again' : 'Consult'
  const blocked = !auth.backend || (loggedIn && (!affordable || phase === 'asking'))

  return (
    <div className="store-card" data-tutorial={`store-${item.id}`}>
      <ArtIcon name={item.icon} size={64} className={`store-art${phase === 'asking' ? ' is-lit' : ''}`} />
      <div className="store-body">
        <h3 className="store-name">{item.name}</h3>
        <p className="store-desc">{item.desc}</p>
        <p className="store-promise">{item.promise}</p>
        <CostChips cost={item.cost} resources={state.resources} />
      </div>
      <button
        className="btn-gold store-btn"
        disabled={blocked}
        onClick={!loggedIn ? auth.openLogin : ask}
        title={!loggedIn ? 'The gods only answer logged-in stewards' : !affordable ? 'Not enough energy or coins' : item.name}
      >
        {label}
      </button>
      {phase === 'spoken' && <RevealPoem key={poem} poem={poem} />}
      {phase === 'silent' && <p className="oracle-silent">{error}</p>}
    </div>
  )
}

export function StoreModal() {
  const ui = useUI()
  return (
    <Modal title="Store" kicker="Trade with passing sky merchants" onClose={() => ui.setPanel(null)}>
      <div className="store-items">
        {STORE_ITEMS.map((item) => <ConsultGodsCard key={item.id} item={item} />)}
      </div>
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

      <button
        className="btn-gold"
        style={{
          width: '100%',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onClick={() => {
          ui.setPanel(null)
          ui.startTutorial()
        }}
        data-tutorial="how-to-play-btn"
      >
        <ArtIcon name="cloud" size={24} />
        <span>How to Play</span>
      </button>

      <button type="button" className="btn-ghost" style={{ width: '100%', marginBottom: 14 }} onClick={() => ui.setPanel('captain')}>
        Edit your Captain
      </button>

      {confirm ? (
        <div className="confirm">
          <p>Start over? All progress on this town will be lost.</p>
          <div className="row-btns">
            <button
              className="btn-danger"
              onClick={() => {
                dispatch({ type: 'NEW_GAME' })
                ui.closeAll()
              }}
            >
              Yes, start a new game
            </button>
            <button
              className="btn-ghost"
              onClick={() => setConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" onClick={() => setConfirm(true)}>
          New game…
        </button>
      )}

      <p className="fine">
        Cloudbreakers · HackRPI · Small choices. Higher tomorrows.
      </p>
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
  const keys = ['wood', 'water', 'food', 'energy', 'coins']
    .filter((k) => r.gained[k] || r.consumed[k])

  const dh = r.happiness.to - r.happiness.from
  const ds = r.sustainability.to - r.sustainability.from
  const dp = r.population.to - r.population.from

  return (
    <Modal
      title={`End of turn ${r.turn}`}
      kicker={`${w.name} — ${w.text}`}
      onClose={close}
      size="lg"
      footer={
        <button
          className="btn-gold"
          onClick={close}
          autoFocus
          data-tutorial="report-continue-btn"
        >
          Begin turn {r.turn + 1}
        </button>
      }
    >
      {r.shortages.length > 0 && (
        <div className="alert">
          Shortage: {r.shortages.join(', ')}. Happiness fell and residents may leave.
        </div>
      )}

      <div className="report-grid">
        <section>
          <h3 className="section">Resources</h3>
          <table className="table compact">
            <thead>
              <tr>
                <th></th>
                <th>Gained</th>
                <th>Used</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const Icon = RES_ICON[k]

                return (
                  <tr key={k}>
                    <td><Icon size={16} /> {RESOURCES[k].label}</td>
                    <td className="up">+{r.gained[k]}</td>
                    <td className="down">−{r.consumed[k]}</td>
                    <td className={r.net[k] > 0 ? 'up' : r.net[k] < 0 ? 'down' : ''}>
                      {sign(r.net[k])}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="section">Town</h3>

          <div className="delta-row">
            <Smile size={18} /> Happiness <strong>{r.happiness.to}</strong>
            <span className={dh >= 0 ? 'up' : 'down'}>{sign(dh)}</span>
          </div>

          <ul className="reasons">
            {r.happiness.reasons.map(([t, v]) => (
              <li key={t}>
                {t} <span className={v >= 0 ? 'up' : 'down'}>{sign(v)}</span>
              </li>
            ))}
          </ul>

          <div className="delta-row">
            <People size={18} /> Population <strong>{r.population.to}</strong>
            <span className={dp >= 0 ? 'up' : 'down'}>{sign(dp)}</span>
            <span className="muted small">/{r.population.housing} beds</span>
          </div>

          <div className="delta-row">
            <Leaf size={18} /> Sustainability <strong>{r.sustainability.to}%</strong>
            <span className={ds >= 0 ? 'up' : 'down'}>{sign(ds)}</span>
          </div>

          {r.bridges.length > 0 && (
            <>
              <h3 className="section">Bridges</h3>
              <ul className="reasons">
                {r.bridges.map((b) => (
                  <li key={b.route}>
                    {bridgeLabel(b.route)}
                    <span className="down">{b.from}% → {b.to}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="report-foot">
        <div className="forecast-pill">
          <WeatherIcon kind={nw.icon} size={22} /> Next: <strong>{nw.name}</strong>
        </div>

        {r.missionsCompleted.map((id) => (
          <div key={id} className="mission-pill">
            <Check size={16} /> {MISSIONS.find((m) => m.id === id).name}
          </div>
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
    <Modal
      title="A Place to Begin"
      kicker="Chapter 1"
      onClose={close}
      size="md"
      className="intro-modal"
      footer={
        <button
          type="button"
          className="btn-gold"
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
          autoFocus
        >
          Let's begin
        </button>
      }
    >
      <blockquote className="intro-quote">
        “{INTRO.text}”<cite>— {INTRO.speaker}</cite>
      </blockquote>

      <ol className="steps">
        <li>Build a <strong>Shelter</strong>, then choose <strong>Unlock bridges</strong> in the Build menu.</li>
        <li>Tap the grove, stone deposits, garden or collector on New Haven. <strong>Each source runs out, then regrows after a short rest.</strong></li>
        <li>Build a bridge to <strong>Verdant Reach</strong> for timber and crops, <strong>Rain Island</strong> for water, or <strong>Prism Shelf</strong> for crystals.</li>
        <li>Earn <strong>10 XP per action</strong> and bonus XP from quests. <strong>Level up</strong> to unlock buildings and bridges. Resources update automatically after each action.</li>
      </ol>
    </Modal>
  )
}

// These events are already shown on the map itself (floating numbers, bursts), so no toast
const QUIET = ['gain', 'build', 'bridge']

function ToastItem({ t, onDone }) {
  useEffect(() => {
    const ms = t.kind === 'mission' || t.kind === 'level' ? 5000 : 2800
    const id = setTimeout(onDone, ms)
    return () => clearTimeout(id)
  }, [t.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`toast toast-${t.kind}`} onClick={onDone}>
      {(t.kind === 'mission' || t.kind === 'level' || t.kind === 'bridge') && (
        <Star size={18} className="toast-star" />
      )}
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
      {state.toasts.filter((t) => !QUIET.includes(t.kind)).slice(-3).map((t) => (
        <ToastItem key={t.id} t={t} onDone={() => dispatch({ type: 'DISMISS_TOAST', id: t.id })} />
      ))}
    </div>
  )
}
