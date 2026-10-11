/**
 * Configuración global del mundo. Todo lo que define el diseño de nivel
 * (posiciones de puntos de interés, colinas guía, tamaño de la isla) vive aquí
 * para poder iterar sin tocar componentes.
 */

export type Vec2 = { x: number; z: number }

export const WORLD_SEED = 1337

/** Tamaño de un chunk de terreno en metros y su resolución (segmentos por lado). */
export const CHUNK_SIZE = 64
export const CHUNK_RESOLUTION = 32

/** Radio (en chunks) alrededor del foco que se mantiene cargado. */
export const CHUNK_VIEW_RADIUS = 5

/**
 * Modo isla: el terreno cae al mar más allá de ISLAND_RADIUS.
 * Para terreno infinito en el futuro basta con poner `enabled: false`
 * y el ChunkManager seguirá generando chunks alrededor del jugador.
 */
export const ISLAND = {
  enabled: true,
  radius: 210,
  shoreWidth: 45,
  seaLevel: -1.5,
}

/** Puntos de interés (POI). */
export const SPAWN: Vec2 = { x: 0, z: 40 }

export const CRASH_SITE: Vec2 & { rotation: number } = { x: 70, z: -120, rotation: 0.6 }

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
  { x: 120, z: -175, radius: 60, height: 48, ridge: 1.9 },
  // Colinas que ocultan la zona sur (secretos futuros).
  { x: -40, z: 130, radius: 42, height: 22, ridge: 1.5 },
  { x: 100, z: 95, radius: 50, height: 28, ridge: 1.7 },
  // Pequeñas colinas de "primer plano" cerca del spawn para dar escala.
  { x: -20, z: 15, radius: 18, height: 6, ridge: 1.2 },
  { x: 28, z: 60, radius: 16, height: 5, ridge: 1.2 },
  { x: -150, z: -110, radius: 45, height: 26, ridge: 1.5 },
]

/** Zona plana alrededor del spawn y de la nave para que se puedan pisar cómodamente. */
export const FLAT_ZONES: (Vec2 & { radius: number })[] = [
  { ...SPAWN, radius: 10 },
  { x: CRASH_SITE.x, z: CRASH_SITE.z, radius: 22 },
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
