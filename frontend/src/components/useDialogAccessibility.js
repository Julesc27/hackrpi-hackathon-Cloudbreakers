import { useLayoutEffect, useRef } from 'react'

const modalStack = []
const inertCounts = new Map()
const tabbables = root => [...root.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]')]
  .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[inert]'))

// Shared by parchment modals and the custom workshop, journal and advisor panels.
export default function useDialogAccessibility(ref, { modal = true, onClose, dismissable = true, enabled = true } = {}) {
  const close = useRef(onClose)
  const returnFocus = useRef(null)
  close.current = onClose
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !enabled) return
    const focused = document.activeElement
    if (!root.contains(focused) && focused !== document.body) returnFocus.current = focused
    const opener = returnFocus.current || focused
    const inert = []
    root.setAttribute('aria-modal', String(modal))
    root.setAttribute('tabindex', '-1')
    if (modal) {
      modalStack.push(root)
      for (let branch = root; branch.parentElement && branch !== document.body; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch || sibling.matches('.toasts, [data-live-announcements], .tutorial-root, [data-guided-dialog], script, style')) continue
          if (!inertCounts.has(sibling)) inertCounts.set(sibling, { count: 0, original: sibling.inert })
          inertCounts.get(sibling).count++
          sibling.inert = true; inert.push(sibling)
        }
      }
    }
    const focusStart = () => {
      const heading = root.querySelector('h1, h2, h3')
      if (heading) heading.tabIndex = -1
      ;(heading || tabbables(root)[0] || root).focus({ preventScroll: true })
    }
    if (!root.contains(document.activeElement)) focusStart()
    const keydown = event => {
      if (modalStack.length && modalStack.at(-1) !== root) return
      if (!modal && !root.contains(event.target)) return
      if (event.key === 'Escape' && dismissable && close.current) {
        event.preventDefault(); event.stopPropagation(); close.current(); return
      }
      if (!modal || event.key !== 'Tab') return
      const items = tabbables(root), current = document.activeElement
      if (!items.length) { event.preventDefault(); root.focus(); return }
      if (event.shiftKey && (current === items[0] || !items.includes(current))) {
        event.preventDefault(); items.at(-1).focus()
      } else if (!event.shiftKey && (current === items.at(-1) || !items.includes(current))) {
        event.preventDefault(); items[0].focus()
      }
    }
    const focusin = event => {
      if (modal && modalStack.at(-1) === root && !root.contains(event.target) && !event.target.closest?.('.tutorial-root, [data-guided-dialog]')) focusStart()
    }
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', focusin)
      const index = modalStack.indexOf(root)
      if (index >= 0) modalStack.splice(index, 1)
      for (const node of inert) {
        const entry = inertCounts.get(node)
        if (--entry.count === 0) { node.inert = entry.original; inertCounts.delete(node) }
      }
      queueMicrotask(() => {
        const top = modalStack.at(-1)
        if (top && (top.contains(document.activeElement) || !top.contains(opener))) return
        if (document.activeElement !== document.body && document.activeElement?.isConnected && !root.contains(document.activeElement)) return
        const target = document.querySelector('.placing-hint select') || (opener?.isConnected ? opener : document.querySelector('[data-accessible-actions]'))
        target?.focus({ preventScroll: true })
      })
    }
  }, [ref, modal, dismissable, enabled])
}
