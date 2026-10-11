import type { StateCreator } from 'zustand'
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
    if (!atWorkbench || !next || !s.pay(next.cost, true)) return false
    set({ upgrades: { ...s.upgrades, [id]: level + 1 } })
    const def = UPGRADES[id]
    get().logJournal({ kind: 'upgrade', icon: def.icon, title: `${def.name} · nivel ${level + 1}`, text: next.description })
    return true
  },
  toggleNightVision: () => {
    if (!get().upgrades.nightVision) return
    set((s) => ({ nightVisionOn: !s.nightVisionOn }))
  },
})
