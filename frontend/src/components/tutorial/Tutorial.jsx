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

  // Determine current active target selector and copy based on tutorialStep & current UI state
  let targetSelector = null
  let title = ''
  let text = ''
  let hint = ''
  let showNextBtn = false
  let nextBtnLabel = 'Next ›'
  let onNext = null

  // Record snapshots when step changes
  useEffect(() => {
    stepSnapshot.current = {
      wood: state.resources.wood,
      actionsLeft: state.actionsLeft,
      turn: state.turn,
      shelters: state.buildings.filter((b) => b.type === 'shelter').length,
    }
  }, [tutorialStep])

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
      showNextBtn = true
      nextBtnLabel = 'Skip step ›'
      onNext = () => setTutorialStep(3)
    } else {
      targetSelector = '[data-tutorial="gather-wood-btn"]'
      title = 'Gather Wood'
      text = 'Click Gather wood to collect materials for building structures!'
      hint = 'Click the Gather wood button'
      showNextBtn = true
      nextBtnLabel = 'Continue ›'
      onNext = () => setTutorialStep(3)
    }
  }

  // --- Step 3: Open the Build Menu ---
  else if (tutorialStep === 3) {
    targetSelector = '[data-tutorial="rail-build"]'
    title = 'Town Workshop'
    text = 'Buildings help your village grow and survive. Click Build to open the Town Workshop!'
    hint = 'Click the Build button in the left rail'
    showNextBtn = true
    nextBtnLabel = 'Continue ›'
    onNext = () => {
      ui.setPanel('build')
      setTutorialStep(4)
    }
  }

  // --- Step 4: Select a Shelter ---
  else if (tutorialStep === 4) {
    targetSelector = '[data-tutorial="build-btn-shelter"]'
    title = 'Choose a Building'
    text = 'A Shelter gives your villagers a place to live. Click the + button to select it!'
    hint = 'Click the gold + button on the Shelter card'
    showNextBtn = true
    nextBtnLabel = 'Continue ›'
    onNext = () => {
      ui.setPlacing('shelter')
      ui.setPanel(null)
      setTutorialStep(5)
    }
  }

  // --- Step 5: Place the Shelter ---
  else if (tutorialStep === 5) {
    if (ui.placing === 'shelter') {
      targetSelector = '[data-tutorial="plot-newHaven"]'
      title = 'Place the Shelter'
      text = 'Now click a glowing plot on New Haven to place your Shelter!'
      hint = 'Click a glowing diamond building plot on the island'
      showNextBtn = true
      nextBtnLabel = 'Continue ›'
      onNext = () => setTutorialStep(6)
    } else {
      targetSelector = '[data-tutorial="rail-build"]'
      title = 'Select Shelter'
      text = 'Shelter placement was cancelled. Click Build to open Town Workshop, or click Continue to proceed.'
      hint = 'Click Build to select Shelter again'
      showNextBtn = true
      nextBtnLabel = 'Continue ›'
      onNext = () => setTutorialStep(6)
    }
  }

  // --- Step 6: Explore the Quest Book ---
  else if (tutorialStep === 6) {
    if (ui.panel !== 'quests') {
      targetSelector = '[data-tutorial="rail-quests"]'
      title = 'Explore Missions'
      text = 'Quests give you goals to work toward and rewards for completing them. Click Quest Book to see your missions!'
      hint = 'Click the Quest Book button in the left rail'
      showNextBtn = true
      nextBtnLabel = 'Continue ›'
      onNext = () => {
        ui.setPanel('quests')
      }
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
      targetSelector = '[data-tutorial="topbar-resources"]'
      title = 'Resource Management'
      text = 'Your villagers need food and water to survive. Keep an eye on your resources and build structures to produce more! Click the top bar or Storage to open the Storehouse.'
      hint = 'Click the top resource bar or the Storage button'
      showNextBtn = true
      nextBtnLabel = 'Continue ›'
      onNext = () => {
        ui.setPanel('storage')
      }
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
      showNextBtn = true
      nextBtnLabel = 'Skip step ›'
      onNext = () => setTutorialStep(10)
    } else {
      targetSelector = '[data-tutorial="report-continue-btn"]'
      title = 'Turn Summary'
      text = 'Here is your turn report showing resources gained, consumption, and town morale. Click Begin turn to continue!'
      hint = 'Click Begin turn to dismiss the report'
    }
  }

  // --- Automatic Step Advancement Detection ---
  useEffect(() => {
    if (!tutorialActive) return

    // Step 2: Auto-advance if wood was gathered or actions used while in island panel
    if (tutorialStep === 2) {
      const isNewHavenDrawer = ui.panel === 'island' && ui.selected === 'newHaven'
      if (isNewHavenDrawer) {
        const snap = stepSnapshot.current
        if (state.resources.wood > snap.wood || state.actionsLeft < snap.actionsLeft) {
          const timer = setTimeout(() => {
            setTutorialStep(3)
          }, 400)
          return () => clearTimeout(timer)
        }
      }
    }

    // Step 3: Auto-advance when build menu opens
    if (tutorialStep === 3) {
      if (ui.panel === 'build') {
        const timer = setTimeout(() => {
          setTutorialStep(4)
        }, 200)
        return () => clearTimeout(timer)
      }
    }

    // Step 4: Auto-advance when shelter is selected for placing
    if (tutorialStep === 4) {
      if (ui.placing === 'shelter') {
        const timer = setTimeout(() => {
          setTutorialStep(5)
        }, 200)
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
        }, 400)
        return () => clearTimeout(timer)
      }
    }

    // Step 6: When in 6a and quest panel opens, re-render happens naturally

    // Step 7: When in 7a and storage modal opens, re-render happens naturally

    // Step 9: When in 9 and turn report closes after advancing turn
    if (tutorialStep === 9) {
      const snap = stepSnapshot.current
      if (state.turn > snap.turn && !state.showReport) {
        const timer = setTimeout(() => {
          setTutorialStep(10)
        }, 300)
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

  // --- Dynamic Measurement of Target Element ---
  useLayoutEffect(() => {
    if (!tutorialActive) return

    const updateDimensions = () => {
      setViewWidth(window.innerWidth)
      setViewHeight(window.innerHeight)
    }

    const measureTarget = () => {
      if (!targetSelector) {
        setTargetRect(null)
        return
      }
      const el = document.querySelector(targetSelector)
      if (!el) {
        setTargetRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) {
        setTargetRect(null)
        return
      }
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
      })
    }

    measureTarget()
    updateDimensions()

    // Multiple timers to measure after layout/CSS transitions (such as drawer/modal rise)
    const t1 = setTimeout(measureTarget, 60)
    const t2 = setTimeout(measureTarget, 160)
    const t3 = setTimeout(measureTarget, 320)

    window.addEventListener('resize', updateDimensions)
    window.addEventListener('resize', measureTarget)
    window.addEventListener('scroll', measureTarget, true)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.removeEventListener('resize', updateDimensions)
      window.removeEventListener('resize', measureTarget)
      window.removeEventListener('scroll', measureTarget, true)
    }
  }, [tutorialActive, tutorialStep, targetSelector, ui.panel, ui.selected, ui.placing, state.showReport])

  // Periodic safety check to ensure targetRect stays locked onto target even if animating
  useEffect(() => {
    if (!tutorialActive || !targetSelector) return
    let animId
    const check = () => {
      const el = document.querySelector(targetSelector)
      if (el) {
        const r = el.getBoundingClientRect()
        setTargetRect((prev) => {
          if (
            !prev ||
            Math.abs(prev.top - r.top) > 1 ||
            Math.abs(prev.left - r.left) > 1 ||
            Math.abs(prev.width - r.width) > 1 ||
            Math.abs(prev.height - r.height) > 1
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
    const interval = setInterval(check, 100)
    return () => {
      clearInterval(interval)
      cancelAnimationFrame(animId)
    }
  }, [tutorialActive, targetSelector])

  if (!tutorialActive) return null

  // Handle clicking on the dimmed backdrop (blocks unrelated interactions and provides feedback)
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
        <svg className="tutorial-svg-overlay" preserveAspectRatio="none">
          <path
            d={`M 0 0 H ${viewWidth} V ${viewHeight} H 0 Z`}
            className="tutorial-backdrop-path"
            pointerEvents="auto"
            onClick={handleBackdropClick}
          />
        </svg>
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
        <svg className="tutorial-svg-overlay" preserveAspectRatio="none">
          <path
            d={`M 0 0 H ${viewWidth} V ${viewHeight} H 0 Z`}
            className="tutorial-backdrop-path"
            pointerEvents="auto"
            onClick={handleBackdropClick}
          />
        </svg>
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

  // --- Steps 2–9: Interactive Guided Steps with Spotlight & Tooltip ---
  const pad = 6
  let spotlightBox = null
  let pathD = `M 0 0 H ${viewWidth} V ${viewHeight} H 0 Z`

  if (targetRect) {
    const bx = Math.max(0, targetRect.left - pad)
    const by = Math.max(0, targetRect.top - pad)
    const bw = Math.min(viewWidth - bx, targetRect.width + pad * 2)
    const bh = Math.min(viewHeight - by, targetRect.height + pad * 2)
    const r = Math.min(14, bw / 2, bh / 2)

    spotlightBox = { x: bx, y: by, w: bw, h: bh, r }

    // SVG compound path with cutout hole: outer screen rectangle + inner cutout
    pathD = `M 0 0 H ${viewWidth} V ${viewHeight} H 0 Z M ${bx + r} ${by} H ${bx + bw - r} A ${r} ${r} 0 0 1 ${bx + bw} ${by + r} V ${by + bh - r} A ${r} ${r} 0 0 1 ${bx + bw - r} ${by + bh} H ${bx + r} A ${r} ${r} 0 0 1 ${bx} ${by + bh - r} V ${by + r} A ${r} ${r} 0 0 1 ${bx + r} ${by} Z`
  }

  // Calculate smart tooltip coordinates and directional arrow placement
  const tooltipWidth = Math.min(340, viewWidth - 32)
  const tooltipHeight = 175 // Estimated height for clamping
  const margin = 16
  const arrowDist = 12

  let placement = 'bottom'
  let tTop = (viewHeight - tooltipHeight) / 2
  let tLeft = (viewWidth - tooltipWidth) / 2
  let arrowOffset = 50

  if (targetRect) {
    // Left rail items: place tooltip to the right
    if (targetRect.right < 220 && targetRect.top > 80 && targetRect.bottom < viewHeight - 60) {
      placement = 'right'
      tLeft = targetRect.right + arrowDist
      tTop = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
    }
    // Far-right items (like weather card): place tooltip to the left
    else if (targetRect.left > viewWidth - 280) {
      placement = 'left'
      tLeft = targetRect.left - tooltipWidth - arrowDist
      tTop = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
    }
    // Bottom items (like End Turn or bottom nav): place tooltip above
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

    // Calculate arrow alignment to point at target center
    if (placement === 'bottom' || placement === 'top') {
      const targetCenter = targetRect.left + targetRect.width / 2
      arrowOffset = Math.max(22, Math.min(tooltipWidth - 22, targetCenter - tLeft))
    } else {
      const targetCenter = targetRect.top + targetRect.height / 2
      arrowOffset = Math.max(22, Math.min(tooltipHeight - 22, targetCenter - tTop))
    }
  }

  const stepDisplayNumber = tutorialStep - 1 // Steps 2 to 9 map to 1 to 8

  return (
    <div className="tutorial-root" role="dialog" aria-label={`Tutorial Step ${stepDisplayNumber}`} aria-live="polite">
      {/* Darkened overlay with interactive pass-through cutout hole */}
      <svg className="tutorial-svg-overlay" preserveAspectRatio="none">
        <path
          d={pathD}
          fillRule="evenodd"
          className="tutorial-backdrop-path"
          pointerEvents="auto"
          onClick={handleBackdropClick}
        />
        {spotlightBox && (
          <rect
            x={spotlightBox.x}
            y={spotlightBox.y}
            width={spotlightBox.w}
            height={spotlightBox.h}
            rx={spotlightBox.r}
            ry={spotlightBox.r}
            className="tutorial-spotlight-ring"
          />
        )}
      </svg>

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
