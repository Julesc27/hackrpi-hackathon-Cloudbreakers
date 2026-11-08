import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame, useUI } from '../../game/GameContext.jsx'
import { ArtIcon, CloudIcon } from '../icons.jsx'
import { WORLD } from '../map/Camera.jsx'
import './Tutorial.css'
import useDialogAccessibility from '../useDialogAccessibility.js'

// Info-only steps: spotlight an element, explain it, press Next.
const INFO_STEPS = {
  12: {
    target: 'hud-resources',
    title: 'Resource Management',
    text: 'These boxes show your wood, water, food, energy, stone, and Cloud Coins. Keep food and water stocked so your villagers can survive!',
    label: 'Continue ›',
    next: 13,
  },
  13: {
    target: 'hud-resource-delta',
    title: 'Resource Flow & Actions',
    text: 'Notice the small numbers next to the resources and happiness (like +1, -1, or ±0). Every time you complete an action, you may gain or lose this amount on the next action! Green (+) means production or a happiness gain, red (−) means upkeep or a penalty.',
    hint: 'Watch these numbers as you build to keep your town balanced',
    label: 'Next ›',
    next: 14,
  },
  17: {
    target: 'hud-level',
    title: 'Level & XP',
    text: 'Complete tasks to earn XP. Level up to unlock new buildings and stronger bridges — you can now level up all the way to Level 20!',
    label: 'Next ›',
    next: 18,
  },
  18: {
    target: 'hud-town',
    title: 'Population & Sustainability',
    text: 'Population shows villagers versus available housing — build Shelters to house more. Sustainability drops when you harvest forests, so keep it healthy!',
    label: 'Next ›',
    next: 19,
  },
  22: {
    target: 'settings-btn',
    title: 'Settings',
    text: 'Log in to save your town to your account, or replay this tutorial any time from Settings → How to Play.',
    label: 'Finish ›',
    next: 23,
  },
}

// Steps that teach an icon + the panel it opens. Each one:
//   1) points at the icon until the player opens the panel
//   2) highlights something inside the panel with a "Got it" / "Next" button
// Closing the panel with X / Esc also advances (see auto-advance effect below).
const PANEL_STEPS = {
  4: {
    panel: 'backpack',
    rail: 'rail-backpack',
    inner: 'backpack-summary',
    railTitle: 'Your Backpack',
    railText: 'The timber you gathered went into your backpack! Click Backpack on the left rail to view your carried supplies.',
    railHint: 'Click the Backpack button in the left rail',
    title: 'Backpack & Carrying Capacity',
    text: 'Your backpack holds gathered building materials like wood and stone. When you build or repair structures, supplies are used from your backpack first, then Town Storage.',
    nextLabel: 'Next ›',
    next: 5,
    keepOpenOnNext: true,
  },
  11: {
    panel: 'quests',
    rail: 'rail-quests',
    inner: 'quest-featured',
    railTitle: 'Explore Missions',
    railText: 'Quests give you goals to work toward and rewards for completing them. Click Quest Book to see your missions!',
    railHint: 'Click the Quest Book button in the left rail',
    title: "Captain's Log",
    text: 'Here in the Captain’s Log, you can see your active objectives, track your progress, and earn rewards like XP and Cloud Coins!',
    nextLabel: 'Got it ›',
    next: 12,
  },
  14: {
    panel: 'weather',
    rail: 'weather-watch',
    inner: 'weather-summary',
    railTitle: 'Weather Watch',
    railText: 'Weather in the skyway shifts over time and can threaten unprotected homes! Click the Weather icon at the top to check the forecast.',
    railHint: 'Click the Weather icon at the top of the screen',
    title: 'Weather Readiness',
    text: 'This screen shows incoming weather events and your shelter readiness. Upgrade shelters to withstand harsh rain, droughts, and solar storms! Weather advances as you complete jobs.',
    nextLabel: 'Got it ›',
    next: 15,
  },
  15: {
    panel: 'captain',
    rail: 'rail-captain',
    inner: 'captain-preview',
    railTitle: 'Your Captain',
    railText: "Customize your Captain's appearance anytime! Click the Captain portrait on the left rail to open the Captain's wardrobe.",
    railHint: 'Click the Captain portrait on the left rail',
    title: "Captain's Wardrobe",
    text: 'Pick your hairstyle, facial hair, skin tone, eye colour, hats, and outfits. Your custom Captain appears across all islands and is saved to your account.',
    nextLabel: 'Got it ›',
    next: 16,
  },
  16: {
    panel: 'store',
    rail: 'rail-store',
    inner: 'store-items',
    railTitle: 'The Skyway Store',
    railText: 'Looking for insight or blessings? Click the Store button on the left rail to consult the sky gods!',
    railHint: 'Click the Store button on the left rail',
    title: 'Consult the Gods',
    text: 'Exchange Cloud Coins and energy here to consult the sky gods for prophecies, poems, and hints about your next journey.',
    nextLabel: 'Got it ›',
    next: 17,
  },
  19: {
    panel: 'advisor',
    rail: 'rail-advisor',
    inner: 'advisor-card',
    railTitle: "Cloud's Notes",
    railText: 'Need an idea? Your advisor Cloud can suggest what to do next. Click Cloud to hear a suggestion!',
    railHint: 'Click the Cloud button in the left rail',
    title: 'Advisor Suggestions',
    text: 'Cloud recommends your next move, explains why, and warns you about trade-offs. Tap Ask again for a different idea.',
    nextLabel: 'Got it ›',
    next: 20,
  },
  20: {
    panel: 'map',
    rail: 'nav-map',
    inner: 'chart-first-card',
    railTitle: 'The Skyway Chart',
    railText: 'New islands are waiting beyond the clouds. Click Map to open the Skyway Chart!',
    railHint: 'Click the Map button in the bottom bar',
    title: 'Discover Islands',
    text: 'Each island produces different resources. Connect them with bridges to grow your economy — costs and yields are shown here.',
    nextLabel: 'Got it ›',
    next: 21,
  },
  21: {
    panel: 'journal',
    rail: 'nav-journal',
    inner: 'journal-first',
    railTitle: 'Journal',
    railText: 'Your story is recorded as you play. Click Journal to read it!',
    railHint: 'Click the Journal button in the bottom bar',
    title: 'Your Journal',
    text: 'Discoveries, completed missions, and events are logged here so you can look back on your village’s journey.',
    nextLabel: 'Got it ›',
    next: 22,
  },
}
const FINAL_STEP = 23
const TOTAL_STEPS = FINAL_STEP - 2 // steps 2..22 are numbered 1..21 of 21 (welcome + finish are modals)

export default function Tutorial() {
  const { state, player } = useGame()
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
  const dialogRef = useRef(null)
  useDialogAccessibility(dialogRef, { enabled: tutorialActive && (tutorialStep === 1 || tutorialStep === FINAL_STEP), onClose: () => endTutorial(true) })
  const [tooltipSize, setTooltipSize] = useState({ w: 340, h: 190 })
  const [viewWidth, setViewWidth] = useState(window.innerWidth)
  const [viewHeight, setViewHeight] = useState(window.innerHeight)

  // Track initial values on step entry to detect player actions
  const stepSnapshot = useRef({})

  // Record snapshots when step changes
  useEffect(() => {
    stepSnapshot.current = {
      wood: state.resources.wood + (state.backpack?.wood || 0),
      shelters: state.buildings.filter((b) => b.type === 'shelter').length,
      wasOpen: false,
    }
    if (tutorialStep === 2) {
      ui.camera.current?.home(400)
    } else if (tutorialStep === 3 || tutorialStep === 6 || tutorialStep === 10) {
      const a = player.current?.avatar
      const cam = ui.camera.current
      if (a && cam) {
        const s = Math.max(1.15, cam.view()?.s || 1)
        cam.flyTo(a.x, a.y, s, { duration: 350 })
      }
    }
  }, [tutorialStep]) // eslint-disable-line react-hooks/exhaustive-deps

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
      text = "Select New Haven's nameplate to view its supplies and send your captain to gather wood. Double-click a path to walk there."
      hint = "Select New Haven's name on the map"
      showNextBtn = false
    } else {
      targetSelector = '[data-tutorial="gather-wood-btn"]'
      title = 'Gather Wood'
      text = 'Choose Gather wood. Your captain will walk to the grove and harvest timber for your town.'
      hint = 'Choose Gather wood, then watch your captain walk there'
      showNextBtn = false
    }
  }

  // --- Step 3: Walking to trees and cutting wood ---
  else if (tutorialStep === 3) {
    targetSelector = 'captain'
    title = 'Gathering Wood'
    text = 'Watch your captain walk to the grove and chop the timber. Tasks take a few moments to complete as your captain works on site.'
    hint = 'Your captain is harvesting the grove...'
    // No Next button — auto-advances when task finishes
  }

  // --- Step 5: Deposit backpack supplies into storage ---
  else if (tutorialStep === 5) {
    if (ui.panel === 'backpack') {
      targetSelector = '[data-tutorial="backpack-deposit-btn"]'
      title = 'Store Supplies'
      text = 'Your backpack has limited carrying capacity. Unload carried materials into Town Storage at any storage depot to free up space. Click Deposit All!'
      hint = 'Click Deposit All to store your supplies'
      showNextBtn = false
    } else {
      targetSelector = '[data-tutorial="rail-backpack"]'
      title = 'Open Backpack'
      text = 'Click Backpack on the left rail to view your carried materials and deposit them.'
      hint = 'Click the Backpack button in the left rail'
      showNextBtn = false
    }
  }

  // --- Step 6: Captain walking to storage depot and depositing ---
  else if (tutorialStep === 6) {
    targetSelector = 'captain'
    title = 'Depositing Supplies'
    text = 'Watch your captain walk to the storage depot to unload the backpack. Stored materials are safe in Town Storage and can still be used for building!'
    hint = 'Your captain is walking to the depot to store supplies...'
    // No Next button — auto-advances when task finishes
  }

  // --- Step 7: Open the Build Menu ---
  else if (tutorialStep === 7) {
    targetSelector = '[data-tutorial="rail-build"]'
    title = 'Town Workshop'
    text = 'Buildings help your village grow and survive. Click Build to open the Town Workshop!'
    hint = 'Click the Build button in the left rail'
    // No Next button — player must click Build; auto-advances when panel opens
  }

  // --- Step 8: Select a Shelter ---
  else if (tutorialStep === 8) {
    targetSelector = '[data-tutorial="build-btn-shelter"]'
    title = 'Choose a Building'
    text = 'A Shelter gives your villagers a place to live. Click the + button to select it!'
    hint = 'Click the gold + button on the Shelter card'
    // No Next button — player must click the Shelter +; auto-advances when placing starts
  }

  // --- Step 9: Place the Shelter ---
  else if (tutorialStep === 9) {
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

  // --- Step 10: Constructing the Shelter ---
  else if (tutorialStep === 10) {
    targetSelector = 'captain'
    title = 'Constructing Shelter'
    text = 'Watch your captain walk to the plot and construct the Shelter. As your town expands, your captain builds and repairs the structures your villagers need!'
    hint = 'Your captain is constructing the shelter...'
    // No Next button — auto-advances when task finishes
  }

  // --- Steps with panel open + inner highlight (4, 11, 14, 15, 16, 19, 20, 21) ---
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
        if (!cfg.keepOpenOnNext) ui.setPanel(null)
        setTutorialStep(cfg.next)
      }
    }
  }

  // --- Info-only steps: Resources, Resource flow, Level, Town stats, Settings ---
  else if (INFO_STEPS[tutorialStep]) {
    const cfg = INFO_STEPS[tutorialStep]
    targetSelector = `[data-tutorial="${cfg.target}"]`
    title = cfg.title
    text = cfg.text
    hint = cfg.hint || ''
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

    // Step 2: Auto-advance to Step 3 when gathering starts
    if (tutorialStep === 2) {
      const snap = stepSnapshot.current
      const woodGained = state.resources.wood + (state.backpack?.wood || 0) > snap.wood
      const hasTask = Boolean(player.current?.pending || player.current?.avatar?.task)
      if (hasTask || woodGained) {
        if (ui.panel === 'island') ui.setPanel(null)
        setTutorialStep(3)
      }
    }

    // Step 3: Auto-advance to Step 4 (Backpack) when wood has been gathered
    if (tutorialStep === 3) {
      const snap = stepSnapshot.current
      const woodGained = state.resources.wood + (state.backpack?.wood || 0) > snap.wood
      const hasWoodInPack = (state.backpack?.wood || 0) > 0
      const busy = Boolean(player.current?.pending || player.current?.avatar?.task)
      if ((woodGained || hasWoodInPack) && !busy) {
        const timer = setTimeout(() => {
          setTutorialStep(4)
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    // Step 4 or 5: If the player clicked deposit (or deposit task started), close backpack & advance to Step 6
    if (tutorialStep === 4 || tutorialStep === 5) {
      const hasDepositTask = Boolean(
        (player.current?.avatar?.task && player.current.avatar.task.kind === 'deposit') ||
        (player.current?.pending?.action?.type === 'DEPOSIT_BACKPACK')
      )
      if (hasDepositTask) {
        if (ui.panel === 'backpack') ui.setPanel(null)
        setTutorialStep(6)
      }
    }

    // Step 6: Auto-advance to Step 7 (Build Menu) when deposit completes
    if (tutorialStep === 6) {
      const busy = Boolean(
        (player.current?.avatar?.task && player.current.avatar.task.kind === 'deposit') ||
        (player.current?.pending?.action?.type === 'DEPOSIT_BACKPACK')
      )
      if (!busy) {
        const timer = setTimeout(() => {
          setTutorialStep(7)
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    // Step 7: Auto-advance when build menu opens (was step 5)
    if (tutorialStep === 7) {
      if (ui.panel === 'build') {
        const timer = setTimeout(() => {
          setTutorialStep(8)
        }, 150)
        return () => clearTimeout(timer)
      }
    }

    // Step 8: Auto-advance when shelter is selected for placing (was step 6)
    if (tutorialStep === 8) {
      if (ui.placing === 'shelter') {
        const timer = setTimeout(() => {
          setTutorialStep(9)
        }, 150)
        return () => clearTimeout(timer)
      }
    }

    // Step 9: Auto-advance to Step 10 when shelter plot is clicked (was step 7)
    if (tutorialStep === 9) {
      const snap = stepSnapshot.current
      const currentShelters = state.buildings.filter((b) => b.type === 'shelter').length
      const shelterPlaced = currentShelters > (snap.shelters || 0)
      const hasBuildTask = Boolean(
        (player.current?.avatar?.task && player.current.avatar.task.kind === 'build') ||
        (player.current?.pending?.action?.type === 'BUILD')
      )
      if (hasBuildTask || shelterPlaced) {
        setTutorialStep(10)
      }
    }

    // Step 10: Auto-advance to Step 11 when shelter is finished (was step 8)
    if (tutorialStep === 10) {
      const snap = stepSnapshot.current
      const currentShelters = state.buildings.filter((b) => b.type === 'shelter').length
      const shelterBuilt = currentShelters > (snap.shelters || 0)
      const busy = Boolean(
        (player.current?.avatar?.task && player.current.avatar.task.kind === 'build') ||
        (player.current?.pending?.action?.type === 'BUILD')
      )
      if ((shelterBuilt || currentShelters > 0) && !busy) {
        const timer = setTimeout(() => {
          setTutorialStep(11)
        }, 500)
        return () => clearTimeout(timer)
      }
    }

    // Panel steps (4, 11, 14, 15, 16, 19, 20, 21): if opened and then closed (X / Esc), advance
    const panelCfg = PANEL_STEPS[tutorialStep]
    if (panelCfg) {
      if (ui.panel === panelCfg.panel) {
        stepSnapshot.current.wasOpen = true
      } else if (stepSnapshot.current.wasOpen) {
        const timer = setTimeout(() => setTutorialStep(panelCfg.next), 150)
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
    state.backpack?.wood,
    state.buildings,
    player,
    setTutorialStep,
  ])

  // --- Mark active target element with data-tutorial-active="true" ---
  useEffect(() => {
    if (!targetSelector || targetSelector === 'captain') return
    const activeEls = new Set()
    const syncActiveAttr = () => {
      const els = Array.from(document.querySelectorAll(targetSelector))
      for (const el of activeEls) {
        if (!els.includes(el)) {
          el.removeAttribute('data-tutorial-active')
          activeEls.delete(el)
        }
      }
      for (const el of els) {
        if (!activeEls.has(el)) {
          el.setAttribute('data-tutorial-active', 'true')
          activeEls.add(el)
        }
      }
      if (els[0] && typeof els[0].scrollIntoView === 'function') {
        try { els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' }) } catch (_) {}
      }
    }
    syncActiveAttr()
    const timer = setInterval(syncActiveAttr, 100)
    return () => {
      clearInterval(timer)
      for (const el of activeEls) el.removeAttribute('data-tutorial-active')
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
      if (targetSelector === 'captain') {
        const a = player.current?.avatar
        const cam = ui.camera.current
        if (a && cam?.view) {
          const camEl = document.querySelector('.camera')
          const cr = camEl ? camEl.getBoundingClientRect() : { left: 0, top: 0 }
          const { x: camX, y: camY, s } = cam.view()
          const sx = cr.left + (a.x - WORLD.x) * s + camX
          const sy = cr.top + (a.y - WORLD.y) * s + camY
          const radius = Math.max(30, 36 * s)
          const rect = {
            left: sx - radius,
            top: sy - radius * 1.5,
            width: radius * 2,
            height: radius * 2.2,
            right: sx + radius,
            bottom: sy + radius * 0.7,
          }
          setTargetRect((prev) => {
            if (!prev) return rect
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
      } else {
        const els = Array.from(document.querySelectorAll(targetSelector))
        if (els.length > 1) {
          let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity
          els.forEach((el) => {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) {
              minLeft = Math.min(minLeft, r.left)
              minTop = Math.min(minTop, r.top)
              maxRight = Math.max(maxRight, r.right)
              maxBottom = Math.max(maxBottom, r.bottom)
            }
          })
          if (minLeft < Infinity) {
            const rect = {
              left: minLeft,
              top: minTop,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              right: maxRight,
              bottom: maxBottom,
            }
            setTargetRect((prev) => {
              if (!prev) return rect
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
        } else if (els.length === 1) {
          const rect = els[0].getBoundingClientRect()
          setTargetRect((prev) => {
            if (!prev) return rect
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
      }
      rafId = requestAnimationFrame(updateTarget)
    }

    updateTarget()
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [tutorialActive, targetSelector, tutorialStep, ui.panel, ui.selected, ui.placing, player, ui.camera])

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
      <div ref={dialogRef} className="tutorial-root" role="dialog" aria-label="Tutorial - Welcome">
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
      <div ref={dialogRef} className="tutorial-root" role="dialog" aria-label="Tutorial - Complete">
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

  // When a PANEL_STEP or modal is in its inner phase (panel already open), skip backdrop
  // so the game modal is not covered by the tutorial backdrop
  const insideModal = Boolean(
    ui.panel && (
      PANEL_STEPS[tutorialStep]?.panel === ui.panel ||
      (tutorialStep === 5 && ui.panel === 'backpack')
    )
  )

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
    if (tutorialStep === 12 || tutorialStep === 13) order = ['bottom']
    else if (tutorialStep === 14 && ui.panel !== 'weather') order = ['bottom', 'left', 'right']
    else if (tutorialStep === 2 && ui.panel === 'island') order = ['left', 'top', 'bottom']
    else if (targetSelector === 'captain') order = ['bottom', 'top', 'right', 'left']
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
    <div className="tutorial-root" role="region" data-guided-dialog aria-label={`Tutorial Step ${stepDisplayNumber}`} aria-live="polite">
      {insideModal ? (
        // Panel is open: no backdrop so the game modal is visible and interactive
        hole && <div className="tutorial-spotlight-box" style={{ top: `${hole.top}px`, left: `${hole.left}px`, width: `${hole.width}px`, height: `${hole.height}px` }} />
      ) : hole ? (
        <>
          <div className="tutorial-backdrop-panel" style={{ top: 0, left: 0, width: '100vw', height: `${hole.top}px` }} onClick={handleBackdropClick} />
          <div className="tutorial-backdrop-panel" style={{ top: `${hole.bottom}px`, left: 0, width: '100vw', bottom: 0 }} onClick={handleBackdropClick} />
          <div className="tutorial-backdrop-panel" style={{ top: `${hole.top}px`, left: 0, width: `${hole.left}px`, height: `${hole.height}px` }} onClick={handleBackdropClick} />
          <div className="tutorial-backdrop-panel" style={{ top: `${hole.top}px`, left: `${hole.right}px`, right: 0, height: `${hole.height}px` }} onClick={handleBackdropClick} />
          {targetSelector === 'captain' && (
            <div
              style={{
                position: 'fixed',
                top: `${hole.top}px`,
                left: `${hole.left}px`,
                width: `${hole.width}px`,
                height: `${hole.height}px`,
                pointerEvents: 'auto',
                zIndex: 902,
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            />
          )}
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
