import type { StateCreator } from 'zustand'
import type { Inventory, ItemId } from '@/config/items'
import { POIS, type PoiId } from '@/config/pois'
import { NOTES } from '@/config/notes'
import { ITEMS } from '@/config/items'
import { REPAIRS, type RepairId } from '@/config/repairs'
import type { GameState } from '../gameStore'

export type ExplorationSlice = {
  /** Lugares descubiertos (y si ya se abrió su contenedor). */
  discovered: Partial<Record<PoiId, true>>
  looted: Partial<Record<PoiId, true>>
  repairs: Partial<Record<RepairId, true>>
  /** Último lugar descubierto (para el aviso en pantalla; no se guarda). */
  lastDiscovery: PoiId | null
  /** Se mostró ya el final de "barco listo". */
  shipRepairedSeen: boolean
  /** Hallazgos del clima: restos que desentierra una tormenta y flores tras la lluvia. */
  finds: Find[]
  /** Registros leídos. */
  notesRead: Record<string, true>
  /** Bitácora: lo que el robot ha ido encontrando, mejorando y reparando. */
  journal: JournalEntry[]
  /** Niebla del minimapa (bits en base64; ver systems/exploredMap.ts). */
  explored: string

  setExplored: (s: string) => void
  discover: (id: PoiId) => void
  clearDiscovery: () => void
  /** Abre el contenedor del lugar: pieza + botín. Devuelve lo obtenido. */
  lootPoi: (id: PoiId) => Inventory
  repair: (id: RepairId, atShip: boolean) => boolean
  markShipRepairedSeen: () => void
  /** Dónde quedó el barco: [x, z, rumbo] (null = amarrado en el muelle). */
  boatPos: [number, number, number] | null
  setBoatPos: (p: [number, number, number] | null) => void
  readNote: (id: string) => void
  logJournal: (entry: Omit<JournalEntry, 'id' | 'at'>) => void
  addFinds: (finds: Find[]) => void
  removeFind: (id: string) => void
  /** Quita los hallazgos caducados (las flores se marchitan). */
  expireFinds: (totalHours: number) => void
}

export type JournalKind = 'place' | 'part' | 'upgrade' | 'repair' | 'tool' | 'note'
export type JournalEntry = { id: number; at: number; kind: JournalKind; icon: string; title: string; text?: string }

export type Find = { id: string; kind: 'buried' | 'bloom' | 'fulgurite' | 'meteorite'; x: number; z: number; until: number }

/** Máximo de hallazgos a la vez (no llenar el mapa si nadie los recoge). */
const MAX_FINDS = 14

export const createExplorationSlice: StateCreator<GameState, [], [], ExplorationSlice> = (set, get) => ({
  discovered: {},
  looted: {},
  repairs: {},
  lastDiscovery: null,
  shipRepairedSeen: false,
  finds: [],
  notesRead: {},
  journal: [],
  explored: '',

  setExplored: (explored) => set({ explored }),
  discover: (id) => {
    if (get().discovered[id]) return
    set((s) => ({ discovered: { ...s.discovered, [id]: true }, lastDiscovery: id }))
    const poi = POIS.find((p) => p.id === id)
    if (poi) get().logJournal({ kind: 'place', icon: poi.icon, title: poi.name, text: poi.log })
  },
  readNote: (id) => {
    if (get().notesRead[id]) return
    set((s) => ({ notesRead: { ...s.notesRead, [id]: true } }))
    const note = NOTES.find((n) => n.id === id)
    if (note) get().logJournal({ kind: 'note', icon: '📜', title: note.title, text: note.text })
  },
  logJournal: (entry) =>
    set((s) => ({ journal: [...s.journal, { ...entry, id: (s.journal.at(-1)?.id ?? 0) + 1, at: s.totalHours }] })),
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
    const part = ITEMS[poi.part]
    get().logJournal({ kind: 'part', icon: part.icon, title: part.name, text: `Encontrada en ${poi.name}. Sirve para convertir la nave en barco.` })
    return got
  },
  repair: (id, atShip) => {
    const s = get()
    const def = REPAIRS.find((r) => r.id === id)
    if (!def || !atShip || s.repairs[id] || !s.pay(def.cost, true)) return false
    set({ repairs: { ...s.repairs, [id]: true } })
    get().logJournal({ kind: 'repair', icon: def.icon, title: `Barco: ${def.name}`, text: def.description })
    return true
  },
  markShipRepairedSeen: () => set({ shipRepairedSeen: true }),
  boatPos: null,
  setBoatPos: (boatPos) => set({ boatPos }),
  addFinds: (finds) => set((s) => ({ finds: [...s.finds, ...finds].slice(-MAX_FINDS) })),
  removeFind: (id) => set((s) => ({ finds: s.finds.filter((f) => f.id !== id) })),
  expireFinds: (h) => {
    if (get().finds.some((f) => f.until < h)) set((s) => ({ finds: s.finds.filter((f) => f.until >= h) }))
  },
})

export const isShipRepaired = (s: Pick<ExplorationSlice, 'repairs'>) => REPAIRS.every((r) => s.repairs[r.id])
