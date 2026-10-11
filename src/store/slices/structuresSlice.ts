import type { StateCreator } from 'zustand'
import { STRUCTURES, type StructureType } from '@/config/structures'
import type { Inventory, ItemId } from '@/config/items'
import type { GameState } from '../gameStore'

export type PlacedStructure = { id: string; type: StructureType; x: number; z: number; rot: number }

export type StructuresSlice = {
  structures: PlacedStructure[]
  /** Carga de cada banco de baterías (separada para no re-renderizar las estructuras). */
  bankCharge: Record<string, number>
  /** Polvo acumulado en cada panel solar (0..1). */
  panelDirt: Record<string, number>
  /** Agua guardada en cada colector de lluvia (0..1). */
  water: Record<string, number>
  /** Modo construcción activo: qué se va a colocar y con qué giro. */
  build: { type: StructureType; rot: number } | null

  startBuild: (type: StructureType) => void
  rotateBuild: () => void
  cancelBuild: () => void
  /** Coloca la estructura pagando su coste. Devuelve false si faltan materiales. */
  placeStructure: (x: number, z: number) => boolean
  /** Desmonta y devuelve la mitad de los materiales (redondeando hacia arriba). */
  dismantleStructure: (id: string) => Inventory
  setBankCharge: (id: string, value: number) => void
  setStructureState: (patch: { panelDirt?: Record<string, number>; water?: Record<string, number> }) => void
}

export const createStructuresSlice: StateCreator<GameState, [], [], StructuresSlice> = (set, get) => ({
  structures: [],
  bankCharge: {},
  panelDirt: {},
  water: {},
  build: null,

  startBuild: (type) => set({ build: { type, rot: 0 } }),
  rotateBuild: () => {
    const b = get().build
    if (b) set({ build: { ...b, rot: (b.rot + Math.PI / 4) % (Math.PI * 2) } })
  },
  cancelBuild: () => set({ build: null }),

  placeStructure: (x, z) => {
    const s = get()
    if (!s.build) return false
    const def = STRUCTURES[s.build.type]
    if (!s.hasItems(def.cost)) return false
    const inventory = { ...s.inventory }
    for (const [id, n] of Object.entries(def.cost) as [ItemId, number][]) inventory[id] = (inventory[id] ?? 0) - n
    const structure: PlacedStructure = {
      id: `${s.build.type}-${Date.now().toString(36)}`,
      type: s.build.type,
      x,
      z,
      rot: s.build.rot,
    }
    set({
      inventory,
      structures: [...s.structures, structure],
      bankCharge: def.bankCapacity ? { ...s.bankCharge, [structure.id]: 0 } : s.bankCharge,
      build: null,
    })
    return true
  },

  dismantleStructure: (id) => {
    const s = get()
    const st = s.structures.find((x) => x.id === id)
    if (!st) return {}
    const refund: Inventory = {}
    for (const [item, n] of Object.entries(STRUCTURES[st.type].cost) as [ItemId, number][]) refund[item] = Math.ceil(n / 2)
    const { [id]: _, ...bankCharge } = s.bankCharge
    void _
    set({ structures: s.structures.filter((x) => x.id !== id), bankCharge, target: null })
    for (const [item, n] of Object.entries(refund) as [ItemId, number][]) get().addItem(item, n)
    return refund
  },

  setBankCharge: (id, value) => set({ bankCharge: { ...get().bankCharge, [id]: value } }),
  setStructureState: (patch) => set(patch),
})
