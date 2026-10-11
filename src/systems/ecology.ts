import { OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'

/**
 * Agua y humedad del mundo (las calcula <EcologySystem/>):
 *  - wetness: charcos (sube rápido con la lluvia, el sol los seca en horas).
 *  - moisture: humedad del suelo (lenta: días). Hace crecer el oasis, reverdece
 *    las plantas y acelera que rebroten.
 */
export const ecology = {
  wetness: 0,
  moisture: 0.4,
  /** Nivel actual del agua del oasis (m). */
  oasisLevel: OASIS_WATER_LEVEL,
}

/** Subida/bajada del oasis según la humedad (m). */
export const oasisOffset = (moisture: number) => (moisture - 0.4) * 1.1

export type Puddle = { x: number; z: number; y: number; r: number }

/** Charcos visibles ahora mismo cerca del robot (los usa la fauna para beber). */
export const activePuddles: Puddle[] = []
