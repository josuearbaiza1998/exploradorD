import { ISLAND, OASIS } from '@/config/world'
import { queryColliders } from '@/systems/physics/staticColliders'
import { getHeight } from './heightfield'

/** Punto al azar en tierra firme (fuera del mar y del agua del oasis) en un anillo alrededor de (cx, cz),
 * opcionalmente sin obstáculos en `clear` metros. */
export function landSpot(cx: number, cz: number, min: number, max: number, clear = 0) {
  for (let k = 0; k < 16; k++) {
    const a = Math.random() * Math.PI * 2
    const r = min + Math.random() * (max - min)
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r
    const y = getHeight(x, z)
    if (Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.radius + 3) continue
    if (ISLAND.enabled && y < ISLAND.seaLevel + 0.6) continue
    // Lejos de rocas, árboles y estructuras (si no, quedan tapados o fuera de alcance).
    if (clear > 0 && queryColliders(x, z, clear).some((c) => Math.hypot(c.x - x, c.z - z) < clear + c.r)) continue
    return { x, z, y }
  }
  return null
}
