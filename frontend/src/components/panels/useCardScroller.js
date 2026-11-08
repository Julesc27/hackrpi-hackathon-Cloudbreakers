import { useCallback, useEffect, useRef, useState } from 'react'

// A horizontal row of cards browsed with ‹ › buttons (the Skyway Chart and the Town Workshop).
//   ref        – put on the scrolling row
//   edges      – { start, end }: disable the buttons at either end
//   range      – { first, last, total }: which cards are in view, 1-based
//   page(dir)  – scroll a whole page of cards left (-1) or right (1)
//   onKeyDown  – ← / → on the focused row pages too
// A normal mouse wheel also scrolls the row sideways.
export default function useCardScroller(total) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: true })
  const [range, setRange] = useState({ first: 1, last: total, total })

  const measure = useCallback(() => {
    const row = ref.current
    if (!row) return
    const cards = row.children
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : row.clientWidth
    const perPage = Math.max(1, Math.floor((row.clientWidth + 1) / (step || row.clientWidth)))
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2
    // at the far end the last card is in view, whatever the rounding says
    const first = atEnd ? Math.max(1, total - perPage + 1) : Math.min(total, Math.round(row.scrollLeft / (step || 1)) + 1)
    setEdges({ start: row.scrollLeft <= 2, end: atEnd })
    setRange({ first, last: atEnd ? total : Math.min(total, first + perPage - 1), total })
    return { step, perPage }
  }, [total])

  useEffect(() => {
    const row = ref.current
    if (!row) return
    const onWheel = (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1)
      const next = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, row.scrollLeft + delta))
      if (Math.abs(next - row.scrollLeft) < 0.5) return
      event.preventDefault()
      row.scrollLeft = next
    }
    const resize = new ResizeObserver(measure)
    resize.observe(row)
    row.addEventListener('scroll', measure, { passive: true })
    row.addEventListener('wheel', onWheel, { passive: false })
    measure()
    return () => {
      resize.disconnect()
      row.removeEventListener('scroll', measure)
      row.removeEventListener('wheel', onWheel)
    }
  }, [measure])

  const page = useCallback((direction) => {
    const row = ref.current
    if (!row) return
    const { step, perPage } = measure()
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollBy({ left: direction * step * perPage, behavior: smooth ? 'smooth' : 'auto' })
  }, [measure])

  const onKeyDown = (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      page(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  return { ref, edges, range, page, onKeyDown }
}
