import { possibleMoves } from './possibleMoves.js'
import { getAdvice } from './advisor.js'

// Offline counsel uses the same affordable, reachable moves sent to the AI.
export function localOracle(state) {
  const allowed = possibleMoves(state)
  const focus = getAdvice(state).find(tip => allowed.includes(tip.focus))?.focus || allowed[0] || 'balance'
  const poems = {
    gather: 'The sleeping branch remembers spring.\nThe patient hand returns at dawn.\nWhat rests beneath the quiet sky\nWill answer when the mist is gone.',
    balance: 'Let neither cup nor lantern fade.\nLet hungry wings find rest below.\nAttend the quiet things already made;\nThen let the distant branches grow.',
    beacon: 'A sleeping star awaits a spark.\nIts patient eye still knows the way.\nWake what watches in the dark;\nLet wandering wings return to day.',
    repair: 'The fraying thread still holds the seam.\nAttend it while the winds are mild.\nBefore another distant dream,\nMake safe the crossing for the child.',
  }
  const crossing = ['verdant', 'rain', 'prism', 'mercy', 'hearth'].includes(focus)
  return { focus, source: 'local', poem: poems[focus] || (crossing
    ? 'Beyond the mist a promise waits.\nA thread can bind the drifting shore.\nUnfasten gently winter’s gates;\nThe far horizon offers more.'
    : 'Make room for what the morning needs.\nGive patient hands a place to stay.\nThe smallest act becomes the seed\nThat keeps the coming dark at bay.') }
}
