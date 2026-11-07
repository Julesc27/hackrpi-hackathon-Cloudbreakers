import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { BUILDINGS, BUILD_ORDER, MISSIONS } from '../../game/data.js'
import { activeMissions, canAfford, countType, isUnlocked, unlockLevel } from '../../game/engine.js'
import { getAdvice } from '../../game/advisor.js'
import { CostChips, YieldChips, Progress, Corners } from './Panel.jsx'
import { Check, Lock, Close, ArtIcon, Plus } from '../icons.jsx'
import BuildingArt from '../BuildingArt.jsx'
import Vignette from '../vignettes.jsx'

const CHAPTERS = { 1: 'A Place to Begin', 2: 'The First Connection', 3: 'A Town Needs More' }
const QUEST_ART = {
  firstSteps: 'shelter', anchor: 'bridgeAnchor', placeForWater: 'rain', firstBridge: 'bridgeAnchor',
  gardenInSky: 'garden', beaconWakes: 'newHaven', keepLightsOn: 'solarFarm', longSpan: 'bridgeAnchor',
  cleanRoute: 'verdant', balancedTown: 'garden',
}

function useEsc(onClose) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
}

/* ---------------- Captain's Log (quest book) ---------------- */
export function QuestBook() {
  const { state } = useGame()
  const ui = useUI()
  const close = () => ui.setPanel(null)
  useEsc(close)
  const active = activeMissions(state)
  const activeIds = active.map((m) => m.id).join()

  useEffect(() => {
    ui.setSeenQuests((seen) => [...new Set([...seen, ...activeIds.split(',')])])
  }, [activeIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const chapter = active[0]?.chapter ?? 3
  const ordered = [
    ...active,
    ...MISSIONS.filter((m) => !state.completed.includes(m.id) && !active.includes(m)),
    ...MISSIONS.filter((m) => state.completed.includes(m.id)),
  ]

  const go = (m) => {
    const id = m.id
    if (['firstSteps', 'anchor', 'keepLightsOn'].includes(id)) ui.setPanel('build')
    else if (['firstBridge', 'cleanRoute', 'longSpan'].includes(id)) ui.setPanel('map')
    else if (id === 'beaconWakes') ui.openIsland('newHaven')
    else if (id === 'balancedTown') ui.setPanel('storage')
    else ui.setPanel(null)

    // If the tutorial is on the quest-book step, clicking Continue Quest should advance it
    if (ui.tutorialStep === 6) {
      ui.setPanel(null)
      ui.setTutorialStep(7)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="book" role="dialog" aria-label="Captain's Log">
        <button className="seal-close book-close" onClick={close} aria-label="Close"><Close size={20} /></button>
        <div className="book-page book-left">
          <div className="p-sub">New Haven Archives</div>
          <h2 className="log-title"><span className="spark">✦</span>Captain's<br />Log<span className="spark">✦</span></h2>
          <Vignette kind="log" className="log-art" />
          <div className="p-sub chapter">— Chapter {chapter}: {CHAPTERS[chapter]} —</div>
          <p className="script">Higher homes.<br />Kinder skies.<br />A brighter tomorrow.</p>
          <div className="p-sub tiny">People · Places · Progress</div>
        </div>
        <div className="book-rings" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} />)}</div>
        <div className="book-page book-right">
          <div className="quests-head"><span className="spark">✦</span>Quests<span className="spark">✦</span></div>
          <div className="script small center">Small steps build brighter skies.</div>
          <ol className="quest-list">
            {ordered.map((m, i) => {
              const done = state.completed.includes(m.id)
              const isActive = active.includes(m)
              const featured = isActive && m === active[0]
              const [v, g] = m.progress(state)

              return (
                <li
                  key={m.id}
                  className={`qcard${featured ? ' is-featured' : ''}${done ? ' is-done' : ''}${!isActive && !done ? ' is-locked' : ''}`}
                  data-tutorial={featured || i === 0 ? 'quest-featured' : undefined}
                >
                  <div className="qnum">{i + 1}</div>
                  <div className="qbody">
                    <div className="qtitle">{m.name}</div>
                    <div className="qrow">
                      {(featured || isActive) && <Vignette kind={QUEST_ART[m.id]} className="qart" />}
                      <div className="qtext">
                        <p>{isActive || done ? m.objective : `Unlocks after ${(m.requires || []).map((r) => MISSIONS.find((x) => x.id === r).name).join(', ')}.`}</p>
                        {isActive && !featured && (
                          <div className="qprog"><Progress value={v} max={g} color="linear-gradient(90deg,#3f8ae0,#8fd0ff)" /><span>{v}/{g}</span></div>
                        )}
                      </div>
                      {done && <span className="qcheck"><Check size={18} /></span>}
                      {!isActive && !done && <span className="qlock"><Lock size={16} /></span>}
                    </div>
                    {featured && (
                      <>
                        <div className="reward-line"><span>Reward</span></div>
                        <div className="rewards">
                          {m.reward.xp && <span><span className="xp-star">★</span> +{m.reward.xp} XP</span>}
                          {m.reward.coins && <span><ArtIcon name="coins" size={24} /> +{m.reward.coins} Cloud Coins</span>}
                          {!m.reward.coins && <span className="small">{m.rewardText.split(' · ').slice(1).join(' · ')}</span>}
                        </div>
                        <div className="qprog"><Progress value={v} max={g} color="linear-gradient(90deg,#3f8ae0,#8fd0ff)" /><span>{v}/{g}</span></div>
                        <button className="btn-pill" onClick={() => go(m)}>Continue Quest <span aria-hidden="true">›</span></button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
        <div className="bookmark" aria-hidden="true"><ArtIcon name="cloud" size={22} /></div>
      </div>
    </div>
  )
}

/* ---------------- Town Workshop (build) ---------------- */
export function BuildPanel() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const close = () => ui.setPanel(null)
  useEsc(close)

  return (
    <aside className="workshop" role="dialog" aria-label="Town Workshop">
      <div className="workshop-inner parchment">
        <button className="seal-close square" onClick={close} aria-label="Close"><Close size={20} /></button>
        <header className="ws-head">
          <h2><ArtIcon name="hammer-gold" size={38} /> Town Workshop</h2>
          <div className="ws-sub"><span className="spark">✦</span>Build something bright<span className="spark">✦</span></div>
          <p>Every new building changes the skyline of New Haven. Earn XP as you build and complete quests to unlock more.</p>
        </header>
        <div className="ws-cards">
          {BUILD_ORDER.map((key) => {
            const def = BUILDINGS[key]
            const unlocked = isUnlocked(state, key)
            const affordable = canAfford(state.resources, def.cost)
            const built = def.unique && countType(state, key) > 0
            const managing = def.infrastructure && built
            const disabled = !managing && (!unlocked || !affordable || built)
            const fx = []

            if (def.housing) fx.push(`Houses ${def.housing}`)
            if (def.capBonus) fx.push(`+${def.capBonus} storage`)
            if (def.energyCap) fx.push(`+${def.energyCap} energy storage`)
            if (def.happiness) fx.push(`${def.happiness > 0 ? '+' : ''}${def.happiness} happiness`)

            return (
              <div key={key} className={`ws-card${!unlocked ? ' is-locked' : ''}`} data-tutorial={`build-card-${key}`}>
                <div className="ws-name">{def.name}</div>
                <>{def.infrastructure ? <div className="ws-art anchor-upgrade-art"><ArtIcon name="build" size={62} /><span>Workshop upgrade</span></div> : <BuildingArt type={key} className="ws-art" />}</>
                <p className="ws-desc">{def.desc}</p>
                <div className="ws-meta">
                  {def.prod && <YieldChips yields={def.prod} />}
                  {def.upkeep && <YieldChips yields={def.upkeep} sign="−" />}
                  {fx.length > 0 && <span className="ws-fx">{fx.join(' · ')}</span>}
                </div>
                <div className="ws-cost">
                  {managing ? <span className="small">Unlocked · no building plot needed</span> : unlocked ? <CostChips cost={def.cost} resources={state.resources} /> : <span className="locked-note"><Lock size={14} /> Level {unlockLevel(key)}</span>}
                </div>
                <button
                  className={def.infrastructure ? 'btn-gold full' : 'gold-plus'}
                  disabled={disabled}
                  data-tutorial={`build-btn-${key}`}
                  title={managing ? 'Manage bridges' : built ? 'Already built' : !unlocked ? `Unlocks at level ${unlockLevel(key)}` : !affordable ? 'Not enough resources' : `Build ${def.name}`}
                  onClick={() => {
                    if (def.infrastructure) {
                      if (!built) dispatch({ type: 'BUILD', buildingType: key, island: 'newHaven' })
                      ui.setPanel('bridges')
                    } else { ui.setPlacing(key); ui.setPanel(null) }
                  }}
                >
                  {def.infrastructure ? (managing ? 'Manage bridges' : 'Unlock bridges') : built ? <Check size={22} /> : unlocked ? <Plus size={26} /> : <Lock size={20} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

/* ---------------- Cloud's Notes (advisor) ---------------- */
export function AdvisorPanel() {
  const { state } = useGame()
  const ui = useUI()
  const close = () => ui.setPanel(null)
  useEsc(close)
  const [n, setN] = useState(0)
  const all = getAdvice(state)
  const a = all[n % all.length]

  return (
    <aside className="notes" role="dialog" aria-label="Cloud's Notes">
      <div className="notes-header" role="img" aria-label="Cloud's Notes — here for a brighter tomorrow">
        <svg viewBox="0 0 330 150" aria-hidden="true">
          <ellipse cx="118" cy="78" rx="78" ry="42" fill="#fff" />
          <ellipse cx="168" cy="70" rx="62" ry="40" fill="#f7f4ff" />
          <ellipse cx="78" cy="84" rx="46" ry="30" fill="#fff" />
          <path d="M92 72c2-8 10-8 12 0M150 66c2-8 10-8 12 0" stroke="#3a3550" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M118 88c8 8 22 8 30 0" stroke="#3a3550" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="86" r="6" fill="#ffc2c8" opacity="0.8" />
          <circle cx="168" cy="84" r="6" fill="#ffc2c8" opacity="0.8" />
          <path d="M36 118h258l-14 22H50z" fill="#f6ecd2" stroke="#c9a24f" />
          <text x="165" y="136" textAnchor="middle" fill="#1f2a5a" fontFamily="Georgia, serif" fontSize="18" fontWeight="700" letterSpacing="1.5">CLOUD&apos;S NOTES</text>
        </svg>
      </div>
      <button className="seal-close notes-close" onClick={close} aria-label="Close"><Close size={20} /></button>
      <div className="notes-scroll">
        <div className="notes-card" data-tutorial="advisor-card">
          <div className="notes-label">My suggestion</div>
          <button className="suggestion" onClick={() => a.routeId && ui.setBridgeRoute(a.routeId)} disabled={!a.routeId}>
            {a.art && <Vignette kind={a.art} />}
            <strong>{a.recommendation}</strong>
            {a.routeId && <span className="chev">›</span>}
          </button>
          <div className="notes-label">Why?</div>
          <p className="hand">{a.reason}</p>
          <div className="tradeoff">
            <ArtIcon name="scales" size={54} />
            <div>
              <div className="notes-label ink">Trade-off</div>
              <p className="hand">{a.tradeoff}</p>
            </div>
          </div>
          {a.alternative && <p className="hand alt"><em>Or:</em> {a.alternative}</p>}
        </div>
        <div className="confidence">
          <div>
            <div className="conf-label">Confidence</div>
            <div className="conf-num"><span className="xp-star">★</span> {a.confidence}%</div>
          </div>
          <div className="bar conf-bar"><div className="bar-fill" style={{ width: `${a.confidence}%`, background: 'linear-gradient(90deg,#3aa2f0,#8fd3ff)' }} /></div>
          <div className="conf-note">Based on current conditions and settlement data.</div>
        </div>
        <div className="notes-btns">
          <button className="btn-cream" disabled={!a.routeId} onClick={() => ui.setBridgeRoute(a.routeId)}>
            <ArtIcon name="map" size={26} /> Show route <span aria-hidden="true">›</span>
          </button>
          <button className="btn-navy" onClick={() => setN((x) => x + 1)} disabled={all.length < 2}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" fill="#e4ecff" /></svg> Ask again <span aria-hidden="true">›</span>
          </button>
        </div>
        <p className="notes-foot">{a.situation}</p>
        <p className="notes-foot script">Different paths. A brighter tomorrow.</p>
      </div>
    </aside>
  )
}

export { Corners }
