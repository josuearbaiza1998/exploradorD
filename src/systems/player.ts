import { Vector3 } from 'three'
import { CRASH_SITE, SPAWN } from '@/config/world'
import { getGame } from '@/store/gameStore'
import { getHeight } from '@/utils/terrain/heightfield'

/**
 * Estado físico del robot (posición, velocidad, orientación).
 * Mutable a propósito: cambia cada frame y no debe provocar re-renders.
 * Los datos de juego (batería, sensores, inventario) viven en Zustand.
 */
const saved = getGame().lastPosition
const start = saved ?? [SPAWN.x, getHeight(SPAWN.x, SPAWN.z), SPAWN.z]

export const player = {
  position: new Vector3(start[0], start[1], start[2]),
  velocity: new Vector3(),
  /** Hacia dónde mira el robot (radianes, 0 = +Z). */
  heading: Math.atan2(CRASH_SITE.x - SPAWN.x, CRASH_SITE.z - SPAWN.z),
  grounded: true,
  inWater: false,
  /** Velocidad horizontal actual en m/s (para animaciones). */
  speed: 0,
  /** Se incrementa en cada teletransporte para que la cámara salte sin suavizado. */
  teleportId: 0,
  /** Momento (s, performance.now) del último golpe/acción, para la animación. */
  actionAt: -10,
}

export function teleportPlayer(x: number, z: number, heading?: number) {
  player.position.set(x, getHeight(x, z), z)
  player.velocity.set(0, 0, 0)
  if (heading !== undefined) player.heading = heading
  player.teleportId++
}
