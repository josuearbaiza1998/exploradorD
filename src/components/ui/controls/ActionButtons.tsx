import { input } from '@/systems/input'

/** Botones de acción (por ahora solo saltar). Se ampliará con interactuar/limpiar sensores. */
export function ActionButtons() {
  return (
    <div className="action-buttons">
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
