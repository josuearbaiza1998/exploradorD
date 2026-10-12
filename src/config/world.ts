/**
 * Configuración global del mundo. Todo lo que define el diseño de nivel
 * (posiciones de puntos de interés, colinas guía, tamaño de la isla) vive aquí
 * para poder iterar sin tocar componentes.
 */

import { POIS } from './pois'

export type Vec2 = { x: number; z: number }

export const WORLD_SEED = 1337

/** Tamaño de un chunk de terreno en metros y su resolución (segmentos por lado). */
export const CHUNK_SIZE = 64
export const CHUNK_RESOLUTION = 32

// El radio de chunks visibles depende de la calidad: store/settingsStore.ts.

/**
 * Modo isla: el terreno cae al mar más allá de ISLAND_RADIUS.
 * Para terreno infinito en el futuro basta con poner `enabled: false`
 * y el ChunkManager seguirá generando chunks alrededor del jugador.
 */
/** `?mundo=infinito` en la URL desactiva la isla y prueba el terreno infinito. */
const INFINITE_WORLD =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mundo') === 'infinito'

export const ISLAND = {
  enabled: !INFINITE_WORLD,
  radius: 210,
  shoreWidth: 45,
  seaLevel: -1.5,
}

/** Puntos de interés (POI). */
export const SPAWN: Vec2 = { x: 0, z: 40 }

/** La nave cayó cerca de la playa este, con el morro hacia el muelle (y hacia la otra isla). */
export const CRASH_SITE: Vec2 & { rotation: number } = { x: 118, z: -60, rotation: -1.92 }

export const OASIS: Vec2 & { radius: number; depth: number } = {
  x: -135,
  z: -35,
  radius: 26,
  depth: 5,
}

/**
 * Colinas "regla del triángulo" (BotW): formas triangulares grandes que
 * bloquean la vista y obligan a rodearlas o escalarlas, revelando POIs
 * poco a poco. `ridge` controla qué tan afilada es la cresta.
 */
export type LandmarkHill = Vec2 & { radius: number; height: number; ridge: number }

export const LANDMARK_HILLS: LandmarkHill[] = [
  // Gran colina que tapa el oasis desde el spawn (hay que rodearla o subirla).
  { x: -70, z: -10, radius: 55, height: 34, ridge: 1.6 },
  // Colina media a la derecha: enmarca la vista hacia la nave sin taparla.
  { x: 55, z: -20, radius: 38, height: 20, ridge: 1.4 },
  // Pico alto detrás de la nave: mirador para ver toda la isla.
  { x: 104, z: -158, radius: 55, height: 44, ridge: 1.9 },
  // Colinas que ocultan la zona sur (secretos futuros).
  { x: -40, z: 130, radius: 42, height: 22, ridge: 1.5 },
  { x: 100, z: 95, radius: 50, height: 28, ridge: 1.7 },
  // Pequeñas colinas de "primer plano" cerca del spawn para dar escala.
  { x: -20, z: 15, radius: 18, height: 6, ridge: 1.2 },
  { x: 28, z: 60, radius: 16, height: 5, ridge: 1.2 },
  { x: -150, z: -110, radius: 45, height: 26, ridge: 1.5 },
]

/**
 * Paredes de roca: dentro del radio, por encima de `minHeight`, las laderas
 * más empinadas que `slope` solo se suben con las garras de escalada.
 */
export const CLIMB_WALLS: (Vec2 & { radius: number; minHeight: number; slope: number })[] = [
  // La colina de la baliza (junto a la nave y el islote).
  { x: 104, z: -158, radius: 52, minHeight: 8, slope: 0.6 },
]

/** ¿Este punto es pared de roca escalable? */
export function isClimbWall(x: number, z: number, y: number, slope: number): boolean {
  for (const w of CLIMB_WALLS) {
    if (y > w.minHeight && slope > w.slope && (x - w.x) ** 2 + (z - w.z) ** 2 < w.radius * w.radius) return true
  }
  return false
}

/** Islotes separados de la isla por agua honda (se llega con el gancho). */
export const ISLETS: (Vec2 & { radius: number; height: number })[] = [
  // Frente al pico de la baliza: allí cayó la antena.
  { x: 122, z: -186, radius: 9, height: 3.2 },
]

/** Zona plana alrededor del spawn y de la nave para que se puedan pisar cómodamente. */
export const FLAT_ZONES: (Vec2 & { radius: number })[] = [
  { ...SPAWN, radius: 10 },
  { x: CRASH_SITE.x, z: CRASH_SITE.z, radius: 22 },
  // Lugares por descubrir: suelo llano y sin vegetación encima.
  ...POIS.map((p) => ({ x: p.x, z: p.z, radius: p.clearRadius })),
]

/**
 * Plataforma de recarga junto al morro de la nave (coordenadas locales de la
 * nave rotadas a mundo). Aquí vuelve el robot en modo de emergencia.
 */
export const CHARGING_PAD: Vec2 = (() => {
  const localZ = 13
  const rot = -CRASH_SITE.rotation
  return { x: CRASH_SITE.x + localZ * Math.sin(rot), z: CRASH_SITE.z + localZ * Math.cos(rot) }
})()

/**
 * Puntos de chatarra alrededor de la nave (coordenadas LOCALES de la nave).
 * debris = escombros sueltos (a mano) · hullPanel = paneles del casco (hacha).
 */
export const SALVAGE_NODES: { id: string; kind: 'debris' | 'hullPanel'; local: [number, number, number]; rot: number }[] = [
  { id: 'debris-1', kind: 'debris', local: [6, 0, 10], rot: 0.4 },
  { id: 'debris-2', kind: 'debris', local: [-5, 0, -13], rot: 1.2 },
  { id: 'debris-3', kind: 'debris', local: [9, 0, -7], rot: 2.1 },
  { id: 'debris-4', kind: 'debris', local: [-10, 0, -3], rot: 0.7 },
  { id: 'debris-5', kind: 'debris', local: [4, 0, 15], rot: 1.9 },
  { id: 'panel-1', kind: 'hullPanel', local: [3.3, 1.6, -3], rot: 0 },
  { id: 'panel-2', kind: 'hullPanel', local: [-3.3, 1.6, 2], rot: Math.PI },
]

/** Convierte coordenadas locales de la nave a mundo (XZ). */
export function shipLocalToWorld(lx: number, lz: number): Vec2 {
  const rot = -CRASH_SITE.rotation
  return {
    x: CRASH_SITE.x + lx * Math.cos(rot) + lz * Math.sin(rot),
    z: CRASH_SITE.z - lx * Math.sin(rot) + lz * Math.cos(rot),
  }
}
