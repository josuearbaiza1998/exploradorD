import { create } from 'zustand'

export type InventoryTab = 'items' | 'build' | 'upgrades' | 'ship'
export type MenuView = 'main' | 'journal'

/** Estado de la interfaz (no se guarda en la partida). */
export const useUiStore = create<{
  inventoryTab: InventoryTab | null
  openInventory: (tab?: InventoryTab) => void
  closeInventory: () => void
  menu: MenuView | null
  openMenu: (view?: MenuView) => void
  closeMenu: () => void
  /** Registro abierto para leer. */
  note: string | null
  openNote: (id: string) => void
  closeNote: () => void
  /** Fundido a negro breve (cambia el número para lanzarlo). */
  fadeKey: number
  fade: () => void
}>()((set) => ({
  inventoryTab: null,
  openInventory: (tab = 'items') => set({ inventoryTab: tab }),
  closeInventory: () => set({ inventoryTab: null }),
  menu: null,
  openMenu: (view = 'main') => set({ menu: view }),
  closeMenu: () => set({ menu: null }),
  note: null,
  openNote: (id) => set({ note: id }),
  closeNote: () => set({ note: null }),
  fadeKey: 0,
  fade: () => set((s) => ({ fadeKey: s.fadeKey + 1 })),
}))
