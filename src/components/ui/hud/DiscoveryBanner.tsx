import { useEffect } from 'react'
import { POIS } from '@/config/pois'
import { getGame, useGameStore } from '@/store/gameStore'
import { isShipRepaired } from '@/store/slices/explorationSlice'
import { useUiStore } from '@/store/uiStore'

/** Aviso grande al descubrir un lugar, con su registro (texto de la sonda). */
export function DiscoveryBanner() {
  const id = useGameStore((s) => s.lastDiscovery)
  useEffect(() => {
    if (!id) return
    const t = window.setTimeout(() => getGame().clearDiscovery(), 9000)
    return () => window.clearTimeout(t)
  }, [id])
  const poi = POIS.find((p) => p.id === id)
  if (!poi) return null
  return (
    <button className="discovery" onClick={() => getGame().clearDiscovery()}>
      <span className="discovery-kicker">Lugar descubierto</span>
      <strong>
        {poi.icon} {poi.name}
      </strong>
      <span className="discovery-log">{poi.log}</span>
    </button>
  )
}

/** Final: la nave está reparada. Se muestra una vez. */
export function ShipRepairedModal() {
  const show = useGameStore((s) => isShipRepaired(s) && !s.shipRepairedSeen)
  // Cierra la mochila para que el final se vea entero.
  useEffect(() => {
    if (show) useUiStore.getState().closeInventory()
  }, [show])
  if (!show) return null
  return (
    <div className="inv-backdrop">
      <div className="install-help ending">
        <h3>🚀 ¡Nave reparada!</h3>
        <p>
          Los cuatro sistemas responden. El motor ruge limpio, sin humo negro, y la antena ya envía señal. La sonda ha
          sobrevivido al desierto.
        </p>
        <p>Puedes seguir explorando y mejorando tu robot.</p>
        <button className="install-ok" onClick={() => getGame().markShipRepairedSeen()}>
          Seguir explorando
        </button>
      </div>
    </div>
  )
}
