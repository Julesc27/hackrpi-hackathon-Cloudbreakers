import { useGame, useUI } from '../../game/GameContext.jsx'
import { GATHER_SITES, RESOURCES } from '../../game/data.js'
import { INTERACTION_POINTS } from '../../game/mapLayout.js'
import { gatherAvailability, islandAccess } from '../../game/engine.js'
import { RES_ICON, Hammer } from '../icons.jsx'

export function SiteActions({ island }) {
  const { state, dispatch } = useGame()
  return Object.entries(GATHER_SITES).filter(([, site]) => site.island === island).map(([id, site]) => {
    const reason = gatherAvailability(state, id)
    return <button key={id} data-tutorial={id === 'grove' ? 'gather-wood-btn' : undefined} className="btn-action" disabled={Boolean(reason)} title={reason || site.label} onClick={() => dispatch({ type: 'GATHER_AT_SITE', siteId: id })}>
      <span>{site.label}</span>
      <small>{Object.entries(site.reward).map(([key, value]) => `+${value} ${RESOURCES[key].label.toLowerCase()}`).join(' · ')}{site.deposit ? ` · ${state.deposits[site.deposit]} remaining` : ''}{site.cost ? ' · uses 1 seed' : ''}</small>
      {reason && <small>{reason}</small>}
    </button>
  })
}

export default function InteractionSites() {
  const { state, dispatch } = useGame()
  const ui = useUI()
  const access = islandAccess(state)
  const activate = (id) => dispatch({ type: 'GATHER_AT_SITE', siteId: id })
  return <g className="interaction-sites">
    {Object.entries(GATHER_SITES).map(([id, site]) => {
      if (!access[site.island]) return null
      const [x, y] = INTERACTION_POINTS[id]
      const resource = Object.keys(site.reward)[0], Icon = RES_ICON[resource]
      const reason = gatherAvailability(state, id)
      const depleted = site.deposit && state.deposits[site.deposit] <= 0
      const label = depleted ? 'Depleted · build outward' : site.label
      return <g key={id} transform={`translate(${x} ${y})`} role="button" tabIndex="0" aria-label={`${site.label}${site.deposit ? `, ${state.deposits[site.deposit]} remaining` : ''}`} aria-disabled={Boolean(reason)}
        data-tutorial={id === 'grove' ? 'gather-wood-site' : undefined}
        className={`resource-site site-${site.kind}${reason ? ' is-unavailable' : ''}${depleted ? ' is-depleted' : ''}`}
        onClick={() => activate(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(id) } }}>
        <title>{reason || `${site.label} · ${Object.entries(site.reward).map(([key, value]) => `+${value} ${RESOURCES[key].label}`).join(', ')}`}</title>
        <circle r="38" fill="transparent" />
        <ellipse className="site-ground-glow" cy="23" rx="36" ry="15" fill="none" stroke="currentColor" strokeWidth="2" />
        <g key={state.lastInteraction?.siteId === id ? state.lastInteraction.id : id} className={`site-marker ui-scale${state.lastInteraction?.siteId === id ? ' is-harvesting' : ''}`}>
          <path d="M0 24L-5 14A18 18 0 1 1 5 14Z" fill="#142e4ce8" stroke="currentColor" strokeWidth="1.5" />
          <g transform="translate(-12 -13)" pointerEvents="none">{Icon && <Icon size={24} />}</g>
          {site.deposit && <g transform="translate(15 -15)"><rect x="-12" y="-8" width="26" height="17" rx="8" fill="#15314c" stroke="currentColor" /><text x="1" y="4" textAnchor="middle" className="site-count">{state.deposits[site.deposit]}</text></g>}
          <g className="site-tooltip" transform="translate(0 -40)"><rect x="-96" y="-13" width="192" height="27" rx="12" fill="#0d2645ef" stroke="currentColor" /><text y="5" textAnchor="middle">{label}</text></g>
        </g>
      </g>
    })}
    <g transform="translate(635 585)" role="button" tabIndex="0" aria-label="Open workshop" className="resource-site site-workshop" onClick={() => { ui.emitFx({ kind: 'harvest', material: 'stone', x: 635, y: 585, ttl: 1100 }); ui.setPanel('build') }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.setPanel('build') } }}>
      <title>Workshop · build shelters and early buildings</title><circle r="36" fill="transparent" /><g className="ui-scale"><circle r="18" fill="#18314de8" stroke="#e4cd97" /><g transform="translate(-12 -12)"><Hammer size={24} /></g></g>
    </g>
  </g>
}
