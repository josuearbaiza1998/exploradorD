import type { StateCreator } from 'zustand'
import { ITEMS, type Inventory, type ItemId } from '@/config/items'
import type { Recipe } from '@/config/recipes'
import type { GameState } from '../gameStore'

export type DroppedBox = {
  id: string
  position: [number, number, number]
  items: Inventory
  /** Hora in-game total en que cayó (para mostrar "hace X días" en el futuro). */
  droppedAt: number
}

export type InventorySlice = {
  inventory: Inventory
  /** Cajas soltadas en modo emergencia que aún no se han recuperado. */
  droppedBoxes: DroppedBox[]
  /** Caja al alcance del robot (para mostrar el botón de recoger). */
  nearbyBoxId: string | null

  addItem: (id: ItemId, amount?: number) => number
  removeItem: (id: ItemId, amount?: number) => boolean
  hasItems: (cost: Inventory) => boolean
  /** Vuelca TODO el inventario en una caja en esa posición. Devuelve la caja o null si no había nada. */
  dropInventoryBox: (position: [number, number, number]) => DroppedBox | null
  recoverBox: (id: string) => void
  setNearbyBox: (id: string | null) => void
  /** Fabrica una receta si se cumplen materiales, estación y progresión. */
  craft: (recipe: Recipe, atWorkbench: boolean) => boolean
}

const isEmpty = (inv: Inventory) => Object.values(inv).every((n) => !n)

/** Suma b sobre a respetando los límites de cada objeto; devuelve [resultado, sobrante]. */
function mergeInventories(a: Inventory, b: Inventory): [Inventory, Inventory] {
  const result: Inventory = { ...a }
  const leftover: Inventory = {}
  for (const [key, amount] of Object.entries(b) as [ItemId, number][]) {
    if (!amount) continue
    const current = result[key] ?? 0
    const fits = Math.min(amount, ITEMS[key].stack - current)
    result[key] = current + fits
    if (amount > fits) leftover[key] = amount - fits
  }
  return [result, leftover]
}

export const createInventorySlice: StateCreator<GameState, [], [], InventorySlice> = (set, get) => ({
  inventory: {},
  droppedBoxes: [],
  nearbyBoxId: null,

  addItem: (id, amount = 1) => {
    const [inventory, leftover] = mergeInventories(get().inventory, { [id]: amount })
    set({ inventory })
    return amount - (leftover[id] ?? 0)
  },

  removeItem: (id, amount = 1) => {
    const current = get().inventory[id] ?? 0
    if (current < amount) return false
    set({ inventory: { ...get().inventory, [id]: current - amount } })
    return true
  },

  hasItems: (cost) =>
    (Object.entries(cost) as [ItemId, number][]).every(([id, n]) => (get().inventory[id] ?? 0) >= n),

  dropInventoryBox: (position) => {
    const { inventory, droppedBoxes, totalHours } = get()
    if (isEmpty(inventory)) return null
    const box: DroppedBox = {
      id: `box-${Math.round(totalHours * 1000)}-${droppedBoxes.length}`,
      position,
      items: { ...inventory },
      droppedAt: totalHours,
    }
    set({ inventory: {}, droppedBoxes: [...droppedBoxes, box] })
    return box
  },

  recoverBox: (id) => {
    const { droppedBoxes, inventory } = get()
    const box = droppedBoxes.find((b) => b.id === id)
    if (!box) return
    const [merged, leftover] = mergeInventories(inventory, box.items)
    // Lo que no cabe se queda en la caja (no se pierde nada).
    const remaining = isEmpty(leftover)
      ? droppedBoxes.filter((b) => b.id !== id)
      : droppedBoxes.map((b) => (b.id === id ? { ...b, items: leftover } : b))
    set({ inventory: merged, droppedBoxes: remaining, nearbyBoxId: isEmpty(leftover) ? null : id })
  },

  setNearbyBox: (nearbyBoxId) => {
    if (get().nearbyBoxId !== nearbyBoxId) set({ nearbyBoxId })
  },

  craft: (recipe, atWorkbench) => {
    const s = get()
    if (recipe.station === 'ship' && !atWorkbench) return false
    if (recipe.requires && !s.inventory[recipe.requires]) return false
    if (ITEMS[recipe.output].kind === 'tool' && s.inventory[recipe.output]) return false
    if (!s.hasItems(recipe.cost)) return false
    const inventory: Inventory = { ...s.inventory }
    for (const [id, n] of Object.entries(recipe.cost) as [ItemId, number][]) inventory[id] = (inventory[id] ?? 0) - n
    const [merged] = mergeInventories(inventory, { [recipe.output]: recipe.amount })
    set({ inventory: merged })
    return true
  },
})
