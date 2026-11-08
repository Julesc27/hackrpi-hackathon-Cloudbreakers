// The player's Captain: what they look like. Stored in the save as `state.avatar`.
// Every option has a label so the editor (and screen readers) can name it.

export const AVATAR_OPTIONS = {
  body: [
    { id: 'man', label: 'Man' },
    { id: 'woman', label: 'Woman' },
  ],
  skin: [
    { id: '#f6dcc4', label: 'Fair' },
    { id: '#f3cfac', label: 'Light' },
    { id: '#e2b08a', label: 'Warm' },
    { id: '#c98f66', label: 'Tan' },
    { id: '#a06a48', label: 'Brown' },
    { id: '#7a4e34', label: 'Deep' },
  ],
  hairStyle: [
    { id: 'short', label: 'Short' },
    { id: 'curly', label: 'Curly' },
    { id: 'long', label: 'Long' },
    { id: 'ponytail', label: 'Ponytail' },
    { id: 'bun', label: 'Bun' },
    { id: 'bald', label: 'Shaved' },
  ],
  hair: [
    { id: '#1f1a24', label: 'Black' },
    { id: '#3b2a1e', label: 'Dark brown' },
    { id: '#6b4426', label: 'Brown' },
    { id: '#8a4a2a', label: 'Auburn' },
    { id: '#c99a5e', label: 'Blond' },
    { id: '#e9e1d2', label: 'Silver' },
    { id: '#5b6fc0', label: 'Sky blue' },
  ],
  beard: [
    { id: 'none', label: 'None' },
    { id: 'stubble', label: 'Stubble' },
    { id: 'beard', label: 'Beard' },
  ],
  outfit: [
    { id: 'coat', label: 'Captain’s coat' },
    { id: 'tunic', label: 'Skywright tunic' },
    { id: 'cloak', label: 'Traveller’s cloak' },
    { id: 'dress', label: 'Dress' },
    { id: 'apron', label: 'Gardener’s apron' },
  ],
  top: [
    { id: '#2c4fb0', label: 'Navy' },
    { id: '#3f8f9a', label: 'Teal' },
    { id: '#5f9e4f', label: 'Leaf green' },
    { id: '#6a5ac8', label: 'Violet' },
    { id: '#c0603e', label: 'Brick red' },
    { id: '#d39a3a', label: 'Amber' },
    { id: '#e07a9a', label: 'Rose' },
    { id: '#f3e6c6', label: 'Cream' },
  ],
  bottom: [
    { id: '#3a3550', label: 'Charcoal' },
    { id: '#2b3a66', label: 'Indigo' },
    { id: '#5b4636', label: 'Brown' },
    { id: '#6b5a44', label: 'Khaki' },
    { id: '#7a3a4a', label: 'Plum' },
  ],
  hat: [
    { id: 'none', label: 'None' },
    { id: 'captain', label: 'Captain’s hat' },
    { id: 'aviator', label: 'Aviator cap' },
    { id: 'straw', label: 'Straw hat' },
    { id: 'cap', label: 'Lamplighter cap' },
    { id: 'hood', label: 'Hood' },
  ],
}

export const DEFAULT_AVATAR = {
  body: 'woman', skin: '#e2b08a', hairStyle: 'ponytail', hair: '#6b4426', beard: 'none',
  outfit: 'coat', top: '#2c4fb0', bottom: '#3a3550', hat: 'captain',
}

/** Keep only known values, filling gaps from the default (old saves, hand-edited saves). */
export function normalizeAvatar(a) {
  const out = { ...DEFAULT_AVATAR }
  if (!a || typeof a !== 'object') return out
  for (const [key, opts] of Object.entries(AVATAR_OPTIONS)) {
    if (opts.some((o) => o.id === a[key])) out[key] = a[key]
  }
  if (out.body !== 'man') out.beard = 'none'
  return out
}

export function randomAvatar(r = Math.random) {
  const pick = (k) => AVATAR_OPTIONS[k][Math.floor(r() * AVATAR_OPTIONS[k].length)].id
  const a = {}
  for (const k of Object.keys(AVATAR_OPTIONS)) a[k] = pick(k)
  return normalizeAvatar(a)
}

/** The drawing fields people.js understands, for the player's Captain (see game/player.js). */
export function avatarLook(a) {
  const v = normalizeAvatar(a)
  return {
    kid: false, role: 'captain', body: v.body, scarf: null, kite: null,
    skin: v.skin, hair: v.hair, hairStyle: v.hairStyle, beard: v.beard,
    shirt: v.top, pants: v.bottom,
    coat: v.outfit === 'coat', trim: v.outfit === 'coat' || v.outfit === 'tunic' ? '#e3c27a' : null,
    cloak: v.outfit === 'cloak' ? v.top : null, dress: v.outfit === 'dress',
    apron: v.outfit === 'apron' ? '#f3e6c6' : null,
    hat: v.hat === 'none' ? null : v.hat, carry: null,
  }
}
