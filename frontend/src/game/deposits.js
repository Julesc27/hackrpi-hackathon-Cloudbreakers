import { GATHER_SITES } from './data.js'

export const primaryReward = (site) => Object.keys(site.reward)[0]

export function freshDeposits() {
  return Object.fromEntries(Object.entries(GATHER_SITES).map(([id, site]) => [id, { stock: site.stock, regrowAt: 0 }]))
}

// One stock record per gather node. Legacy saves stored New Haven amounts by resource name.
export function normalizeDeposits(raw, now = Date.now()) {
  const out = {}
  for (const [id, site] of Object.entries(GATHER_SITES)) {
    const node = raw?.[id]
    let stock = site.stock
    let regrowAt = 0
    if (node && typeof node === 'object' && Number.isFinite(Number(node.stock))) {
      stock = Number(node.stock)
      regrowAt = Number(node.regrowAt) || 0
    } else if (site.legacy && raw && Number.isFinite(Number(raw[site.legacy]))) {
      stock = Number(raw[site.legacy])
    }
    stock = Math.max(0, Math.min(site.stock, stock))
    if (stock > 0) regrowAt = 0
    else if (regrowAt && now >= regrowAt) { stock = site.stock; regrowAt = 0 }
    else if (!regrowAt) regrowAt = now + site.regrowMs
    out[id] = { stock, regrowAt }
  }
  return out
}

export function viewDeposit(deposits, siteId, now = Date.now()) {
  const site = GATHER_SITES[siteId]
  if (!site) return null
  const node = deposits?.[siteId]
  let stock = site.stock
  let regrowAt = 0
  if (node && typeof node === 'object' && Number.isFinite(Number(node.stock))) {
    stock = Math.max(0, Math.min(site.stock, Number(node.stock)))
    regrowAt = Number(node.regrowAt) || 0
  }
  if (stock <= 0 && regrowAt && now >= regrowAt) { stock = site.stock; regrowAt = 0 }
  const regrowing = stock <= 0
  return {
    stock, max: site.stock, regrowAt, regrowing,
    ready: stock > 0,
    remainingMs: regrowing ? Math.max(0, (regrowAt || now) - now) : 0,
  }
}
