import { getGame } from '@/store/gameStore'

/** Batería (%) que gasta cada uso del limpiador sónico. */
export const SONIC_CLEAN_COST = 1.5

/**
 * Limpia los sensores con la mejor herramienta disponible:
 * limpiador sónico (reutilizable, gasta batería) o paño (consumible).
 */
export function cleanSensorsWithBestTool(): boolean {
  const game = getGame()
  if (game.sensorDirt < 0.02 || game.mode !== 'active') return false
  if (game.inventory.sonicCleaner) {
    game.addBattery(-SONIC_CLEAN_COST)
    game.cleanSensors(0.5)
    game.notify('📡 Sensores sacudidos', 'info')
    return true
  }
  if (game.removeItem('cloth')) {
    game.cleanSensors(0.6)
    game.notify('🧽 Sensores limpios', 'info')
    return true
  }
  return false
}
