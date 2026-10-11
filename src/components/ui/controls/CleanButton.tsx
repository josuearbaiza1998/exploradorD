import { useGameStore } from '@/store/gameStore'
import { cleanSensorsWithBestTool } from '@/systems/sensorCleaning'

/**
 * Atajo de limpieza junto a la mochila: solo existe si tienes con qué
 * limpiar. No muestra porcentajes: el jugador decide mirando cómo ve.
 */
export function CleanButton() {
  const tool = useGameStore((s) => (s.inventory.sonicCleaner ? 'sonic' : (s.inventory.cloth ?? 0) > 0 ? 'cloth' : null))
  const cloths = useGameStore((s) => s.inventory.cloth ?? 0)
  if (!tool) return null
  return (
    <button className="clean-btn" aria-label="Limpiar sensores" onClick={cleanSensorsWithBestTool}>
      {tool === 'sonic' ? '📡' : '🧽'}
      {tool === 'cloth' && <span className="clean-count">{cloths}</span>}
    </button>
  )
}
