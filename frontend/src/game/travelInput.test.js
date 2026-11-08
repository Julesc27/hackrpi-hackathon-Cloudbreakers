import test from 'node:test'
import assert from 'node:assert/strict'
import {
  eventShouldDismissOverlay,
  isTypingTarget,
  keyboardShouldWalk,
  pointerPastDragThreshold,
  shouldHintTravel,
  shouldTravelFromMapClick,
} from './travelInput.js'

test('a single map click only hints, and a double-click travels', () => {
  assert.equal(shouldTravelFromMapClick({ detail: 1 }), false)
  assert.equal(shouldHintTravel({ detail: 1 }), true)
  assert.equal(shouldTravelFromMapClick({ detail: 2 }), true)
  assert.equal(shouldHintTravel({ detail: 2 }), false)
})

test('shop, build, and placement screens own the map so clicks do not travel', () => {
  for (const detail of [1, 2]) {
    assert.equal(shouldTravelFromMapClick({ detail, uiBusy: true }), false)
    assert.equal(shouldHintTravel({ detail, uiBusy: true }), false)
  }
})

test('dragging past the pan threshold is not a travel click', () => {
  assert.equal(pointerPastDragThreshold(6, 0), false)
  assert.equal(pointerPastDragThreshold(0, 7), true)
  assert.equal(shouldTravelFromMapClick({ detail: 2, moved: true }), false)
  assert.equal(shouldHintTravel({ detail: 1, moved: true }), false)
})

test('closing an overlay consumes the click instead of releasing it onto the map', () => {
  const overlay = {}
  assert.equal(eventShouldDismissOverlay({ type: 'mousedown', target: overlay, currentTarget: overlay }), false)
  assert.equal(eventShouldDismissOverlay({ type: 'click', target: overlay, currentTarget: overlay }), true)
  assert.equal(eventShouldDismissOverlay({ type: 'click', target: {}, currentTarget: overlay }), false)
})

test('typing and form controls do not walk the captain', () => {
  for (const selector of ['input', 'textarea', 'select', '[contenteditable="true"]', '[role="textbox"]', 'form']) {
    const target = { closest: (q) => q.includes(selector) ? {} : null }
    assert.equal(isTypingTarget(target), true, selector)
    assert.equal(keyboardShouldWalk({ key: 'd', target }), false, selector)
    assert.equal(keyboardShouldWalk({ key: 'arrowleft', target }), false, selector)
  }
})

test('keyboard walking still works when the map is free, and stops while a menu is open', () => {
  const map = { closest: () => null }
  assert.equal(keyboardShouldWalk({ key: 'w', target: map }), true)
  assert.equal(keyboardShouldWalk({ key: 'ArrowDown', target: map }), true)
  assert.equal(keyboardShouldWalk({ key: 'd', target: map, uiBusy: true }), false)
  assert.equal(keyboardShouldWalk({ key: 'd', target: map, shiftKey: true }), false)
  assert.equal(keyboardShouldWalk({ key: 'e', target: map }), false)
})
