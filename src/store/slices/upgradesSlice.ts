import type { StateCreator } from 'zustand'
import type { Inventory, ItemId } from '@/config/items'
import { UPGRADES, type UpgradeId, type UpgradeLevels } from '@/config/upgrades'
import type { GameState } from '../gameStore'

export type UpgradesSlice = {
  upgrades: UpgradeLevels
  /** Visión nocturna encendida (solo si está desbloqueada). */
  nightVisionOn: boolean
  /** Compra el siguiente nivel si hay materiales y se está en el banco de la nave. */
  buyUpgrade: (id: UpgradeId, atWorkbench: boolean) => boolean
  toggleNightVision: () => void
}

export const createUpgradesSlice: StateCreator<GameState, [], [], UpgradesSlice> = (set, get) => ({
  upgrades: {},
  nightVisionOn: false,
  buyUpgrade: (id, atWorkbench) => {
    const s = get()
    const level = s.upgrades[id] ?? 0
    const next = UPGRADES[id].levels[level]
    if (!atWorkbench || !next || !s.hasItems(next.cost)) return false
    const inventory: Inventory = { ...s.inventory }
    for (const [item, n] of Object.entries(next.cost) as [ItemId, number][]) inventory[item] = (inventory[item] ?? 0) - n
    set({ inventory, upgrades: { ...s.upgrades, [id]: level + 1 } })
    return true
  },
  toggleNightVision: () => {
    if (!get().upgrades.nightVision) return
    set((s) => ({ nightVisionOn: !s.nightVisionOn }))
  },
})
