import { Vector3 } from 'three'
import { CRASH_SITE, SPAWN } from '@/config/world'
import { getHeight } from '@/utils/terrain/heightfield'

/**
 * Estado físico del robot (posición, velocidad, orientación).
 * Mutable a propósito: cambia cada frame y no debe provocar re-renders.
 * Los datos de juego (batería, sensores, inventario) irán a Zustand en la Fase 3.
 */
export const player = {
  position: new Vector3(SPAWN.x, getHeight(SPAWN.x, SPAWN.z), SPAWN.z),
  velocity: new Vector3(),
  /** Hacia dónde mira el robot (radianes, 0 = +Z). */
  heading: Math.atan2(CRASH_SITE.x - SPAWN.x, CRASH_SITE.z - SPAWN.z),
  grounded: true,
  inWater: false,
  /** Velocidad horizontal actual en m/s (para animaciones). */
  speed: 0,
}
