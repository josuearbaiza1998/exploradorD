import { CHUNK_SIZE, SALVAGE_NODES, shipLocalToWorld, CRASH_SITE } from '@/config/world'
import { PROP_LAYERS } from '@/config/propLayers'
import type { InteractionTarget } from '@/store/slices/worldSlice'
import { getLayerChunk } from '@/systems/propPlacement'
import { getHeight } from '@/utils/terrain/heightfield'

/** Alcance de interacción (m) medido desde el borde del objeto. */
export const INTERACT_RANGE = 1.6

const HARVEST_LAYERS = PROP_LAYERS.filter((l) => l.harvest)

/** Radio "de alcance" por capa en unidades del modelo. */
const REACH_RADIUS: Record<string, number> = { palms: 0.5, smallTrees: 0.5, rocks: 1.1, oasisShrubs: 0.7, dryShrubs: 0.7 }

export const propKey = (layerId: string, cx: number, cz: number, index: number) => `${layerId}|${cx}:${cz}|${index}`
export const salvageKey = (id: string) => `ship|${id}`

const groundShip = getHeight(CRASH_SITE.x, CRASH_SITE.z)
export const SALVAGE_WORLD = SALVAGE_NODES.map((n) => {
  const w = shipLocalToWorld(n.local[0], n.local[2])
  return { ...n, key: salvageKey(n.id), x: w.x, z: w.z, y: n.kind === 'debris' ? getHeight(w.x, w.z) : groundShip + n.local[1] }
})

/**
 * Busca el objeto recolectable más conveniente: cerca y, sobre todo,
 * delante del robot (así el jugador "apunta" girando, sin retícula).
 */
export function findTarget(
  px: number,
  pz: number,
  heading: number,
  harvested: Record<string, number>,
): InteractionTarget | null {
  const fx = Math.sin(heading)
  const fz = Math.cos(heading)
  let best: InteractionTarget | null = null
  let bestScore = Infinity

  const consider = (key: string, kind: InteractionTarget['kind'], x: number, y: number, z: number, r: number) => {
    if (key in harvested) return
    const dx = x - px
    const dz = z - pz
    const d = Math.hypot(dx, dz)
    const edge = d - r
    if (edge > INTERACT_RANGE) return
    const facing = d > 1e-3 ? (dx * fx + dz * fz) / d : 1
    if (facing < -0.2 && edge > 0.3) return // detrás del robot
    const score = edge - facing * 0.8
    if (score < bestScore) {
      bestScore = score
      best = { key, kind, position: [x, y, z], radius: r }
    }
  }

  const reach = INTERACT_RANGE + 3
  const minCx = Math.floor((px - reach) / CHUNK_SIZE)
  const maxCx = Math.floor((px + reach) / CHUNK_SIZE)
  const minCz = Math.floor((pz - reach) / CHUNK_SIZE)
  const maxCz = Math.floor((pz + reach) / CHUNK_SIZE)
  for (const layer of HARVEST_LAYERS) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = getLayerChunk(layer, cx, cz)
        for (let i = 0; i < list.length; i++) {
          const e = list[i].elements
          if (Math.abs(e[12] - px) > reach || Math.abs(e[14] - pz) > reach) continue
          const scale = Math.hypot(e[0], e[1], e[2])
          consider(propKey(layer.id, cx, cz, i), layer.harvest!, e[12], e[13], e[14], (REACH_RADIUS[layer.id] ?? 0.6) * scale)
        }
      }
    }
  }

  for (const n of SALVAGE_WORLD) {
    if (Math.abs(n.x - px) > reach + 4 || Math.abs(n.z - pz) > reach + 4) continue
    consider(n.key, n.kind, n.x, n.y, n.z, n.kind === 'hullPanel' ? 3.6 : 0.8)
  }

  return best
}
