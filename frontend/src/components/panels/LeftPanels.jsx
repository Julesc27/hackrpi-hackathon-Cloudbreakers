import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { BUILDINGS, BUILD_ORDER, MISSIONS } from '../../game/data.js'
import { activeMissions, canAfford, countType, isUnlocked, unlockLevel } from '../../game/engine.js'
import { getAdvice } from '../../game/advisor.js'
import { CostChips, YieldChips, Progress, Corners } from './Panel.jsx'
import { Check, Lock, Close, ArtIcon, Plus } from '../icons.jsx'

const CHAPTERS = { 1: 'A Place to Begin', 2: 'The First Connection', 3: 'A Town Needs More' }
const QUEST_ART = {
  firstSteps: 'quest-shelter', anchor: 'build-bridgeAnchor', placeForWater: 'advisor-rain', firstBridge: 'quest-bridge',
  gardenInSky: 'quest-garden', beaconWakes: 'island-newHaven', keepLightsOn: 'build-solarFarm', longSpan: 'quest-bridge',
  cleanRoute: 'card-verdant', balancedTown: 'quest-garden',
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
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="book" role="dialog" aria-label="Captain's Log">
        <button className="seal-close book-close" onClick={close} aria-label="Close"><Close size={20} /></button>
        <div className="book-page book-left">
          <div className="p-sub">New Haven Archives</div>
          <h2 className="log-title"><span className="spark">✦</span>Captain's<br />Log<span className="spark">✦</span></h2>
          <img className="log-art" src="/art/log-illustration.webp" alt="" />
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
                <li key={m.id} className={`qcard${featured ? ' is-featured' : ''}${done ? ' is-done' : ''}${!isActive && !done ? ' is-locked' : ''}`}>
                  <div className="qnum">{i + 1}</div>
                  <div className="qbody">
                    <div className="qtitle">{m.name}</div>
                    <div className="qrow">
                      {(featured || isActive) && <img className="qart" src={`/art/${QUEST_ART[m.id]}.webp`} alt="" />}
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
  const { state } = useGame()
  const ui = useUI()
  const close = () => ui.setPanel(null)
  useEsc(close)
  const noActions = state.actionsLeft < 1
  return (
    <aside className="workshop" role="dialog" aria-label="Town Workshop">
      <div className="workshop-inner parchment">
        <button className="seal-close square" onClick={close} aria-label="Close"><Close size={20} /></button>
        <header className="ws-head">
          <h2><ArtIcon name="hammer-gold" size={38} /> Town Workshop</h2>
          <div className="ws-sub"><span className="spark">✦</span>Build something bright<span className="spark">✦</span></div>
          <p>Every new building changes the skyline of New Haven. <strong>{state.actionsLeft}</strong> action{state.actionsLeft === 1 ? '' : 's'} left this turn.</p>
        </header>
        <div className="ws-cards">
          {BUILD_ORDER.map((key) => {
            const def = BUILDINGS[key]
            const unlocked = isUnlocked(state, key)
            const affordable = canAfford(state.resources, def.cost)
            const built = def.unique && countType(state, key) > 0
            const disabled = !unlocked || !affordable || built || noActions
            const fx = []
            if (def.housing) fx.push(`Houses ${def.housing}`)
            if (def.capBonus) fx.push(`+${def.capBonus} storage`)
            if (def.energyCap) fx.push(`+${def.energyCap} energy storage`)
            if (def.happiness) fx.push(`${def.happiness > 0 ? '+' : ''}${def.happiness} happiness`)
            return (
              <div key={key} className={`ws-card${!unlocked ? ' is-locked' : ''}`}>
                <div className="ws-name">{def.name}</div>
                <img className="ws-art" src={`/art/build-${key}.webp`} alt="" />
                <p className="ws-desc">{def.desc}</p>
                <div className="ws-meta">
                  {def.prod && <YieldChips yields={def.prod} />}
                  {def.upkeep && <YieldChips yields={def.upkeep} sign="−" />}
                  {fx.length > 0 && <span className="ws-fx">{fx.join(' · ')}</span>}
                </div>
                <div className="ws-cost">
                  {unlocked ? <CostChips cost={def.cost} resources={state.resources} /> : <span className="locked-note"><Lock size={14} /> Level {unlockLevel(key)}</span>}
                </div>
                <button
                  className="gold-plus"
                  disabled={disabled}
                  title={built ? 'Already built' : !unlocked ? `Unlocks at level ${unlockLevel(key)}` : !affordable ? 'Not enough resources' : noActions ? 'No actions left' : `Build ${def.name}`}
                  onClick={() => { ui.setPlacing(key); ui.setPanel(null) }}
                >
                  {built ? <Check size={22} /> : unlocked ? <Plus size={26} /> : <Lock size={20} />}
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
      <img className="notes-header" src="/art/advisor-header.webp" alt="Cloud's Notes — here for a brighter tomorrow" />
      <button className="seal-close notes-close" onClick={close} aria-label="Close"><Close size={20} /></button>
      <div className="notes-scroll">
        <div className="notes-card">
          <div className="notes-label">My suggestion</div>
          <button className="suggestion" onClick={() => a.routeId && ui.setBridgeRoute(a.routeId)} disabled={!a.routeId}>
            {a.art && <img src={a.art} alt="" />}
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
