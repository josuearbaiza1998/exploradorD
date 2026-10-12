import { CHUNK_SIZE, CRASH_SITE } from '@/config/world'
import { POIS, poiLocalToWorld } from '@/config/pois'
import { COLLIDABLE_LAYERS, getLayerChunk } from '@/systems/propPlacement'
import { propKey } from '@/systems/interaction/interactables'
import { isShipRepaired } from '@/store/slices/explorationSlice'
import { getGame } from '@/store/gameStore'
import { STRUCTURES } from '@/config/structures'

/** Círculo en XZ con altura sobre el suelo `h` (para la cámara). */
export type CircleCollider = { x: number; z: number; r: number; h: number; key?: string }

const chunkCache = new Map<string, CircleCollider[]>()

/** Colisionadores circulares de los props de un chunk (derivados del scatter). */
function chunkColliders(cx: number, cz: number): CircleCollider[] {
  const key = `${cx}:${cz}`
  let list = chunkCache.get(key)
  if (list) return list
  list = []
  for (const layer of COLLIDABLE_LAYERS) {
    const matrices = getLayerChunk(layer, cx, cz)
    for (let i = 0; i < matrices.length; i++) {
      const e = matrices[i].elements
      const scale = Math.hypot(e[0], e[1], e[2])
      list.push({ x: e[12], z: e[14], r: (layer.colliderRadius ?? 0) * scale, h: (layer.colliderHeight ?? 2) * scale, key: layer.harvest ? propKey(layer.id, cx, cz, i) : undefined })
    }
  }
  chunkCache.set(key, list)
  return list
}

/** Libera los colisionadores de chunks lejanos. */
export function pruneColliderCache(keepChunkKeys: Set<string>) {
  for (const key of chunkCache.keys()) if (!keepChunkKeys.has(key)) chunkCache.delete(key)
}

/** Coordenadas locales de la nave (x, z, radio) → círculos de mundo. */
function shipCircles(local: [number, number, number][], h: number): CircleCollider[] {
  const rot = -CRASH_SITE.rotation
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return local.map(([x, z, r]) => ({ x: CRASH_SITE.x + x * cos + z * sin, z: CRASH_SITE.z - x * sin + z * cos, r, h }))
}

/** La nave: círculos a lo largo del casco y las alas (placeholder aproximado). */
const SHIP_COLLIDERS = shipCircles([[0, -9, 3], [0, -4, 3.4], [0, 1, 3.4], [0, 6, 3], [6.5, -1, 3.2], [-7, 4, 2.6]], 5)
/** Astillero (casco estanco hecho): el barco sobre la grada y, hasta montar el motor, la cola cortada. */
const YARD_COLLIDERS = shipCircles([[0, -1.4, 2], [0, 1.6, 2], [0, 4.6, 1.6], [-2.6, 1.4, 1]], 4)
const TAIL_COLLIDERS = shipCircles([[0, -7.6, 2.4], [0, -10, 1.6]], 4)

/** Lugares por descubrir: pilares, rocas de la cueva, la baliza… */
const POI_COLLIDERS: CircleCollider[] = POIS.flatMap((poi) =>
  poi.colliders.map(([lx, lz, r, h]) => ({ ...poiLocalToWorld(poi, lx, lz), r, h })),
)

const result: CircleCollider[] = []

/** Colisionadores cercanos a (x, z). Reutiliza el array de salida: no guardar la referencia. */
export function queryColliders(x: number, z: number, radius: number): CircleCollider[] {
  result.length = 0
  const harvested = getGame().harvested
  const pad = radius + 3
  const minCx = Math.floor((x - pad) / CHUNK_SIZE)
  const maxCx = Math.floor((x + pad) / CHUNK_SIZE)
  const minCz = Math.floor((z - pad) / CHUNK_SIZE)
  const maxCz = Math.floor((z + pad) / CHUNK_SIZE)
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (const c of chunkColliders(cx, cz)) {
        if (c.key && c.key in harvested) continue // talado/picado: ya no bloquea
        if (Math.abs(c.x - x) < pad + c.r && Math.abs(c.z - z) < pad + c.r) result.push(c)
      }
    }
  }
  // La nave se convierte en barco en la grada y, terminado, se va al muelle.
  const game = getGame()
  if (!isShipRepaired(game)) {
    if (!game.repairs.hull) for (const c of SHIP_COLLIDERS) result.push(c)
    else {
      for (const c of YARD_COLLIDERS) result.push(c)
      if (!game.repairs.engine) for (const c of TAIL_COLLIDERS) result.push(c)
    }
  }
  for (const c of POI_COLLIDERS) if (Math.abs(c.x - x) < pad + c.r && Math.abs(c.z - z) < pad + c.r) result.push(c)
  // Estructuras construidas por el jugador (pocas: se recorren todas).
  for (const st of getGame().structures) {
    if (Math.abs(st.x - x) > pad + 4 || Math.abs(st.z - z) > pad + 4) continue
    const cos = Math.cos(st.rot)
    const sin = Math.sin(st.rot)
    for (const [lx, lz, r, h] of STRUCTURES[st.type].colliders) {
      result.push({ x: st.x + lx * cos + lz * sin, z: st.z - lx * sin + lz * cos, r, h })
    }
  }
  return result
}
