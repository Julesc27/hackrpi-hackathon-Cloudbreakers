import { useEffect } from 'react'
import { GameProvider, UIProvider, useGame, useUI } from './game/GameContext.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { SyncProvider } from './game/CloudSync.jsx'

import AuthModal from './components/panels/AuthModal.jsx'
import SkyMap from './components/map/SkyMap.jsx'
import TopBar from './components/hud/TopBar.jsx'
import FlyingResources from './components/hud/FlyingResources.jsx'
import { TitleBlock, LeftRail, LevelBadge, WeatherCard } from './components/hud/SideHud.jsx'
import { BottomNav, ProgressionCard, SettingsButton, ObjectiveRibbon, PlacingHint, CameraControls } from './components/hud/BottomBar.jsx'
import { QuestBook, BuildPanel, AdvisorPanel } from './components/panels/LeftPanels.jsx'
import IslandPanel from './components/panels/IslandPanel.jsx'
import BridgeAnchorModal from './components/panels/BridgeAnchorModal.jsx'
import BridgeModal from './components/panels/BridgeModal.jsx'
import {
  JournalModal,
  StorageModal,
  BackpackModal,
  StoreModal,
  MapModal,
  SettingsModal,
  IntroModal,
  Toasts,
} from './components/panels/Modals.jsx'
import Tutorial from './components/tutorial/Tutorial.jsx'
import PlayerControls from './components/hud/PlayerControls.jsx'

function GameScreen() {
  const { state } = useGame()
  const ui = useUI()
  const auth = useAuth()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return

      if (ui.placing) {
        ui.setPlacing(null)
      } else if (['quests', 'build', 'advisor', 'island'].includes(ui.panel)) {
        ui.setPanel(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui])

  return (
    <div className={`game${ui.panel || ui.bridgeRoute ? ' has-panel' : ''}`}>
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
        <ProgressionCard />
        <BottomNav />
        <SettingsButton />
        <CameraControls />
        <PlayerControls />
        <PlacingHint />
      </div>

      {ui.panel === 'quests' && <QuestBook />}
      {ui.panel === 'build' && <BuildPanel />}
      {ui.panel === 'advisor' && <AdvisorPanel />}
      {ui.panel === 'island' && <IslandPanel />}
      {ui.panel === 'journal' && <JournalModal />}
      {ui.panel === 'storage' && <StorageModal />}
      {ui.panel === 'backpack' && <BackpackModal />}
      {ui.panel === 'store' && <StoreModal />}
      {ui.panel === 'map' && <MapModal />}
      {ui.panel === 'settings' && <SettingsModal />}
      {ui.panel === 'bridges' && <BridgeAnchorModal />}
      {ui.bridgeRoute && <BridgeModal />}

      {auth.loginOpen && <AuthModal />}

      {!state.seenIntro && !auth.loginOpen && auth.status !== 'loading' && (
        <IntroModal />
      )}

      {!auth.loginOpen && auth.status !== 'loading' && state.seenIntro && (
        <Tutorial />
      )}

      <Toasts />

      {/* Fixed overlay for resource tokens flying from harvest sites to the top bar */}
      <FlyingResources />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <SyncProvider>
          <UIProvider>
            <GameScreen />
          </UIProvider>
        </SyncProvider>
      </GameProvider>
    </AuthProvider>
  )
}
