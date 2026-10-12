import { useEffect, useState } from 'react'
import { input } from '@/systems/input'
import { player } from '@/systems/player'
import { InteractButton } from './InteractButton'
import { RechargeButton } from './RechargeButton'
import { GrappleButton } from './GrappleButton'

/** Pulsar y mantener: escribe en `input` mientras el dedo sigue en el botón. */
const hold = (set: (v: boolean) => void) => ({
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    set(true)
  },
  onPointerUp: () => set(false),
  onPointerCancel: () => set(false),
  onLostPointerCapture: () => set(false),
})

/** Botones de acción: interactuar (contextual) y saltar; nadando, subir y bucear. */
export function ActionButtons() {
  const [swimming, setSwimming] = useState(false)
  useEffect(() => {
    const id = window.setInterval(() => setSwimming(!!player.swimming), 200)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    if (!swimming) input.diveHeld = false
  }, [swimming])
  return (
    <div className="action-buttons">
      <RechargeButton />
      <GrappleButton />
      <InteractButton />
      {swimming && (
        <button className="action-btn" aria-label="Bucear" {...hold((v) => (input.diveHeld = v))}>
          ⤓
        </button>
      )}
      <button
        className="action-btn"
        aria-label={swimming ? 'Subir' : 'Saltar'}
        {...hold((v) => {
          input.jumpHeld = v
          if (v) input.jumpQueued = true
        })}
      >
        ⤒
      </button>
    </div>
  )
}
