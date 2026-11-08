import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ArtIcon, CloudIcon } from '../icons.jsx'
import './Tutorial.css'

// Info-only steps: spotlight an element, explain it, press Next.
const INFO_STEPS = {
  9: {
    target: 'hud-level',
    title: 'Level & XP',
    text: 'Complete tasks to earn XP. Level up to unlock new buildings and stronger bridges!',
    label: 'Next \u203a',
    next: 10,
  },
  10: {
    target: 'hud-town',
    title: 'Population & Sustainability',
    text: 'Population shows villagers versus available housing \u2014 build Shelters to house more. Sustainability drops when you harvest forests, so keep it healthy!',
    label: 'Next \u203a',
    next: 11,
  },
  15: {
    target: 'settings-btn',
    title: 'Settings',
    text: 'Log in to save your town to your account, or replay this tutorial any time from Settings \u2192 How to Play.',
    label: 'Finish \u203a',
    next: 16,
  },
}

// Steps that teach an icon + the panel it opens. Each one:
//   1) points at the icon until the player opens the panel
//   2) highlights something inside the panel with a "Got it" button
// Closing the panel with X / Esc also advances (see auto-advance effect below).
const PANEL_STEPS = {
  11: {
    panel: 'advisor',
    rail: 'rail-advisor',
    inner: 'advisor-card',
    railTitle: "Cloud's Notes",
    railText: 'Need an idea? Your advisor Cloud can suggest what to do next. Click Cloud to hear a suggestion!',
    railHint: 'Click the Cloud button in the left rail',
    title: 'Advisor Suggestions',
    text: 'Cloud recommends your next move, explains why, and warns you about trade-offs. Tap Ask again for a different idea.',
    nextLabel: 'Got it \u203a',
    next: 12,
  },
  12: {
    panel: 'map',
    rail: 'nav-map',
    inner: 'chart-first-card',
    railTitle: 'The Skyway Chart',
    railText: 'New islands are waiting beyond the clouds. Click Map to open the Skyway Chart!',
    railHint: 'Click the Map button in the bottom bar',
    title: 'Discover Islands',
    text: 'Each island produces different resources. Connect them with bridges to grow your economy \u2014 costs and yields are shown here.',
    nextLabel: 'Got it \u203a',
    next: 13,
  },
  13: {
    panel: 'journal',
    rail: 'nav-journal',
    inner: 'journal-first',
    railTitle: 'Journal',
    railText: 'Your story is recorded as you play. Click Journal to read it!',
    railHint: 'Click the Journal button in the bottom bar',
    title: 'Your Journal',
    text: 'Discoveries, completed missions, and events are logged here so you can look back on your village\u2019s journey.',
    nextLabel: 'Got it \u203a',
    next: 14,
  },
  14: {
    panel: 'storage',
    rail: 'nav-storage',
    inner: 'storage-table',
    railTitle: 'The Storehouse',
    railText: 'Want the full picture of your supplies? Click Storage to open the Storehouse!',
    railHint: 'Click the Storage button in the bottom bar',
    title: 'Stock and Flow',
    text: 'See how much of each resource you have, how much you can hold, and how it will change after your next action.',
    nextLabel: 'Got it \u203a',
    next: 15,
  },
}
const FINAL_STEP = 16
const TOTAL_STEPS = FINAL_STEP - 2 // steps 2..15 are numbered (welcome + finish are modals)

export default function Tutorial() {
  const { state } = useGame()
  const ui = useUI()
  const {
    tutorialActive,
    tutorialStep,
    setTutorialStep,
    endTutorial,
  } = ui

  const [targetRect, setTargetRect] = useState(null)
  const [isShaking, setIsShaking] = useState(false)
  const tooltipRef = useRef(null)
  const [tooltipSize, setTooltipSize] = useState({ w: 340, h: 190 })
  const [viewWidth, setViewWidth] = useState(window.innerWidth)
  const [viewHeight, setViewHeight] = useState(window.innerHeight)

  // Track initial values on step entry to detect player actions
  const stepSnapshot = useRef({})

  // Record snapshots when step changes
  useEffect(() => {
    stepSnapshot.current = {
      wood: state.resources.wood,
      shelters: state.buildings.filter((b) => b.type === 'shelter').length,
      wasInQuests: false,
      wasOpen: false,
    }
    if (tutorialStep === 2) {
      ui.camera.current?.home(400)
    }
  }, [tutorialStep])

  // Determine current active target selector and copy based on tutorialStep & current UI state
  let targetSelector = null
  let title = ''
  let text = ''
  let hint = ''
  let showNextBtn = false
  let nextBtnLabel = ''
  let onNext = null

  // --- Step 1: Welcome ---
  if (tutorialStep === 1) {
    // Rendered as full centered modal
  }

  // --- Step 2: Gather Wood (Click New Haven Island -> Click Gather Wood in popup) ---
  else if (tutorialStep === 2) {
    const isNewHavenDrawer = ui.panel === 'island' && ui.selected === 'newHaven'
    if (!isNewHavenDrawer) {
      targetSelector = '[data-tutorial="island-newHaven"]'
      title = 'Explore New Haven'
      text = "Select New Haven's nameplate to view its supplies and send your captain to gather wood. Tap the paths themselves to walk."
      hint = "Select New Haven's name on the map"
      showNextBtn = false
    } else {
      targetSelector = '[data-tutorial="gather-wood-btn"]'
      title = 'Gather Wood'
      text = 'Choose Gather wood. Your captain will walk to the grove and collect timber when they arrive.'
      hint = 'Choose Gather wood, then watch your captain walk there'
      showNextBtn = false
    }
  }

  // --- Step 3: Open the Build Menu ---
  else if (tutorialStep === 3) {
    targetSelector = '[data-tutorial="rail-build"]'
    title = 'Town Workshop'
    text = 'Buildings help your village grow and survive. Click Build to open the Town Workshop!'
    hint = 'Click the Build button in the left rail'
    // No Next button — player must click Build; auto-advances when panel opens
  }

  // --- Step 4: Select a Shelter ---
  else if (tutorialStep === 4) {
    targetSelector = '[data-tutorial="build-btn-shelter"]'
    title = 'Choose a Building'
    text = 'A Shelter gives your villagers a place to live. Click the + button to select it!'
    hint = 'Click the gold + button on the Shelter card'
    // No Next button — player must click the Shelter +; auto-advances when placing starts
  }

  // --- Step 5: Place the Shelter ---
  else if (tutorialStep === 5) {
    if (ui.placing === 'shelter') {
      targetSelector = '[data-tutorial="plot-newHaven"]'
      title = 'Place the Shelter'
      text = 'Now click a glowing plot on New Haven to place your Shelter!'
      hint = 'Click a glowing diamond building plot on the island'
    } else {
      targetSelector = '[data-tutorial="rail-build"]'
      title = 'Select Shelter'
      text = 'Shelter placement was cancelled. Click Build to open Town Workshop and select Shelter again!'
      hint = 'Click Build to select Shelter'
    }
    // No Next button — placement or re-select auto-advances
  }

  // --- Step 6: Explore the Quest Book ---
  else if (tutorialStep === 6) {
    if (ui.panel !== 'quests') {
      targetSelector = '[data-tutorial="rail-quests"]'
      title = 'Explore Missions'
      text = 'Quests give you goals to work toward and rewards for completing them. Click Quest Book to see your missions!'
      hint = 'Click the Quest Book button in the left rail'
      // No Next button — player must click Quest Book
    } else {
      targetSelector = '[data-tutorial="quest-featured"]'
      title = "Captain's Log"
      text = 'Here in the Captain’s Log, you can see your active objectives, track your progress, and earn rewards like XP and Cloud Coins!'
      showNextBtn = true
      nextBtnLabel = 'Got it ›'
      onNext = () => {
        ui.setPanel(null)
        setTutorialStep(7)
      }
    }
  }

  // --- Step 7: Understand Resources ---
  else if (tutorialStep === 7) {
    targetSelector = '[data-tutorial="hud-resources"]'
    title = 'Resource Management'
    text = 'These boxes show your wood, water, food, energy, stone, and Cloud Coins. Keep food and water stocked so your villagers can survive!'
    showNextBtn = true
    nextBtnLabel = 'Continue ›'
    onNext = () => {
      ui.setPanel(null)
      setTutorialStep(8)
    }
  }

  // --- Step 8: Resource Flow & Next Action Changes ---
  else if (tutorialStep === 8) {
    targetSelector = '[data-tutorial="hud-resources"]'
    title = 'Resource Flow & Actions'
    text = 'Notice the small numbers next to the resources and happiness (like +1, -1, or ±0). Every time you complete an action, you may gain or lose this amount on the next action! Green (+) means production or a happiness gain, red (−) means upkeep or a penalty.'
    hint = 'Watch these numbers as you build to keep your town balanced'
    showNextBtn = true
    nextBtnLabel = 'Next ›'
    onNext = () => {
      ui.setPanel(null)
      setTutorialStep(9)
    }
  }

  // --- Steps 11-14: Advisor, Map, Journal, Storehouse ---
  else if (PANEL_STEPS[tutorialStep]) {
    const cfg = PANEL_STEPS[tutorialStep]
    if (ui.panel !== cfg.panel) {
      targetSelector = `[data-tutorial="${cfg.rail}"]`
      title = cfg.railTitle
      text = cfg.railText
      hint = cfg.railHint
      // No continue button: player must click the icon
    } else {
      targetSelector = `[data-tutorial="${cfg.inner}"]`
      title = cfg.title
      text = cfg.text
      showNextBtn = true
      nextBtnLabel = cfg.nextLabel
      onNext = () => {
        ui.setPanel(null)
        setTutorialStep(cfg.next)
      }
    }
  }

  // --- Info-only steps: Level, Town stats, Settings ---
  else if (INFO_STEPS[tutorialStep]) {
    const cfg = INFO_STEPS[tutorialStep]
    targetSelector = `[data-tutorial="${cfg.target}"]`
    title = cfg.title
    text = cfg.text
    showNextBtn = true
    nextBtnLabel = cfg.label
    onNext = () => setTutorialStep(cfg.next)
  }

  // --- Final step: Tutorial Complete ---
  else if (tutorialStep === FINAL_STEP) {
    // Rendered as the final centered popup below.
  }

  // --- Automatic Step Advancement Detection ---
  useEffect(() => {
    if (!tutorialActive) return

    // Step 2: Auto-advance when wood is gathered from the popup
    if (tutorialStep === 2) {
      const snap = stepSnapshot.current
      if (state.resources.wood > snap.wood) {
        const timer = setTimeout(() => {
          if (ui.panel === 'island') ui.setPanel(null)
          setTutorialStep(3)
        }, 350)
        return () => clearTimeout(timer)
      }
    }

    // Step 3: Auto-advance when build menu opens
    if (tutorialStep === 3) {
      if (ui.panel === 'build') {
        const timer = setTimeout(() => {
          setTutorialStep(4)
        }, 150)
        return () => clearTimeout(timer)
      }
    }

    // Step 4: Auto-advance when shelter is selected for placing
    if (tutorialStep === 4) {
      if (ui.placing === 'shelter') {
        const timer = setTimeout(() => {
          setTutorialStep(5)
        }, 150)
        return () => clearTimeout(timer)
      }
    }

    // Step 5: Auto-advance when shelter building is placed
    if (tutorialStep === 5) {
      const snap = stepSnapshot.current
      const currentShelters = state.buildings.filter((b) => b.type === 'shelter').length
      if (currentShelters > (snap.shelters || 0) || (!ui.placing && currentShelters > 0 && snap.shelters === 0)) {
        const timer = setTimeout(() => {
          setTutorialStep(6)
        }, 350)
        return () => clearTimeout(timer)
      }
    }

    // Steps 12-15: if the player opened the panel and then closed it (X / Esc), move on
    const panelCfg = PANEL_STEPS[tutorialStep]
    if (panelCfg) {
      if (ui.panel === panelCfg.panel) {
        stepSnapshot.current.wasOpen = true
      } else if (stepSnapshot.current.wasOpen) {
        const timer = setTimeout(() => setTutorialStep(panelCfg.next), 150)
        return () => clearTimeout(timer)
      }
    }

    // Step 6b: If the quest panel was open (we were on 6b) and the user closes it via X
    // or any other means, advance to step 7. This catches the case where "Continue Quest"
    // navigates away from quests, or the user clicks the close button.
    if (tutorialStep === 6 && ui.panel !== 'quests') {
      if (stepSnapshot.current.wasInQuests) {
        const timer = setTimeout(() => {
          ui.setPanel(null)
          setTutorialStep(7)
        }, 150)
        return () => clearTimeout(timer)
      }
    }
    // Track that quests panel opened during step 6 (marks we entered 6b)
    if (tutorialStep === 6 && ui.panel === 'quests') {
      stepSnapshot.current.wasInQuests = true
    }

  }, [
    tutorialActive,
    tutorialStep,
    ui.panel,
    ui.selected,
    ui.placing,
    state.resources.wood,
    state.buildings,
    setTutorialStep,
  ])

  // --- Mark active target element with data-tutorial-active="true" ---
  useEffect(() => {
    if (!targetSelector) return
    let currentEl = null
    const syncActiveAttr = () => {
      const el = document.querySelector(targetSelector)
      if (el !== currentEl) {
        if (currentEl) currentEl.removeAttribute('data-tutorial-active')
        if (el) {
          el.setAttribute('data-tutorial-active', 'true')
          if (typeof el.scrollIntoView === 'function') {
            try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }) } catch (_) {}
          }
        }
        currentEl = el
      }
    }
    syncActiveAttr()
    const timer = setInterval(syncActiveAttr, 100)
    return () => {
      clearInterval(timer)
      if (currentEl) currentEl.removeAttribute('data-tutorial-active')
    }
  }, [targetSelector, tutorialStep, ui.panel, ui.selected, ui.placing])

  // --- Continuous Tracking of Target Element via requestAnimationFrame ---
  useLayoutEffect(() => {
    if (!tutorialActive || !targetSelector) {
      setTargetRect(null)
      return
    }

    let rafId = null
    const updateTarget = () => {
      const el = document.querySelector(targetSelector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect((prev) => {
          if (!prev) return rect
          // Avoid triggering re-renders if position hasn't meaningfully changed
          if (
            Math.abs(prev.left - rect.left) < 0.5 &&
            Math.abs(prev.top - rect.top) < 0.5 &&
            Math.abs(prev.width - rect.width) < 0.5 &&
            Math.abs(prev.height - rect.height) < 0.5
          ) {
            return prev
          }
          return rect
        })
      } else {
        setTargetRect(null)
      }
      rafId = requestAnimationFrame(updateTarget)
    }

    updateTarget()
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [tutorialActive, targetSelector, tutorialStep, ui.panel, ui.selected, ui.placing])

  // --- Track viewport size on resize ---
  useEffect(() => {
    const onResize = () => {
      setViewWidth(window.innerWidth)
      setViewHeight(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // --- Measure tooltip element size on render ---
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const r = tooltipRef.current.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        setTooltipSize((prev) => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }))
      }
    }
  })

  // Prevent interactions with rest of screen; shake tooltip on invalid click
  const handleBackdropClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 500)
  }

  if (!tutorialActive) return null

  // Render centered full-screen modal for Step 1 (Welcome)
  if (tutorialStep === 1) {
    return (
      <div className="tutorial-root" role="dialog" aria-label="Tutorial - Welcome">
        <div className="tutorial-modal-overlay tutorial-modal-wrap">
          <div className="tutorial-modal-card">
            <div className="tutorial-modal-crest"><ArtIcon name="cloud" size={44} /></div>
            <div className="tutorial-modal-kicker">✦ Welcome, Navigator ✦</div>
            <h2 className="tutorial-modal-title">Welcome to Cloudbreakers!</h2>
            <blockquote className="tutorial-modal-quote">
              “Welcome to the archipelago, Captain! I’m Cloud, your airborne advisor. Our islands drift in a vast sky, waiting to be explored, connected, and rebuilt. Let’s walk through the basics together!”
            </blockquote>
            <div className="tutorial-modal-actions">
              <button
                type="button"
                className="btn-gold"
                onClick={(e) => {
                  e.stopPropagation()
                  setTutorialStep(2)
                }}
                autoFocus
              >
                Let's Begin ➔
              </button>
              <button
                type="button"
                className="btn-gold"
                onClick={(e) => {
                  e.stopPropagation()
                  endTutorial(true)
                }}
              >
                Skip Tutorial
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render centered celebratory modal for Final Step
  if (tutorialStep === FINAL_STEP) {
    return (
      <div className="tutorial-root" role="dialog" aria-label="Tutorial - Complete">
        <div className="tutorial-modal-overlay tutorial-modal-wrap">
          <div className="tutorial-modal-card">
            <div className="tutorial-modal-crest"><ArtIcon name="cloud" size={44} /></div>
            <div className="tutorial-modal-kicker">✦ Certified Navigator ✦</div>
            <h2 className="tutorial-modal-title">Enjoy the Game!</h2>
            <blockquote className="tutorial-modal-quote">
              “You’re ready to explore the skies! Gather resources, build your village, complete quests, and discover new islands. Good luck, Captain!”
            </blockquote>
            <div className="tutorial-modal-actions">
              <button
                type="button"
                className="btn-gold"
                onClick={(e) => {
                  e.stopPropagation()
                  endTutorial(true)
                }}
                autoFocus
              >
                Start Playing ➔
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const pad = 6
  let hole = null
  if (targetRect) {
    const hx = Math.max(0, targetRect.left - pad)
    const hy = Math.max(0, targetRect.top - pad)
    const hw = Math.max(0, Math.min(viewWidth - hx, targetRect.width + pad * 2))
    const hh = Math.max(0, Math.min(viewHeight - hy, targetRect.height + pad * 2))
    hole = { left: hx, top: hy, width: hw, height: hh, right: hx + hw, bottom: hy + hh }
  }

  const margin = viewWidth < 600 ? 12 : 16
  const tooltipWidth = Math.min(340, viewWidth - margin * 2)
  const tooltipHeight = tooltipSize.h || 190
  const arrowDist = 14

  let placement = 'bottom'
  let tTop = (viewHeight - tooltipHeight) / 2
  let tLeft = (viewWidth - tooltipWidth) / 2
  let arrowOffset = 50

  if (targetRect) {
    const cx = targetRect.left + targetRect.width / 2
    const cy = targetRect.top + targetRect.height / 2
    const spots = {
      bottom: { top: targetRect.bottom + arrowDist, left: cx - tooltipWidth / 2 },
      top: { top: targetRect.top - tooltipHeight - arrowDist, left: cx - tooltipWidth / 2 },
      right: { top: cy - tooltipHeight / 2, left: targetRect.right + arrowDist },
      left: { top: cy - tooltipHeight / 2, left: targetRect.left - tooltipWidth - arrowDist },
    }
    const fits = (p) => {
      const s = spots[p]
      if (p === 'bottom' || p === 'top') return s.top >= margin && s.top + tooltipHeight <= viewHeight - margin
      return s.left >= margin && s.left + tooltipWidth <= viewWidth - margin
    }
    // On phones there is no room beside things, so only go above or below.
    let order = viewWidth < 640 ? ['bottom', 'top'] : ['bottom', 'top', 'right', 'left']
    if (tutorialStep === 7 || tutorialStep === 8) order = ['bottom']
    else if (tutorialStep === 2 && ui.panel === 'island') order = ['left', 'top', 'bottom']
    else if (viewWidth >= 640 && targetRect.left > viewWidth * 0.6) order = ['left', 'bottom', 'top', 'right']
    else if (viewWidth >= 640 && targetRect.right < viewWidth * 0.25) order = ['right', 'bottom', 'top', 'left']
    placement = order.find(fits)
    if (!placement) {
      // Nothing fits cleanly: use whichever side has the most room
      const room = { bottom: viewHeight - targetRect.bottom, top: targetRect.top, right: viewWidth - targetRect.right, left: targetRect.left }
      placement = order.reduce((best, p) => (room[p] > room[best] ? p : best), order[0])
    }
    tTop = spots[placement].top
    tLeft = spots[placement].left

    tLeft = Math.max(margin, Math.min(viewWidth - tooltipWidth - margin, tLeft))
    tTop = Math.max(margin, Math.min(viewHeight - tooltipHeight - margin, tTop))

    if (placement === 'bottom' || placement === 'top') {
      arrowOffset = Math.max(24, Math.min(tooltipWidth - 24, cx - tLeft))
    } else {
      arrowOffset = Math.max(24, Math.min(tooltipHeight - 24, cy - tTop))
    }
  } else {
    tLeft = Math.max(margin, tLeft)
    tTop = Math.max(margin, tTop)
  }

  const stepDisplayNumber = tutorialStep - 1

  return (
    <div className="tutorial-root" role="dialog" aria-label={`Tutorial Step ${stepDisplayNumber}`} aria-live="polite">
      {hole ? (
        <>
          <div className="tutorial-backdrop-panel" style={{ top: 0, left: 0, width: '100vw', height: `${hole.top}px` }} onClick={handleBackdropClick} />
          <div className="tutorial-backdrop-panel" style={{ top: `${hole.bottom}px`, left: 0, width: '100vw', bottom: 0 }} onClick={handleBackdropClick} />
          <div className="tutorial-backdrop-panel" style={{ top: `${hole.top}px`, left: 0, width: `${hole.left}px`, height: `${hole.height}px` }} onClick={handleBackdropClick} />
          <div className="tutorial-backdrop-panel" style={{ top: `${hole.top}px`, left: `${hole.right}px`, right: 0, height: `${hole.height}px` }} onClick={handleBackdropClick} />
          <div className="tutorial-spotlight-box" style={{ top: `${hole.top}px`, left: `${hole.left}px`, width: `${hole.width}px`, height: `${hole.height}px` }} />
        </>
      ) : (
        <div className="tutorial-backdrop-panel" style={{ top: 0, left: 0, width: '100vw', height: '100vh' }} onClick={handleBackdropClick} />
      )}

      <aside ref={tooltipRef} className={`tutorial-tooltip${isShaking ? ' shake' : ''}`} style={{ top: `${tTop}px`, left: `${tLeft}px`, width: `${tooltipWidth}px` }}>
        {targetRect && (
          <div className={`tutorial-arrow tutorial-arrow-${placement}`} style={{
            [placement === 'bottom' || placement === 'top' ? 'left' : 'top']: `${arrowOffset}px`,
          }} />
        )}
        <header className="tutorial-head">
          <span className="tutorial-step-tag"><span>✦</span> Step {stepDisplayNumber} of {TOTAL_STEPS}</span>
          <button className="tutorial-skip-btn" onClick={() => endTutorial(true)} title="Skip the tutorial">Skip Tutorial</button>
        </header>
        <h3 className="tutorial-title">{title}</h3>
        <p className="tutorial-text">{text}</p>
        {hint && (
          <div className="tutorial-hint">
            <span className="tutorial-hint-pulse">👉</span>
            <span>{hint}</span>
          </div>
        )}
        {showNextBtn && onNext && (
          <footer className="tutorial-footer">
            <button className="tutorial-btn-primary" onClick={onNext}>{nextBtnLabel}</button>
          </footer>
        )}
      </aside>
    </div>
  )
}
