import type { Vec2 } from './world'

/**
 * Muelle de la playa este (frente a la otra isla) y amarre del barco. El
 * barco aparece aquí cuando la nave está adaptada.
 */
export const PIER = {
  from: { x: 159.4, z: -63.4 } as Vec2,
  to: { x: 178.2, z: -70.2 } as Vec2,
  halfWidth: 1.5,
  /** Altura de la tarima (mundo). */
  y: 1.35,
}

/** Rumbo del muelle hacia el mar (y hacia la otra isla). */
export const PIER_HEADING = Math.atan2(PIER.to.x - PIER.from.x, PIER.to.z - PIER.from.z)

/** Amarre: el barco con la popa pegada al final del muelle. */
export const BOAT_MOOR = {
  x: PIER.to.x + Math.sin(PIER_HEADING) * 5.6,
  z: PIER.to.z + Math.cos(PIER_HEADING) * 5.6,
  heading: PIER_HEADING,
}

export const BOAT = {
  /** Velocidad máxima (m/s). */
  maxSpeed: 10,
  accel: 2.6,
  drag: 0.9,
  /** Giro máximo (rad/s). */
  turn: 1.35,
  /** Distancia del centro a proa y a popa (m). */
  halfLength: 4.7,
  /** Profundidad mínima para que el casco no toque fondo. */
  minDepth: 1.0,
  /** Más allá de este radio (desde el centro de la isla) el oleaje no deja pasar todavía. */
  openSeaRadius: 430,
  /** Dónde va el robot, al timón (coordenadas locales: altura de la cubierta). */
  deck: { x: 0, y: 1.35, z: -0.45 },
  /** El casco se hunde respecto a la superficie del agua. */
  draft: 0.55,
}

/** Altura de la tarima del muelle en (x, z), o null si no está encima. */
export function pierDeck(x: number, z: number): number | null {
  const ax = PIER.to.x - PIER.from.x
  const az = PIER.to.z - PIER.from.z
  const len2 = ax * ax + az * az
  const t = ((x - PIER.from.x) * ax + (z - PIER.from.z) * az) / len2
  if (t < -0.02 || t > 1.02) return null
  const px = PIER.from.x + ax * t
  const pz = PIER.from.z + az * t
  return Math.hypot(x - px, z - pz) <= PIER.halfWidth ? PIER.y : null
}
