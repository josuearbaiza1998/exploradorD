import type { StateCreator } from 'zustand'
import type { HarvestKind } from '@/config/harvest'
import type { GameState } from '../gameStore'

/** Objetivo de interacción actual (lo calcula el sistema de interacción cada frame). */
export type InteractionTarget = {
  key: string
  kind: HarvestKind
  position: [number, number, number]
  /** Radio aproximado del objeto (para el anillo de selección). */
  radius: number
}

export type WorldSlice = {
  /** Recursos recolectados: clave → hora in-game en que reaparece (-1 = nunca). */
  harvested: Record<string, number>
  /** Usos restantes de los puntos de chatarra de la nave. */
  salvageUses: Record<string, number>
  /** Golpes acumulados sobre cada objetivo (no se guarda). */
  hits: Record<string, number>
  target: InteractionTarget | null
  /** Último aviso de recolección/crafteo ("+2 🪵 Madera"). */
  notice: { id: number; text: string; tone: 'gain' | 'info' | 'warn' } | null

  setTarget: (t: InteractionTarget | null) => void
  addHit: (key: string) => number
  markHarvested: (key: string, regrowAt: number) => void
  resetHits: (key: string) => void
  setSalvageUses: (id: string, uses: number) => void
  /** Elimina los recursos que ya han vuelto a crecer. Devuelve si cambió algo. */
  sweepRegrown: () => boolean
  notify: (text: string, tone?: 'gain' | 'info' | 'warn') => void
}

let noticeId = 0

export const createWorldSlice: StateCreator<GameState, [], [], WorldSlice> = (set, get) => ({
  harvested: {},
  salvageUses: {},
  hits: {},
  target: null,
  notice: null,

  setTarget: (target) => {
    const current = get().target
    if (current?.key === target?.key) return
    set({ target })
  },

  addHit: (key) => {
    const n = (get().hits[key] ?? 0) + 1
    set({ hits: { ...get().hits, [key]: n } })
    return n
  },

  markHarvested: (key, regrowAt) => {
    const { [key]: _, ...hits } = get().hits
    void _
    set({ harvested: { ...get().harvested, [key]: regrowAt }, hits, target: null })
  },

  resetHits: (key) => {
    const { [key]: _, ...hits } = get().hits
    void _
    set({ hits })
  },

  setSalvageUses: (id, uses) => set({ salvageUses: { ...get().salvageUses, [id]: uses } }),

  sweepRegrown: () => {
    const { harvested, totalHours } = get()
    let changed = false
    const next: Record<string, number> = {}
    for (const [key, at] of Object.entries(harvested)) {
      if (at !== -1 && at <= totalHours) changed = true
      else next[key] = at
    }
    if (changed) set({ harvested: next })
    return changed
  },

  notify: (text, tone = 'gain') => set({ notice: { id: ++noticeId, text, tone } }),
})

/** ¿Está recolectado ahora mismo? (consulta barata para render y colisiones). */
export function isHarvested(harvested: Record<string, number>, key: string): boolean {
  return key in harvested
}
