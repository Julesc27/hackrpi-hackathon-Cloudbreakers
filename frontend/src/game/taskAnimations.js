import { GATHER_SITES } from './data.js'

const ANIMATIONS = {
  chop: { duration: 1.8, color: '#e4b46d' },
  mine: { duration: 1.8, color: '#b7d8f2' },
  crystal: { duration: 2, color: '#8be5ff' },
  garden: { duration: 1.8, color: '#b9de83' },
  harvest: { duration: 1.6, color: '#b9de83' },
  collect: { duration: 1.6, color: '#8bd5ff' },
  fish: { duration: 2.2, color: '#8bd5ff' },
  build: { duration: 2.4, color: '#f2ce83' },
  repair: { duration: 2, color: '#f2ce83' },
  beacon: { duration: 2.4, color: '#ffe5a1' },
  deposit: { duration: 1.2, color: '#f2ce83' },
}

export function taskAnimation(action) {
  if (!action) return null
  const siteId = action.type === 'GATHER_WOOD' ? 'grove' : action.type === 'HARVEST_FOREST' ? 'forest' : action.type === 'GATHER_AT_SITE' ? action.siteId : null
  const site = GATHER_SITES[siteId]
  let kind
  if (site) kind = ({ fishing: 'fish', forage: 'harvest', lumber: 'build', salvage: 'repair' })[siteId]
    || ({ wood: 'chop', stone: 'mine', crystal: 'crystal', garden: 'garden', water: 'collect' })[site.kind]
  else if (action.type === 'RESTORE_BEACON') kind = 'beacon'
  else if (action.type === 'DEPOSIT_BACKPACK') kind = 'deposit'
  else if (action.type === 'BUILD' || action.type === 'BUILD_BRIDGE') kind = 'build'
  else if (['REPAIR_BRIDGE', 'UPGRADE_BRIDGE', 'REMOVE_BUILDING', 'REMOVE_BRIDGE'].includes(action.type)) kind = 'repair'
  return kind ? { kind, ...ANIMATIONS[kind] } : null
}
