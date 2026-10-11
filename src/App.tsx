import { GameCanvas } from '@/components/scene/GameCanvas'
import { RotateDeviceHint } from '@/components/ui/RotateDeviceHint'
import { TimeDebugPanel } from '@/components/ui/TimeDebugPanel'

export default function App() {
  return (
    <div className="app">
      <GameCanvas />
      <TimeDebugPanel />
      <RotateDeviceHint />
    </div>
  )
}
