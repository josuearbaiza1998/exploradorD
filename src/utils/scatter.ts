import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { CHUNK_SIZE, CRASH_SITE, FLAT_ZONES, OASIS, WORLD_SEED } from '@/config/world'
import { getHeight, getSlope, isUnderwater } from '@/utils/terrain/heightfield'
import { createRng } from '@/utils/random'

export type ScatterRule = {
  /** Semilla propia de la capa (cada capa se distribuye distinto). */
  seed: number
  /** Celdas por lado dentro de un chunk (densidad máxima). */
  cellsPerSide: number
  /** Probabilidad base [0,1] de que una celda tenga instancia. */
  probability: (x: number, z: number) => number
  maxSlope: number
  minHeight?: number
  maxHeight?: number
  scale: [number, number]
  /** Inclinación aleatoria máxima en radianes. */
  tilt?: number
}

const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()

/**
 * Distribución determinista por chunk (rejilla con jitter).
 * Mismo chunk => mismas instancias, así el scatter también escala a
 * terreno infinito y puede cachearse/descargarse por chunk.
 */
export function scatterInChunk(cx: number, cz: number, rule: ScatterRule): Matrix4[] {
  const rng = createRng(WORLD_SEED ^ (rule.seed * 7919) ^ (cx * 73856093) ^ (cz * 19349663))
  const cell = CHUNK_SIZE / rule.cellsPerSide
  const out: Matrix4[] = []
  for (let j = 0; j < rule.cellsPerSide; j++) {
    for (let i = 0; i < rule.cellsPerSide; i++) {
      const x = cx * CHUNK_SIZE + (i + rng()) * cell
      const z = cz * CHUNK_SIZE + (j + rng()) * cell
      const roll = rng()
      const scaleRoll = rng()
      const rotRoll = rng()
      const tiltRoll = rng()
      if (roll > rule.probability(x, z)) continue
      if (isUnderwater(x, z) || inClearZone(x, z)) continue
      const y = getHeight(x, z)
      if (rule.minHeight !== undefined && y < rule.minHeight) continue
      if (rule.maxHeight !== undefined && y > rule.maxHeight) continue
      if (getSlope(x, z) > rule.maxSlope) continue
      const s = rule.scale[0] + (rule.scale[1] - rule.scale[0]) * scaleRoll
      const tilt = (rule.tilt ?? 0) * (tiltRoll - 0.5) * 2
      _e.set(tilt, rotRoll * Math.PI * 2, tilt * 0.5)
      _q.setFromEuler(_e)
      _p.set(x, y - 0.1, z)
      _s.set(s, s, s)
      out.push(new Matrix4().compose(_p, _q, _s))
    }
  }
  return out
}

function inClearZone(x: number, z: number): boolean {
  for (const zone of FLAT_ZONES) {
    const r = zone.x === CRASH_SITE.x && zone.z === CRASH_SITE.z ? zone.radius * 0.9 : zone.radius
    if (Math.hypot(x - zone.x, z - zone.z) < r) return true
  }
  return false
}

/** Densidad que crece cerca del oasis (para vegetación verde). */
export function oasisProximity(x: number, z: number, reach = 2.2): number {
  const d = Math.hypot(x - OASIS.x, z - OASIS.z) / OASIS.radius
  return Math.max(0, 1 - (d - 1) / (reach - 1))
}
