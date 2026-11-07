import { useEffect } from 'react'
import { GameProvider, UIProvider, useGame, useUI } from './game/GameContext.jsx'
import Backdrop from './components/map/Backdrop.jsx'
import SkyMap from './components/map/SkyMap.jsx'
import TopBar from './components/hud/TopBar.jsx'
import { TitleBlock, LeftRail, LevelBadge, WeatherCard } from './components/hud/SideHud.jsx'
import { BottomNav, TurnControls, SettingsButton, ObjectiveRibbon, PlacingHint } from './components/hud/BottomBar.jsx'
import { QuestBook, BuildPanel, AdvisorPanel } from './components/panels/LeftPanels.jsx'
import IslandPanel from './components/panels/IslandPanel.jsx'
import BridgeModal from './components/panels/BridgeModal.jsx'
import { JournalModal, StorageModal, MapModal, SettingsModal, TurnReport, Toasts } from './components/panels/Modals.jsx'
import Tutorial from './components/tutorial/Tutorial.jsx'

function GameScreen() {
  const { state } = useGame()
  const ui = useUI()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (ui.placing) ui.setPlacing(null)
      else if (['quests', 'build', 'advisor', 'island'].includes(ui.panel)) ui.setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui])

  return (
    <div className="game">
      <Backdrop />
      <SkyMap />

      <div className="hud">
        <header className="hud-top">
          <TitleBlock />
          <TopBar />
          <LevelBadge />
        </header>
        <ObjectiveRibbon />
        <WeatherCard />
        <LeftRail />
        <TurnControls />
        <BottomNav />
        <SettingsButton />
        <PlacingHint />
      </div>

      {ui.panel === 'quests' && <QuestBook />}
      {ui.panel === 'build' && <BuildPanel />}
      {ui.panel === 'advisor' && <AdvisorPanel />}
      {ui.panel === 'island' && <IslandPanel />}
      {ui.panel === 'journal' && <JournalModal />}
      {ui.panel === 'storage' && <StorageModal />}
      {ui.panel === 'map' && <MapModal />}
      {ui.panel === 'settings' && <SettingsModal />}
      {ui.bridgeRoute && <BridgeModal />}
      <TurnReport />
      <Tutorial />
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <GameProvider>
      <UIProvider>
        <GameScreen />
      </UIProvider>
    </GameProvider>
  )
}
