import { CRASH_SITE, SPAWN } from '@/config/world'

/**
 * Órbita de la cámara en tercera persona alrededor del robot.
 * yaw = 0 => cámara en +Z mirando hacia -Z.
 */
export const cameraRig = {
  // Arranca detrás del robot, mirando hacia el humo de la nave.
  yaw: Math.atan2(-(CRASH_SITE.x - SPAWN.x), -(CRASH_SITE.z - SPAWN.z)),
  pitch: 0.32,
  distance: 7.5,
  minPitch: -0.15,
  maxPitch: 1.15,
  /** Radianes por píxel arrastrado. */
  sensitivity: 0.0055,
}

/** Ejes de movimiento relativos a la cámara (en el plano XZ). */
export function cameraAxes() {
  const s = Math.sin(cameraRig.yaw)
  const c = Math.cos(cameraRig.yaw)
  return { forwardX: -s, forwardZ: -c, rightX: c, rightZ: -s }
}
