import { CHUNK_SIZE, CRASH_SITE } from '@/config/world'
import { COLLIDABLE_LAYERS, getLayerChunk } from '@/systems/propPlacement'

export type CircleCollider = { x: number; z: number; r: number }

const chunkCache = new Map<string, CircleCollider[]>()

/** Colisionadores circulares de los props de un chunk (derivados del scatter). */
function chunkColliders(cx: number, cz: number): CircleCollider[] {
  const key = `${cx}:${cz}`
  let list = chunkCache.get(key)
  if (list) return list
  list = []
  for (const layer of COLLIDABLE_LAYERS) {
    for (const m of getLayerChunk(layer, cx, cz)) {
      const e = m.elements
      const scale = Math.hypot(e[0], e[1], e[2])
      list.push({ x: e[12], z: e[14], r: (layer.colliderRadius ?? 0) * scale })
    }
  }
  chunkCache.set(key, list)
  return list
}

/** La nave: círculos a lo largo del casco y las alas (placeholder aproximado). */
const SHIP_COLLIDERS: CircleCollider[] = (() => {
  const rot = -CRASH_SITE.rotation
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  // Coordenadas locales (x, z, radio) del placeholder de la nave.
  const local: [number, number, number][] = [
    [0, -9, 3], [0, -4, 3.4], [0, 1, 3.4], [0, 6, 3], [6.5, -1, 3.2], [-7, 4, 2.6],
  ]
  return local.map(([x, z, r]) => ({
    x: CRASH_SITE.x + x * cos + z * sin,
    z: CRASH_SITE.z - x * sin + z * cos,
    r,
  }))
})()

const result: CircleCollider[] = []

/** Colisionadores cercanos a (x, z). Reutiliza el array de salida: no guardar la referencia. */
export function queryColliders(x: number, z: number, radius: number): CircleCollider[] {
  result.length = 0
  const pad = radius + 3
  const minCx = Math.floor((x - pad) / CHUNK_SIZE)
  const maxCx = Math.floor((x + pad) / CHUNK_SIZE)
  const minCz = Math.floor((z - pad) / CHUNK_SIZE)
  const maxCz = Math.floor((z + pad) / CHUNK_SIZE)
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (const c of chunkColliders(cx, cz)) {
        if (Math.abs(c.x - x) < pad + c.r && Math.abs(c.z - z) < pad + c.r) result.push(c)
      }
    }
  }
  for (const c of SHIP_COLLIDERS) result.push(c)
  return result
}
