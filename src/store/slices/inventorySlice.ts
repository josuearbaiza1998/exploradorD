import type { StateCreator } from 'zustand'
import { ITEMS, type Inventory, type ItemId } from '@/config/items'
import type { Recipe } from '@/config/recipes'
import { upgradeEffects } from '@/config/upgrades'
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
  /** Almacén de la nave: sin límite; se usa al fabricar/mejorar/reparar junto a la nave. */
  storage: Inventory
  /** Cajas soltadas en modo emergencia que aún no se han recuperado. */
  droppedBoxes: DroppedBox[]
  /** Caja al alcance del robot (para mostrar el botón de recoger). */
  nearbyBoxId: string | null

  addItem: (id: ItemId, amount?: number) => number
  removeItem: (id: ItemId, amount?: number) => boolean
  /** ¿Hay materiales? Con `withStorage` cuenta también el almacén de la nave. */
  hasItems: (cost: Inventory, withStorage?: boolean) => boolean
  /** Paga un coste: primero de la mochila y, con `withStorage`, el resto del almacén. */
  pay: (cost: Inventory, withStorage?: boolean) => boolean
  /** Guarda en la nave todos los recursos y consumibles de la mochila. */
  storeAll: () => number
  /** Saca del almacén lo que quepa de un objeto. */
  takeFromStorage: (id: ItemId, amount: number) => number
  /** Vuelca TODO el inventario en una caja en esa posición. Devuelve la caja o null si no había nada. */
  dropInventoryBox: (position: [number, number, number]) => DroppedBox | null
  recoverBox: (id: string) => void
  setNearbyBox: (id: string | null) => void
  /** Fabrica una receta si se cumplen materiales, estación y progresión. */
  craft: (recipe: Recipe, atWorkbench: boolean) => boolean
}

const isEmpty = (inv: Inventory) => Object.values(inv).every((n) => !n)

/** ¿Ocupa sitio en la mochila? Herramientas y piezas de la nave no cuentan. */
export const takesSpace = (id: ItemId) => ITEMS[id].kind === 'resource' || ITEMS[id].kind === 'consumable'

/** Carga actual de la mochila. */
export const carriedLoad = (inv: Inventory) =>
  (Object.entries(inv) as [ItemId, number][]).reduce((a, [id, n]) => a + (takesSpace(id) ? n ?? 0 : 0), 0)

/** Mochila + almacén (lo disponible junto a la nave). */
export const withStorage = (inv: Inventory, storage: Inventory): Inventory => {
  const out: Inventory = { ...inv }
  for (const [id, n] of Object.entries(storage) as [ItemId, number][]) out[id] = (out[id] ?? 0) + (n ?? 0)
  return out
}

/** Suma b sobre a respetando el límite de cada objeto y la carga máxima; devuelve [resultado, sobrante]. */
function mergeInventories(a: Inventory, b: Inventory, carry = Infinity): [Inventory, Inventory] {
  const result: Inventory = { ...a }
  const leftover: Inventory = {}
  let free = carry - carriedLoad(a)
  for (const [key, amount] of Object.entries(b) as [ItemId, number][]) {
    if (!amount) continue
    const current = result[key] ?? 0
    let fits = Math.min(amount, ITEMS[key].stack - current)
    if (takesSpace(key)) {
      fits = Math.max(0, Math.min(fits, free))
      free -= fits
    }
    result[key] = current + fits
    if (amount > fits) leftover[key] = amount - fits
  }
  return [result, leftover]
}

export const createInventorySlice: StateCreator<GameState, [], [], InventorySlice> = (set, get) => ({
  inventory: {},
  storage: {},
  droppedBoxes: [],
  nearbyBoxId: null,

  addItem: (id, amount = 1) => {
    const [inventory, leftover] = mergeInventories(get().inventory, { [id]: amount }, upgradeEffects(get().upgrades, !!get().inventory.drone).carry)
    set({ inventory })
    return amount - (leftover[id] ?? 0)
  },

  removeItem: (id, amount = 1) => {
    const current = get().inventory[id] ?? 0
    if (current < amount) return false
    set({ inventory: { ...get().inventory, [id]: current - amount } })
    return true
  },

  hasItems: (cost, useStorage = false) => {
    const s = get()
    const have = useStorage ? withStorage(s.inventory, s.storage) : s.inventory
    return (Object.entries(cost) as [ItemId, number][]).every(([id, n]) => (have[id] ?? 0) >= n)
  },

  pay: (cost, useStorage = false) => {
    const s = get()
    if (!s.hasItems(cost, useStorage)) return false
    const inventory: Inventory = { ...s.inventory }
    const storage: Inventory = { ...s.storage }
    for (const [id, n] of Object.entries(cost) as [ItemId, number][]) {
      const fromBag = Math.min(n, inventory[id] ?? 0)
      inventory[id] = (inventory[id] ?? 0) - fromBag
      if (n > fromBag) storage[id] = (storage[id] ?? 0) - (n - fromBag)
    }
    set({ inventory, storage })
    return true
  },

  storeAll: () => {
    const s = get()
    const inventory: Inventory = { ...s.inventory }
    const storage: Inventory = { ...s.storage }
    let moved = 0
    for (const [id, n] of Object.entries(inventory) as [ItemId, number][]) {
      if (!n || !takesSpace(id)) continue
      storage[id] = (storage[id] ?? 0) + n
      inventory[id] = 0
      moved += n
    }
    set({ inventory, storage })
    return moved
  },

  takeFromStorage: (id, amount) => {
    const s = get()
    const want = Math.min(amount, s.storage[id] ?? 0)
    const [inventory, leftover] = mergeInventories(s.inventory, { [id]: want }, upgradeEffects(s.upgrades, !!s.inventory.drone).carry)
    const got = want - (leftover[id] ?? 0)
    set({ inventory, storage: { ...s.storage, [id]: (s.storage[id] ?? 0) - got } })
    return got
  },

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
    const [merged, leftover] = mergeInventories(inventory, box.items, upgradeEffects(get().upgrades, !!get().inventory.drone).carry)
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
    if (!s.pay(recipe.cost, atWorkbench)) return false
    // Lo fabricado que no cabe en la mochila va al almacén de la nave.
    const [merged, leftover] = mergeInventories(get().inventory, { [recipe.output]: recipe.amount }, upgradeEffects(s.upgrades, !!s.inventory.drone).carry)
    const extra = leftover[recipe.output] ?? 0
    set((st) => ({ inventory: merged, storage: extra ? { ...st.storage, [recipe.output]: (st.storage[recipe.output] ?? 0) + extra } : st.storage }))
    const out = ITEMS[recipe.output]
    if (out.kind === 'tool') get().logJournal({ kind: 'tool', icon: out.icon, title: `Fabricado: ${out.name}`, text: out.description })
    return true
  },
})
