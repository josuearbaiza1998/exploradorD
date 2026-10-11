import { useKeyboardInput } from '@/hooks/useKeyboardInput'
import { ActionButtons } from './ActionButtons'
import { BuildControls } from './BuildControls'
import { LookPad } from './LookPad'
import { VirtualJoystick } from './VirtualJoystick'

/** Capa de controles: joystick a la izquierda, vista a la derecha, acciones abajo a la derecha. */
export function TouchControls() {
  useKeyboardInput()
  return (
    <div className="controls">
      <LookPad />
      <VirtualJoystick />
      <ActionButtons />
      <BuildControls />
    </div>
  )
}
