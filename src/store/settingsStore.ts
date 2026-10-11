import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QualityLevel = 'low' | 'medium' | 'high'
export type QualityMode = 'auto' | QualityLevel

/** Lo que cambia cada nivel de calidad. */
export const QUALITY: Record<QualityLevel, { dpr: [number, number]; shadows: boolean; shadowMap: number; viewRadius: number; extras: boolean; label: string }> = {
  low: { dpr: [0.7, 1], shadows: false, shadowMap: 512, viewRadius: 3, extras: false, label: 'Baja' },
  medium: { dpr: [1, 1.25], shadows: true, shadowMap: 1024, viewRadius: 4, extras: true, label: 'Media' },
  high: { dpr: [1, 1.5], shadows: true, shadowMap: 2048, viewRadius: 5, extras: true, label: 'Alta' },
}

const ORDER: QualityLevel[] = ['low', 'medium', 'high']

/**
 * Ajustes del jugador (fuera de la partida: sobreviven a "Reiniciar").
 * En modo automático el nivel baja o sube según los fps medidos.
 */
export const useSettings = create<{
  mode: QualityMode
  /** Nivel que decide el modo automático. */
  autoLevel: QualityLevel
  setMode: (m: QualityMode) => void
  /** Minimapa visible en el HUD. */
  minimap: boolean
  setMinimap: (on: boolean) => void
  stepAuto: (dir: -1 | 1) => void
}>()(
  persist(
    (set, get) => ({
      mode: 'auto',
      autoLevel: 'high',
      setMode: (mode) => set({ mode }),
      minimap: true,
      setMinimap: (minimap) => set({ minimap }),
      stepAuto: (dir) => {
        const i = ORDER.indexOf(get().autoLevel) + dir
        if (i >= 0 && i < ORDER.length) set({ autoLevel: ORDER[i] })
      },
    }),
    { name: 'exploradord-settings' },
  ),
)

export const qualityLevel = (s: { mode: QualityMode; autoLevel: QualityLevel }): QualityLevel => (s.mode === 'auto' ? s.autoLevel : s.mode)
export const useQuality = () => QUALITY[useSettings((s) => qualityLevel(s))]
export const getQuality = () => QUALITY[qualityLevel(useSettings.getState())]

/** FPS medidos (los escribe el monitor, los lee el menú). */
export const perfStats = { fps: 0 }
