import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ArtIcon, CloudIcon } from '../icons.jsx'
import './Tutorial.css'

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
  const [viewWidth, setViewWidth] = useState(window.innerWidth)
  const [viewHeight, setViewHeight] = useState(window.innerHeight)

  // Track initial values on step entry to detect player actions
  const stepSnapshot = useRef({})

  // Record snapshots when step changes
  useEffect(() => {
    stepSnapshot.current = {
      wood: state.resources.wood,
      actionsLeft: state.actionsLeft,
      turn: state.turn,
      shelters: state.buildings.filter((b) => b.type === 'shelter').length,
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

  // --- Step 2: Gather Resources ---
  else if (tutorialStep === 2) {
    const isNewHavenDrawer = ui.panel === 'island' && ui.selected === 'newHaven'
    if (!isNewHavenDrawer) {
      targetSelector = '[data-tutorial="island-newHaven"]'
      title = 'Gather Resources'
      text = "Let's start by gathering some resources! Click New Haven to see what you can collect."
      hint = 'Click the New Haven island on the map'
      // No continue button: player must click New Haven
    } else {
      targetSelector = '[data-tutorial="gather-wood-btn"]'
      title = 'Gather Wood'
      text = 'Click Gather wood to collect materials for building structures!'
      hint = 'Click the Gather wood button'
      // No continue button: player must click Gather wood
    }
  }

  // --- Step 3: Open the Build Menu ---
  else if (tutorialStep === 3) {
    targetSelector = '[data-tutorial="rail-build"]'
    title = 'Town Workshop'
    text = 'Buildings help your village grow and survive. Click Build to open the Town Workshop!'
    hint = 'Click the Build button in the left rail'
    // No continue button: player must click Build
  }

  // --- Step 4: Select a Shelter ---
  else if (tutorialStep === 4) {
    targetSelector = '[data-tutorial="build-btn-shelter"]'
    title = 'Choose a Building'
    text = 'A Shelter gives your villagers a place to live. Click the + button to select it!'
    hint = 'Click the gold + button on the Shelter card'
    // No continue button: player must click the Shelter + button
  }

  // --- Step 5: Place the Shelter ---
  else if (tutorialStep === 5) {
    if (ui.placing === 'shelter') {
      targetSelector = '[data-tutorial="plot-newHaven"]'
      title = 'Place the Shelter'
      text = 'Now click a glowing plot on New Haven to place your Shelter!'
      hint = 'Click a glowing diamond building plot on the island'
      // No continue button: player must click a plot
    } else {
      targetSelector = '[data-tutorial="rail-build"]'
      title = 'Select Shelter'
      text = 'Shelter placement was cancelled. Click Build to open Town Workshop and select Shelter again!'
      hint = 'Click Build to select Shelter'
    }
  }

  // --- Step 6: Explore the Quest Book ---
  else if (tutorialStep === 6) {
    if (ui.panel !== 'quests') {
      targetSelector = '[data-tutorial="rail-quests"]'
      title = 'Explore Missions'
      text = 'Quests give you goals to work toward and rewards for completing them. Click Quest Book to see your missions!'
      hint = 'Click the Quest Book button in the left rail'
      // No continue button: player must click Quest Book
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
    if (ui.panel !== 'storage') {
      targetSelector = '[data-tutorial="nav-storage"]'
      title = 'Resource Management'
      text = 'Your villagers need food and water to survive. Keep an eye on your resources and build structures to produce more! Click Storage to open the Storehouse.'
      hint = 'Click the Storage button in the bottom bar'
      // No continue button: player must click Storage
    } else {
      targetSelector = '[data-tutorial="storage-table"]'
      title = 'The Storehouse'
      text = 'The Storehouse shows your current stocks, consumption per turn, and net production. Keep stocks positive so your villagers don’t face shortages!'
      showNextBtn = true
      nextBtnLabel = 'Got it ›'
      onNext = () => {
        ui.setPanel(null)
        setTutorialStep(8)
      }
    }
  }

  // --- Step 8: Learn About Weather ---
  else if (tutorialStep === 8) {
    targetSelector = '[data-tutorial="hud-weather"]'
    title = 'Weather Forecast'
    text = 'Weather changes each turn and can affect your village. Watch the forecast and prepare for storms!'
    showNextBtn = true
    nextBtnLabel = 'Next ›'
    onNext = () => setTutorialStep(9)
  }

  // --- Step 9: End Your Turn ---
  else if (tutorialStep === 9) {
    if (!state.showReport) {
      targetSelector = '[data-tutorial="end-turn-btn"]'
      title = 'End Your Turn'
      text = 'You have a limited number of actions each turn. When you’re ready, click End Turn to advance time and collect resources!'
      hint = 'Click the End Turn button'
      // No continue button: player must click End Turn
    } else {
      targetSelector = '[data-tutorial="report-continue-btn"]'
      title = 'Turn Summary'
      text = 'Here is your turn report showing resources gained, consumption, and town morale. Click Begin turn to continue!'
      hint = 'Click Begin turn to dismiss the report'
      // No continue button: player must click Begin turn
    }
  }

  // --- Automatic Step Advancement Detection ---
  useEffect(() => {
    if (!tutorialActive) return

    // Step 2: Auto-advance when wood is gathered
    if (tutorialStep === 2) {
      const isNewHavenDrawer = ui.panel === 'island' && ui.selected === 'newHaven'
      if (isNewHavenDrawer) {
        const snap = stepSnapshot.current
        if (state.resources.wood > snap.wood || state.actionsLeft < snap.actionsLeft) {
          const timer = setTimeout(() => {
            setTutorialStep(3)
          }, 350)
          return () => clearTimeout(timer)
        }
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

    // Step 9: When in 9 and turn report closes after advancing turn
    if (tutorialStep === 9) {
      const snap = stepSnapshot.current
      if (state.turn > snap.turn && !state.showReport) {
        const timer = setTimeout(() => {
          setTutorialStep(10)
        }, 250)
        return () => clearTimeout(timer)
      }
    }
  }, [
    tutorialActive,
    tutorialStep,
    ui.panel,
    ui.selected,
    ui.placing,
    state.resources.wood,
    state.actionsLeft,
    state.buildings,
    state.turn,
    state.showReport,
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
        if (el) el.setAttribute('data-tutorial-active', 'true')
        currentEl = el
      }
    }
    syncActiveAttr()
    const timer = setInterval(syncActiveAttr, 100)
    return () => {
      clearInterval(timer)
      if (currentEl) currentEl.removeAttribute('data-tutorial-active')
    }
  }, [targetSelector, tutorialStep, ui.panel, ui.selected, ui.placing, state.showReport])

  // --- Continuous Tracking of Target Element via requestAnimationFrame ---
  useLayoutEffect(() => {
    if (!tutorialActive || !targetSelector) {
      setTargetRect(null)
      return
    }

    let rafId
    const update = () => {
      setViewWidth(window.innerWidth)
      setViewHeight(window.innerHeight)

      const el = document.querySelector(targetSelector)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) {
          setTargetRect((prev) => {
            if (
              !prev ||
              Math.abs(prev.top - r.top) > 0.5 ||
              Math.abs(prev.left - r.left) > 0.5 ||
              Math.abs(prev.width - r.width) > 0.5 ||
              Math.abs(prev.height - r.height) > 0.5
            ) {
              return {
                top: r.top,
                left: r.left,
                width: r.width,
                height: r.height,
                right: r.right,
                bottom: r.bottom,
              }
            }
            return prev
          })
        }
      }
      rafId = requestAnimationFrame(update)
    }

    rafId = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [tutorialActive, targetSelector, tutorialStep, ui.panel, ui.selected, ui.placing, state.showReport])

  if (!tutorialActive) return null

  // Handle clicking on the dimmed backdrop
  const handleBackdropClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 450)
  }

  // --- Step 1: Welcome to Cloudbreakers Modal ---
  if (tutorialStep === 1) {
    return (
      <div className="tutorial-root" role="dialog" aria-label="Tutorial - Welcome" aria-live="polite">
        <div
          className="tutorial-backdrop-panel"
          style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}
          onClick={handleBackdropClick}
        />
        <div className="tutorial-modal-wrap">
          <div className="tutorial-modal-card">
            <div className="tutorial-modal-crest">
              <CloudIcon size={46} />
            </div>
            <div className="tutorial-modal-kicker">✦ Flight School ✦</div>
            <h2 className="tutorial-modal-title">Welcome to Cloudbreakers!</h2>
            <blockquote className="tutorial-modal-quote">
              “Welcome to Cloudbreakers! Your village floats high above the clouds. Your goal is to gather resources, build your town, and keep your villagers happy and healthy.”
            </blockquote>
            <div className="tutorial-modal-actions">
              <button
                className="btn-gold"
                onClick={() => setTutorialStep(2)}
                autoFocus
              >
                Let's Begin ➔
              </button>
              <button
                className="btn-ghost"
                onClick={() => endTutorial(true)}
              >
                Skip Tutorial
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Step 10: Tutorial Complete Modal ---
  if (tutorialStep === 10) {
    return (
      <div className="tutorial-root" role="dialog" aria-label="Tutorial - Complete" aria-live="polite">
        <div
          className="tutorial-backdrop-panel"
          style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}
          onClick={handleBackdropClick}
        />
        <div className="tutorial-modal-wrap">
          <div className="tutorial-modal-card">
            <div className="tutorial-modal-crest">
              <ArtIcon name="cloud" size={44} />
            </div>
            <div className="tutorial-modal-kicker">✦ Certified Navigator ✦</div>
            <h2 className="tutorial-modal-title">Tutorial Complete!</h2>
            <blockquote className="tutorial-modal-quote">
              “You're ready to explore the skies! Build your village, complete quests, and discover new islands. Good luck, Captain!”
            </blockquote>
            <div className="tutorial-modal-actions">
              <button
                className="btn-gold"
                onClick={() => endTutorial(true)}
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

  // --- Steps 2–9: Cutout Hole Calculation ---
  const pad = 6
  let hole = null
  if (targetRect) {
    const hx = Math.max(0, targetRect.left - pad)
    const hy = Math.max(0, targetRect.top - pad)
    const hw = Math.min(viewWidth - hx, targetRect.width + pad * 2)
    const hh = Math.min(viewHeight - hy, targetRect.height + pad * 2)
    hole = {
      left: hx,
      top: hy,
      width: hw,
      height: hh,
      right: hx + hw,
      bottom: hy + hh,
    }
  }

  // Calculate smart tooltip coordinates and directional arrow placement
  const tooltipWidth = Math.min(340, viewWidth - 32)
  const tooltipHeight = 155 // Reference estimated height
  const margin = 16
  const arrowDist = 14

  let placement = 'bottom'
  let tTop = (viewHeight - tooltipHeight) / 2
  let tLeft = (viewWidth - tooltipWidth) / 2
  let arrowOffset = 50

  if (targetRect) {
    // Left rail items: place tooltip to the right
    if (targetRect.left < 200 && targetRect.top > 80 && targetRect.bottom < viewHeight - 120) {
      placement = 'right'
      tLeft = targetRect.right + arrowDist
      tTop = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
    }
    // Items on the right side of the screen (IslandPanel or WeatherCard): place tooltip to the left
    else if (targetRect.left > viewWidth - 380) {
      placement = 'left'
      tLeft = targetRect.left - tooltipWidth - arrowDist
      tTop = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
    }
    // Items near the bottom (End Turn, BottomNav, Shelter card + button): place tooltip above
    else if (targetRect.bottom + tooltipHeight + margin > viewHeight) {
      placement = 'top'
      tTop = targetRect.top - tooltipHeight - arrowDist
      tLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
    }
    // Default: place below
    else {
      placement = 'bottom'
      tTop = targetRect.bottom + arrowDist
      tLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
    }

    // Clamp within viewport
    tLeft = Math.max(margin, Math.min(viewWidth - tooltipWidth - margin, tLeft))
    tTop = Math.max(margin, Math.min(viewHeight - tooltipHeight - margin, tTop))

    // Calculate arrow alignment to point directly at target center
    if (placement === 'bottom' || placement === 'top') {
      const targetCenter = targetRect.left + targetRect.width / 2
      arrowOffset = Math.max(24, Math.min(tooltipWidth - 24, targetCenter - tLeft))
    } else {
      const targetCenter = targetRect.top + targetRect.height / 2
      arrowOffset = Math.max(24, Math.min(tooltipHeight - 24, targetCenter - tTop))
    }
  }

  const stepDisplayNumber = tutorialStep - 1 // Steps 2 to 9 map to 1 to 8

  return (
    <div className="tutorial-root" role="dialog" aria-label={`Tutorial Step ${stepDisplayNumber}`} aria-live="polite">
      {/* 4-Panel Cutout Backdrop: Leaves the target element 100% unobstructed and clickable */}
      {hole ? (
        <>
          {/* Top Panel */}
          <div
            className="tutorial-backdrop-panel"
            style={{ top: 0, left: 0, width: '100vw', height: `${hole.top}px` }}
            onClick={handleBackdropClick}
          />
          {/* Bottom Panel */}
          <div
            className="tutorial-backdrop-panel"
            style={{ top: `${hole.bottom}px`, left: 0, width: '100vw', bottom: 0 }}
            onClick={handleBackdropClick}
          />
          {/* Left Panel */}
          <div
            className="tutorial-backdrop-panel"
            style={{ top: `${hole.top}px`, left: 0, width: `${hole.left}px`, height: `${hole.height}px` }}
            onClick={handleBackdropClick}
          />
          {/* Right Panel */}
          <div
            className="tutorial-backdrop-panel"
            style={{ top: `${hole.top}px`, left: `${hole.right}px`, right: 0, height: `${hole.height}px` }}
            onClick={handleBackdropClick}
          />
          {/* Glowing spotlight box framing the active target */}
          <div
            className="tutorial-spotlight-box"
            style={{
              top: `${hole.top}px`,
              left: `${hole.left}px`,
              width: `${hole.width}px`,
              height: `${hole.height}px`,
            }}
          />
        </>
      ) : (
        <div
          className="tutorial-backdrop-panel"
          style={{ top: 0, left: 0, width: '100vw', height: '100vh' }}
          onClick={handleBackdropClick}
        />
      )}

      {/* Instruction box */}
      <aside
        className={`tutorial-tooltip${isShaking ? ' shake' : ''}`}
        style={{
          top: `${tTop}px`,
          left: `${tLeft}px`,
        }}
      >
        {targetRect && (
          <div
            className={`tutorial-arrow tutorial-arrow-${placement}`}
            style={{
              [placement === 'bottom' || placement === 'top' ? 'left' : 'top']: `${arrowOffset}px`,
            }}
          />
        )}

        <header className="tutorial-head">
          <span className="tutorial-step-tag">
            <span>✦</span> Step {stepDisplayNumber} of 8
          </span>
          <button
            className="tutorial-skip-btn"
            onClick={() => endTutorial(true)}
            title="Skip the tutorial"
          >
            Skip Tutorial
          </button>
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
            <button
              className="tutorial-btn-primary"
              onClick={onNext}
            >
              {nextBtnLabel}
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}
