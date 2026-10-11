import { input } from '@/systems/input'
import { InteractButton } from './InteractButton'
import { RechargeButton } from './RechargeButton'

/** Botones de acción: interactuar (contextual) y saltar. */
export function ActionButtons() {
  return (
    <div className="action-buttons">
      <RechargeButton />
      <InteractButton />
      <button
        className="action-btn"
        aria-label="Saltar"
        onPointerDown={(e) => {
          e.stopPropagation()
          input.jumpQueued = true
        }}
      >
        ⤒
      </button>
    </div>
  )
}
