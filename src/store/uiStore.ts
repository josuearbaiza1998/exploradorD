import { create } from 'zustand'

export type InventoryTab = 'items' | 'build' | 'upgrades' | 'ship'

/** Estado de la interfaz (no se guarda en la partida). */
export const useUiStore = create<{
  inventoryTab: InventoryTab | null
  openInventory: (tab?: InventoryTab) => void
  closeInventory: () => void
}>()((set) => ({
  inventoryTab: null,
  openInventory: (tab = 'items') => set({ inventoryTab: tab }),
  closeInventory: () => set({ inventoryTab: null }),
}))
