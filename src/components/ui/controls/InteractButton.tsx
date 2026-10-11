import { useEffect, useRef } from 'react'
import { HARVEST } from '@/config/harvest'
import { ITEMS } from '@/config/items'
import { getGame, useGameStore } from '@/store/gameStore'
import { performInteraction } from '@/systems/interaction/performInteraction'

const REPEAT_MS = 380

/**
 * Botón contextual: solo aparece cuando hay algo al alcance.
 *  - Caja caída → recogerla.
 *  - Recurso delante → golpear (mantener pulsado = golpes seguidos).
 */
export function InteractButton() {
  const boxId = useGameStore((s) => s.nearbyBoxId)
  const kind = useGameStore((s) => s.target?.kind ?? null)
  const hasTool = useGameStore((s) => {
    const tool = s.target ? HARVEST[s.target.kind].tool : undefined
    return !tool || !!s.inventory[tool]
  })
  const repeat = useRef<number | null>(null)

  const act = () => {
    const id = getGame().nearbyBoxId
    if (id) {
      getGame().recoverBox(id)
      getGame().notify('📦 Caja recuperada', 'info')
      return
    }
    performInteraction()
  }
  const stop = () => {
    if (repeat.current !== null) window.clearInterval(repeat.current)
    repeat.current = null
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') act()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      stop()
    }
  }, [])

  // Si desaparece el objetivo mientras se mantiene pulsado, dejar de repetir.
  useEffect(() => {
    if (!kind && !boxId) stop()
  }, [kind, boxId])

  if (!boxId && !kind) return null
  const def = kind ? HARVEST[kind] : null
  const caption = boxId ? 'Recoger caja' : hasTool ? `${def!.verb} · ${def!.label}` : `Necesitas ${ITEMS[def!.tool!].name}`

  return (
    <div className="interact-wrap">
      <span className={`interact-caption ${hasTool || boxId ? '' : 'locked'}`}>{caption}</span>
      <button
        className={`action-btn interact-btn ${hasTool || boxId ? '' : 'locked'}`}
        aria-label={caption}
        onPointerDown={(e) => {
          e.stopPropagation()
          act()
          if (!boxId) repeat.current = window.setInterval(act, REPEAT_MS)
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
      >
        {boxId ? '📦' : hasTool ? def!.icon : '🔒'}
      </button>
    </div>
  )
}
