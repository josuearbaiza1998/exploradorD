import type { StateCreator } from 'zustand'
import type { Inventory, ItemId } from '@/config/items'
import { POIS, type PoiId } from '@/config/pois'
import { REPAIRS, type RepairId } from '@/config/repairs'
import type { GameState } from '../gameStore'

export type ExplorationSlice = {
  /** Lugares descubiertos (y si ya se abrió su contenedor). */
  discovered: Partial<Record<PoiId, true>>
  looted: Partial<Record<PoiId, true>>
  repairs: Partial<Record<RepairId, true>>
  /** Último lugar descubierto (para el aviso en pantalla; no se guarda). */
  lastDiscovery: PoiId | null
  /** Se mostró ya el final de "nave reparada". */
  shipRepairedSeen: boolean
  /** Hallazgos del clima: restos que desentierra una tormenta y flores tras la lluvia. */
  finds: Find[]

  discover: (id: PoiId) => void
  clearDiscovery: () => void
  /** Abre el contenedor del lugar: pieza + botín. Devuelve lo obtenido. */
  lootPoi: (id: PoiId) => Inventory
  repair: (id: RepairId, atShip: boolean) => boolean
  markShipRepairedSeen: () => void
  addFinds: (finds: Find[]) => void
  removeFind: (id: string) => void
  /** Quita los hallazgos caducados (las flores se marchitan). */
  expireFinds: (totalHours: number) => void
}

export type Find = { id: string; kind: 'buried' | 'bloom'; x: number; z: number; until: number }

/** Máximo de hallazgos a la vez (no llenar el mapa si nadie los recoge). */
const MAX_FINDS = 14

export const createExplorationSlice: StateCreator<GameState, [], [], ExplorationSlice> = (set, get) => ({
  discovered: {},
  looted: {},
  repairs: {},
  lastDiscovery: null,
  shipRepairedSeen: false,
  finds: [],

  discover: (id) => {
    if (get().discovered[id]) return
    set((s) => ({ discovered: { ...s.discovered, [id]: true }, lastDiscovery: id }))
  },
  clearDiscovery: () => set({ lastDiscovery: null }),
  lootPoi: (id) => {
    const s = get()
    if (s.looted[id]) return {}
    const poi = POIS.find((p) => p.id === id)
    if (!poi) return {}
    const got: Inventory = {}
    for (const [item, n] of Object.entries({ ...poi.loot, [poi.part]: 1 }) as [ItemId, number][]) {
      const added = get().addItem(item, n)
      if (added > 0) got[item] = added
    }
    set((st) => ({ looted: { ...st.looted, [id]: true } }))
    return got
  },
  repair: (id, atShip) => {
    const s = get()
    const def = REPAIRS.find((r) => r.id === id)
    if (!def || !atShip || s.repairs[id] || !s.hasItems(def.cost)) return false
    const inventory: Inventory = { ...s.inventory }
    for (const [item, n] of Object.entries(def.cost) as [ItemId, number][]) inventory[item] = (inventory[item] ?? 0) - n
    set({ inventory, repairs: { ...s.repairs, [id]: true } })
    return true
  },
  markShipRepairedSeen: () => set({ shipRepairedSeen: true }),
  addFinds: (finds) => set((s) => ({ finds: [...s.finds, ...finds].slice(-MAX_FINDS) })),
  removeFind: (id) => set((s) => ({ finds: s.finds.filter((f) => f.id !== id) })),
  expireFinds: (h) => {
    if (get().finds.some((f) => f.until < h)) set((s) => ({ finds: s.finds.filter((f) => f.until >= h) }))
  },
})

export const isShipRepaired = (s: Pick<ExplorationSlice, 'repairs'>) => REPAIRS.every((r) => s.repairs[r.id])
