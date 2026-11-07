import { useEffect, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { BUILDINGS, BUILD_ORDER, MISSIONS } from '../../game/data.js'
import { activeMissions, canAfford, countType, isUnlocked, unlockLevel } from '../../game/engine.js'
import { getAdvice } from '../../game/advisor.js'
import { Drawer, CostChips, YieldChips, Progress } from './Panel.jsx'
import { SpritePreview } from '../map/sprites.jsx'
import { Check, Lock } from '../icons.jsx'

export function QuestBook() {
  const { state } = useGame()
  const ui = useUI()
  const active = activeMissions(state)
  const done = MISSIONS.filter((m) => state.completed.includes(m.id))
  const upcoming = MISSIONS.filter((m) => !state.completed.includes(m.id) && !active.includes(m))
  const activeIds = active.map((m) => m.id).join()
  useEffect(() => {
    ui.setSeenQuests((seen) => [...new Set([...seen, ...activeIds.split(',')])])
  }, [activeIds]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Drawer title="Quest Book" kicker={`Chapter ${active[0]?.chapter ?? 3}`} onClose={() => ui.setPanel(null)}>
      <h3 className="section">Active</h3>
      {active.length === 0 && <p className="muted">All quests complete. The sky is yours.</p>}
      {active.map((m) => {
        const [v, g] = m.progress(state)
        return (
          <div key={m.id} className={`quest card${m.final ? ' is-final' : ''}`}>
            <div className="quest-top">
              <strong>{m.name}</strong>
              <span className="quest-count">{v}/{g}</span>
            </div>
            <p>{m.objective}</p>
            <Progress value={v} max={g} />
            <div className="reward">Reward: {m.rewardText}</div>
          </div>
        )
      })}
      {upcoming.length > 0 && (
        <>
          <h3 className="section">Coming up</h3>
          {upcoming.map((m) => (
            <div key={m.id} className="quest card is-upcoming">
              <div className="quest-top"><strong><Lock size={14} /> {m.name}</strong></div>
              <p className="muted">Unlocks after {m.requires.map((r) => MISSIONS.find((x) => x.id === r).name).join(', ')}.</p>
            </div>
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <h3 className="section">Completed</h3>
          {done.map((m) => (
            <div key={m.id} className="quest card is-done">
              <div className="quest-top"><strong><Check size={14} /> {m.name}</strong></div>
              <div className="reward">{m.rewardText}</div>
            </div>
          ))}
        </>
      )}
    </Drawer>
  )
}

export function BuildPanel() {
  const { state } = useGame()
  const ui = useUI()
  const noActions = state.actionsLeft < 1
  return (
    <Drawer title="Build" kicker={`${state.actionsLeft} action${state.actionsLeft === 1 ? '' : 's'} left`} onClose={() => ui.setPanel(null)}>
      <p className="hint">Pick a building, then click a glowing plot on any connected island.</p>
      <div className="build-list">
        {BUILD_ORDER.map((key) => {
          const def = BUILDINGS[key]
          const unlocked = isUnlocked(state, key)
          const affordable = canAfford(state.resources, def.cost)
          const built = def.unique && countType(state, key) > 0
          const disabled = !unlocked || !affordable || built || noActions
          const effects = []
          if (def.capBonus) effects.push(`+${def.capBonus} storage`)
          if (def.energyCap) effects.push(`+${def.energyCap} energy storage`)
          if (def.happiness) effects.push(`${def.happiness > 0 ? '+' : ''}${def.happiness} happiness/turn`)
          return (
            <button
              key={key}
              className={`build-card card${!unlocked ? ' is-locked' : ''}${ui.placing === key ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() => { ui.setPlacing(key); ui.setPanel(null) }}
            >
              <div className="build-art"><SpritePreview type={key} /></div>
              <div className="build-info">
                <div className="build-name">
                  {def.name}
                  <span className="cat">{def.category}</span>
                </div>
                <div className="build-desc">{def.desc}</div>
                <div className="build-meta">
                  {unlocked ? <CostChips cost={def.cost} resources={state.resources} /> : <span className="locked-note"><Lock size={14} /> Level {unlockLevel(key)}</span>}
                  {def.prod && <YieldChips yields={def.prod} />}
                  {def.upkeep && <YieldChips yields={def.upkeep} sign="−" />}
                </div>
                {effects.length > 0 && <div className="build-fx">{effects.join(' · ')}</div>}
                {built && <div className="build-fx ok">Built</div>}
              </div>
            </button>
          )
        })}
      </div>
    </Drawer>
  )
}

export function CloudFace({ size = 120, mood = 'happy' }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 120 86" aria-hidden="true" className="cloud-face">
      <defs>
        <radialGradient id="cfFill" cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c9d4f5" />
        </radialGradient>
      </defs>
      <path d="M26 78a20 20 0 0 1-3-39.7A26 26 0 0 1 72 24a20 20 0 0 1 32 17 18 18 0 0 1-6 37z" fill="url(#cfFill)" stroke="#9fb3ea" strokeWidth="2" />
      <ellipse cx="46" cy="54" rx="3.6" ry="4.6" fill="#2a3566" />
      <ellipse cx="72" cy="54" rx="3.6" ry="4.6" fill="#2a3566" />
      <circle cx="47.2" cy="52.4" r="1.2" fill="#fff" />
      <circle cx="73.2" cy="52.4" r="1.2" fill="#fff" />
      <ellipse cx="38" cy="63" rx="5" ry="3" fill="#f7b6c8" opacity=".7" />
      <ellipse cx="80" cy="63" rx="5" ry="3" fill="#f7b6c8" opacity=".7" />
      {mood === 'worried'
        ? <path d="M52 66q7 -5 14 0" stroke="#2a3566" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        : <path d="M52 62q7 7 14 0" stroke="#2a3566" strokeWidth="2.4" fill="none" strokeLinecap="round" />}
    </svg>
  )
}

export function AdvisorPanel() {
  const { state } = useGame()
  const ui = useUI()
  const [n, setN] = useState(0)
  const all = getAdvice(state)
  const a = all[n % all.length]
  const worried = a.confidence >= 88 && /repair|water|food|shortage/i.test(a.recommendation + a.reason)
  return (
    <Drawer title="Cloud" kicker="Your planning assistant" onClose={() => ui.setPanel(null)} className="advisor">
      <div className="advisor-hero">
        <CloudFace mood={worried ? 'worried' : 'happy'} />
        <p className="speech">{state.beaconRestored ? 'Beacon online. I can see so much further now!' : 'I am a bit sleepy until the beacon is restored, but here is what I see.'}</p>
      </div>
      <dl className="advice">
        <dt>Current situation</dt><dd>{a.situation}</dd>
        <dt>Recommendation</dt><dd className="rec">{a.recommendation}</dd>
        <dt>Reason</dt><dd>{a.reason}</dd>
        <dt>Trade-off</dt><dd>{a.tradeoff}</dd>
        <dt>Confidence</dt>
        <dd className="conf"><Progress value={a.confidence} max={100} color="linear-gradient(90deg,#7fb8ff,#cfe4ff)" /><span>{a.confidence}%</span></dd>
        {a.alternative && (<><dt>Alternative</dt><dd>{a.alternative}</dd></>)}
      </dl>
      <div className="row-btns">
        <button className="btn-ghost" onClick={() => setN((x) => x + 1)} disabled={all.length < 2}>
          Another idea ({(n % all.length) + 1}/{all.length})
        </button>
      </div>
      <p className="fine">Cloud explains and suggests. You make every decision.</p>
    </Drawer>
  )
}
