import { CHUNK_SIZE, SALVAGE_NODES, shipLocalToWorld, CRASH_SITE } from '@/config/world'
import { PROP_LAYERS } from '@/config/propLayers'
import type { InteractionTarget } from '@/store/slices/worldSlice'
import { getLayerChunk } from '@/systems/propPlacement'
import { getHeight } from '@/utils/terrain/heightfield'
import { COLLECTOR_USE, PANEL_DIRTY, STRUCTURES } from '@/config/structures'
import { getGame } from '@/store/gameStore'
import { NOTES } from '@/config/notes'
import { CAVE_CACHE, CAVE_CRYSTALS, CAVE_ORIGIN, caveFloor } from '@/config/cave'
import { POIS, poiLocalToWorld, type PoiId } from '@/config/pois'
import type { PlacedStructure } from '@/store/slices/structuresSlice'
import type { Find } from '@/store/slices/explorationSlice'
import { scavengerKey, scavengers } from '@/systems/scavengers'

/** Alcance de interacción (m) medido desde el borde del objeto. */
export const INTERACT_RANGE = 1.6

const HARVEST_LAYERS = PROP_LAYERS.filter((l) => l.harvest)

/** Radio "de alcance" por capa en unidades del modelo. */
const REACH_RADIUS: Record<string, number> = { palms: 0.5, smallTrees: 0.5, rocks: 1.1, oasisShrubs: 0.7, dryShrubs: 0.7 }

export const propKey = (layerId: string, cx: number, cz: number, index: number) => `${layerId}|${cx}:${cz}|${index}`
export const salvageKey = (id: string) => `ship|${id}`
export const cacheKey = (id: PoiId) => `poi|${id}`
export const findKey = (id: string) => `find|${id}`
export const noteKey = (id: string) => `note|${id}`

export const NOTE_WORLD = NOTES.map((n) => ({ ...n, key: noteKey(n.id), y: n.cave ? caveFloor(n.x, n.z) : getHeight(n.x, n.z) }))

export const caveCrystalKey = (i: number) => `cavecrystal|${i}`
export const CAVE_CRYSTAL_WORLD = CAVE_CRYSTALS.map(([lx, lz], i) => {
  const x = CAVE_ORIGIN.x + lx
  const z = CAVE_ORIGIN.z + lz
  return { key: caveCrystalKey(i), x, z, y: caveFloor(x, z) }
})

export const POI_CACHES = POIS.map((poi) => {
  // El contenedor de la cueva está al fondo de su interior.
  if (poi.id === 'cave') return { id: poi.id, key: cacheKey(poi.id), x: CAVE_CACHE.x, z: CAVE_CACHE.z, y: caveFloor(CAVE_CACHE.x, CAVE_CACHE.z) }
  const w = poi.cacheWorld ?? poiLocalToWorld(poi, poi.cache[0], poi.cache[1])
  return { id: poi.id, key: cacheKey(poi.id), x: w.x, z: w.z, y: getHeight(w.x, w.z) }
})

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
  structures: PlacedStructure[] = [],
  looted: Partial<Record<PoiId, true>> = {},
  finds: Find[] = [],
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

  // Estructuras propias (se pueden desmontar).
  const game = getGame()
  for (const st of structures) {
    const y = getHeight(st.x, st.z)
    const r = STRUCTURES[st.type].footprint * 0.6
    // Panel sucio → limpiar; colector con agua → refrescarse; si no, desmontar.
    if (st.type === 'solarPanel' && (game.panelDirt[st.id] ?? 0) > PANEL_DIRTY) consider(`clean|${st.id}`, 'panelClean', st.x, y, st.z, r)
    else if (st.type === 'rainCollector' && (game.water[st.id] ?? 0) >= COLLECTOR_USE) consider(`water|${st.id}`, 'collector', st.x, y, st.z, r)
    else consider(`struct|${st.id}`, 'structure', st.x, y, st.z, r)
  }

  for (const n of SALVAGE_WORLD) {
    if (Math.abs(n.x - px) > reach + 4 || Math.abs(n.z - pz) > reach + 4) continue
    consider(n.key, n.kind, n.x, n.y, n.z, n.kind === 'hullPanel' ? 3.6 : 0.8)
  }

  // Contenedores de los lugares por descubrir (se abren una vez).
  for (const c of POI_CACHES) {
    if (looted[c.id] || Math.abs(c.x - px) > reach + 2 || Math.abs(c.z - pz) > reach + 2) continue
    consider(c.key, 'cache', c.x, c.y, c.z, 0.9)
  }

  // Registros sueltos (se pueden releer).
  for (const n of NOTE_WORLD) {
    if (Math.abs(n.x - px) > reach || Math.abs(n.z - pz) > reach) continue
    consider(n.key, 'note', n.x, n.y, n.z, 0.5)
  }

  // Racimos de cristal de la cueva.
  for (const c of CAVE_CRYSTAL_WORLD) {
    if (Math.abs(c.x - px) > reach || Math.abs(c.z - pz) > reach) continue
    consider(c.key, 'crystal', c.x, c.y, c.z, 0.8)
  }

  // Carroñeros (se mueven).
  for (const sc of scavengers) {
    if (!sc.active || Math.abs(sc.x - px) > reach || Math.abs(sc.z - pz) > reach) continue
    consider(scavengerKey(sc), 'scavenger', sc.x, getHeight(sc.x, sc.z) + 0.4, sc.z, 0.6)
  }

  // Hallazgos del clima.
  for (const f of finds) {
    if (Math.abs(f.x - px) > reach || Math.abs(f.z - pz) > reach) continue
    consider(findKey(f.id), f.kind, f.x, getHeight(f.x, f.z), f.z, 0.6)
  }

  return best
}
