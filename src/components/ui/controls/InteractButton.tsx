import { useEffect } from 'react'
import { getGame, useGameStore } from '@/store/gameStore'

/**
 * Botón contextual: solo aparece cuando hay algo al alcance (por ahora, la
 * caja caída). En la Fase 4 servirá también para talar, recoger y craftear.
 */
export function InteractButton() {
  const boxId = useGameStore((s) => s.nearbyBoxId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const id = getGame().nearbyBoxId
      if (e.code === 'KeyE' && id) getGame().recoverBox(id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!boxId) return null
  return (
    <button
      className="action-btn interact-btn"
      aria-label="Recoger caja"
      onPointerDown={(e) => {
        e.stopPropagation()
        getGame().recoverBox(boxId)
      }}
    >
      📦
    </button>
  )
}
