import { GameCanvas } from '@/components/scene/GameCanvas'
import { TouchControls } from '@/components/ui/controls/TouchControls'
import { RotateDeviceHint } from '@/components/ui/RotateDeviceHint'
import { TimeDebugPanel } from '@/components/ui/TimeDebugPanel'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <TouchControls />
      <TimeDebugPanel />
      <RotateDeviceHint />
    </div>
  )
}
