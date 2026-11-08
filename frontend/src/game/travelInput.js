// Map travel is a deliberate gesture. Menus, forms, and drags never count as one.

export const DRAG_THRESHOLD = 6

const TYPING = 'input, textarea, select, [contenteditable="true"], [role="textbox"]'

export function isTypingTarget(target) {
  return Boolean(target?.closest?.(TYPING) || target?.closest?.('form'))
}

export function pointerPastDragThreshold(dx, dy, threshold = DRAG_THRESHOLD) {
  return Math.hypot(dx, dy) > threshold
}

// A click dismisses an overlay while that overlay is still the event target,
// so the browser cannot retarget the same click onto the map underneath.
export function eventShouldDismissOverlay(event) {
  return event?.type === 'click' && event.target === event.currentTarget
}

export function shouldTravelFromMapClick({ detail = 1, moved = false, uiBusy = false } = {}) {
  if (uiBusy || moved) return false
  return detail >= 2
}

export function shouldHintTravel({ detail = 1, moved = false, uiBusy = false } = {}) {
  return !uiBusy && !moved && detail === 1
}

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'])

export function keyboardShouldWalk({ key, target, uiBusy = false, ctrlKey = false, altKey = false, metaKey = false, shiftKey = false } = {}) {
  if (ctrlKey || altKey || metaKey || shiftKey) return false
  if (!MOVE_KEYS.has(String(key || '').toLowerCase())) return false
  if (uiBusy || isTypingTarget(target)) return false
  return true
}
