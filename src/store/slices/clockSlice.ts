import type { StateCreator } from 'zustand'
import type { GameState } from '../gameStore'

/** 8 minutos reales = 24 h in-game. */
export const DAY_LENGTH_SECONDS = 480
const START_HOUR = 8.5

export type ClockSlice = {
  /** Horas in-game totales desde el inicio de la partida (no se reinicia a medianoche). */
  totalHours: number
  /** Multiplicador elegido por el jugador/depuración. */
  timeSpeed: number
  /** Multiplicador forzado por el juego (p. ej. durante la recarga). */
  timeBoost: number
  paused: boolean
  advanceClock: (realDelta: number) => void
  setHourOfDay: (hour: number) => void
  setTimeSpeed: (speed: number) => void
  togglePause: () => void
}

export const createClockSlice: StateCreator<GameState, [], [], ClockSlice> = (set, get) => ({
  totalHours: START_HOUR,
  timeSpeed: 1,
  timeBoost: 1,
  paused: false,
  advanceClock: (realDelta) => {
    const s = get()
    if (s.paused) return
    set({ totalHours: s.totalHours + (realDelta * s.timeSpeed * s.timeBoost * 24) / DAY_LENGTH_SECONDS })
  },
  setHourOfDay: (hour) => {
    const day = Math.floor(get().totalHours / 24)
    set({ totalHours: day * 24 + hour })
  },
  setTimeSpeed: (timeSpeed) => set({ timeSpeed }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
})

/** Hora del día [0, 24). */
export const hourOfDay = (totalHours: number) => ((totalHours % 24) + 24) % 24
/** Día de la partida, empezando en 1. */
export const dayNumber = (totalHours: number) => Math.floor(totalHours / 24) + 1
/** Convierte segundos reales a horas in-game con la velocidad actual. */
export const realToGameHours = (realDelta: number, s: Pick<ClockSlice, 'timeSpeed' | 'timeBoost' | 'paused'>) =>
  s.paused ? 0 : (realDelta * s.timeSpeed * s.timeBoost * 24) / DAY_LENGTH_SECONDS
