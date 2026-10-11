import { useSyncExternalStore } from 'react'
import type { BufferGeometry } from 'three'
import { CHUNK_RESOLUTION, CHUNK_SIZE } from '@/config/world'
import { PROP_LAYERS } from '@/config/propLayers'
import { focus } from '@/systems/focus'
import { pruneColliderCache } from '@/systems/physics/staticColliders'
import { getLayerChunk, pruneLayerCache } from '@/systems/propPlacement'
import { buildChunkGeometry } from '@/utils/terrain/chunkGeometry'

export type ChunkRequest = { cx: number; cz: number; key: string }

/**
 * Generación de chunks REPARTIDA en el tiempo: en vez de construir todos los
 * chunks nuevos en un frame (tirón al cruzar un borde), se construyen los más
 * cercanos primero, con un presupuesto de milisegundos por frame. Es lo que
 * permite el terreno infinito sin tirones en móvil.
 */
const geometries = new Map<string, BufferGeometry>()
let queue: ChunkRequest[] = []
let wanted = new Set<string>()
let version = 0
const listeners = new Set<() => void>()

const notify = () => {
  version++
  listeners.forEach((l) => l())
}

/** Declara qué chunks deben existir; descarta (y libera) los que sobran. */
export function requestChunks(chunks: ChunkRequest[]) {
  wanted = new Set(chunks.map((c) => c.key))
  queue = chunks.filter((c) => !geometries.has(c.key))
  let removed = false
  for (const [key, geometry] of geometries) {
    if (!wanted.has(key)) {
      geometry.dispose()
      geometries.delete(key)
      removed = true
    }
  }
  // Las cachés de props y colisiones se podan con un margen para no regenerar al ir y volver.
  pruneLayerCache(wanted)
  pruneColliderCache(wanted)
  if (removed) notify()
}

/** Construye chunks pendientes hasta agotar el presupuesto. Llamar una vez por frame. */
export function processChunkQueue(budgetMs: number) {
  if (queue.length === 0) return
  const start = performance.now()
  const fx = focus.x / CHUNK_SIZE
  const fz = focus.z / CHUNK_SIZE
  queue.sort((a, b) => (a.cx + 0.5 - fx) ** 2 + (a.cz + 0.5 - fz) ** 2 - ((b.cx + 0.5 - fx) ** 2 + (b.cz + 0.5 - fz) ** 2))
  let built = false
  while (queue.length && performance.now() - start < budgetMs) {
    const c = queue.shift()!
    if (!wanted.has(c.key) || geometries.has(c.key)) continue
    geometries.set(c.key, buildChunkGeometry(c.cx, c.cz, CHUNK_SIZE, CHUNK_RESOLUTION))
    // Pre-calcular la vegetación del chunk en el mismo hueco de tiempo.
    for (const layer of PROP_LAYERS) getLayerChunk(layer, c.cx, c.cz)
    built = true
  }
  if (built) notify()
}

export const getChunkGeometry = (key: string) => geometries.get(key)
export const isChunkReady = (key: string) => geometries.has(key)

/** Suscripción de React: se re-renderiza cuando aparecen o desaparecen chunks. */
export function useChunkVersion() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
}
