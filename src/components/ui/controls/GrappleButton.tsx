import { useEffect, useState } from 'react'
import type { Anchor } from '@/config/grapple'
import { getGame, useGameStore } from '@/store/gameStore'
import { findAnchor, grapple, startGrapple } from '@/systems/grapple'
import { playClick } from '@/systems/audio/audioEngine'

/** Con el gancho y un poste de anclaje a tiro delante: botón para lanzarse. */
export function GrappleButton() {
  const hasHook = useGameStore((s) => !!s.inventory.hook)
  const active = useGameStore((s) => s.mode === 'active')
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  useEffect(() => {
    if (!hasHook) return
    const id = window.setInterval(() => setAnchor(grapple.active ? null : findAnchor()), 250)
    return () => window.clearInterval(id)
  }, [hasHook])
  if (!hasHook || !active || !anchor) return null
  return (
    <button
      className="recharge-btn grapple-btn"
      onPointerDown={(e) => {
        e.stopPropagation()
        if (getGame().mode !== 'active' || grapple.active) return
        playClick()
        startGrapple(anchor)
        setAnchor(null)
      }}
    >
      🪝 Gancho · {anchor.label}
    </button>
  )
}
