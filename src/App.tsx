import { GameCanvas } from '@/components/scene/GameCanvas'
import { TouchControls } from '@/components/ui/controls/TouchControls'
import { RotateDeviceHint } from '@/components/ui/RotateDeviceHint'
import { DebugPanel } from '@/components/ui/DebugPanel'
import { EmergencyOverlay } from '@/components/ui/EmergencyOverlay'
import { SensorOverlay } from '@/components/ui/SensorOverlay'
import { NoticeToast } from '@/components/ui/NoticeToast'
import { InventoryPanel } from '@/components/ui/inventory/InventoryPanel'
import { FadeOverlay } from '@/components/ui/FadeOverlay'
import { GameMenu, NoteModal } from '@/components/ui/menu/GameMenu'
import { Hud, NightVisionOverlay } from '@/components/ui/hud/Hud'

// Panel de pruebas: solo en desarrollo o con ?debug en la URL.
const SHOW_DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <NightVisionOverlay />
      <FadeOverlay />
      <SensorOverlay />
      <EmergencyOverlay />
      <TouchControls />
      <Hud />
      <NoticeToast />
      <InventoryPanel />
      <GameMenu />
      <NoteModal />
      {SHOW_DEBUG && <DebugPanel />}
      <RotateDeviceHint />
    </div>
  )
}
