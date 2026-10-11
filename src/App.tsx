import { GameCanvas } from '@/components/scene/GameCanvas'
import { TouchControls } from '@/components/ui/controls/TouchControls'
import { RotateDeviceHint } from '@/components/ui/RotateDeviceHint'
import { DebugPanel } from '@/components/ui/DebugPanel'
import { EmergencyOverlay } from '@/components/ui/EmergencyOverlay'
import { SensorOverlay } from '@/components/ui/SensorOverlay'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <SensorOverlay />
      <EmergencyOverlay />
      <TouchControls />
      <DebugPanel />
      <RotateDeviceHint />
    </div>
  )
}
