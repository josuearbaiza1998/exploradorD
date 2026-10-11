import type { Matrix4 } from 'three'
import { PROP_LAYERS, type PropLayer } from '@/config/propLayers'
import { scatterInChunk } from '@/utils/scatter'

/**
 * Caché de instancias por (capa, chunk). Determinista: se puede descartar
 * y regenerar en cualquier momento (terreno infinito) con el mismo resultado.
 */
const cache = new Map<string, Matrix4[]>()

export function getLayerChunk(layer: PropLayer, cx: number, cz: number): Matrix4[] {
  const key = `${layer.id}|${cx}:${cz}`
  let list = cache.get(key)
  if (!list) {
    list = scatterInChunk(cx, cz, layer.rule)
    cache.set(key, list)
  }
  return list
}

export const COLLIDABLE_LAYERS = PROP_LAYERS.filter((l) => l.colliderRadius !== undefined)

/** Libera la caché de los chunks lejanos (terreno infinito: la memoria no crece sin límite). */
export function pruneLayerCache(keepChunkKeys: Set<string>) {
  for (const key of cache.keys()) {
    const chunk = key.slice(key.indexOf('|') + 1)
    if (!keepChunkKeys.has(chunk)) cache.delete(key)
  }
}
