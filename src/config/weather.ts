/**
 * Estados del clima. No son solo visuales: cada uno cambia viento,
 * visibilidad, carga solar, suciedad de sensores, consumo y velocidad.
 */
export type WeatherId = 'clear' | 'windy' | 'sandstorm' | 'rain'

export type WeatherDef = {
  label: string
  /** Fuerza base del viento 0..1. */
  wind: number
  /** Distancia de niebla (m): cerca / lejos. */
  fogNear: number
  fogFar: number
  /** Tinte del cielo y la niebla (null = colores del ciclo día/noche). */
  tint: string | null
  /** Cuánto del tinte se aplica (0..1). */
  tintAmount: number
  /** Multiplicador de la luz del sol (sombras más suaves con nubes/polvo). */
  sun: number
  /** Multiplicador de la carga solar. */
  solar: number
  /** Suciedad de sensores por hora (también quieto). */
  dirtPerHour: number
  /** Limpieza de sensores por hora (la lluvia lava el polvo). */
  washPerHour: number
  /** Multiplicador de consumo de batería. */
  drain: number
  /** Multiplicador de velocidad de movimiento. */
  speed: number
  /** Densidad de partículas de polvo y lluvia (0..1). */
  dust: number
  rain: number
  /** Duración en horas in-game [min, max]. */
  duration: [number, number]
}

export const WEATHER: Record<WeatherId, WeatherDef> = {
  clear: {
    label: 'Despejado',
    wind: 0.3, fogNear: 160, fogFar: 520, tint: null, tintAmount: 0,
    sun: 1, solar: 1, dirtPerHour: 0, washPerHour: 0, drain: 1, speed: 1,
    dust: 0.08, rain: 0, duration: [5, 10],
  },
  windy: {
    label: 'Ventoso',
    wind: 0.65, fogNear: 110, fogFar: 380, tint: '#e8b878', tintAmount: 0.25,
    sun: 0.9, solar: 0.85, dirtPerHour: 0.02, washPerHour: 0, drain: 1.1, speed: 0.95,
    dust: 0.45, rain: 0, duration: [2, 5],
  },
  sandstorm: {
    label: 'Tormenta de arena',
    wind: 1, fogNear: 6, fogFar: 70, tint: '#c98a46', tintAmount: 0.85,
    sun: 0.35, solar: 0.15, dirtPerHour: 0.22, washPerHour: 0, drain: 1.4, speed: 0.75,
    dust: 1, rain: 0, duration: [1.5, 3.5],
  },
  rain: {
    label: 'Lluvia torrencial',
    wind: 0.55, fogNear: 20, fogFar: 150, tint: '#5d6b80', tintAmount: 0.7,
    sun: 0.4, solar: 0.25, dirtPerHour: 0, washPerHour: 0.35, drain: 1.3, speed: 0.8,
    dust: 0, rain: 1, duration: [1, 3],
  },
}

/** Horas in-game que dura la transición entre dos estados (se nota venir). */
export const WEATHER_TRANSITION_HOURS = 0.75

/**
 * Probabilidad relativa del siguiente estado. Las tormentas de arena son
 * más probables por la tarde (calor), la lluvia de madrugada/noche.
 */
export function weatherWeights(hour: number, current: WeatherId): Record<WeatherId, number> {
  const afternoon = hour > 12 && hour < 19
  const night = hour < 6 || hour > 21
  const w: Record<WeatherId, number> = {
    clear: 5,
    windy: 2.5,
    sandstorm: afternoon ? 2 : 0.7,
    rain: night ? 1.2 : 0.5,
  }
  // Una tormenta casi siempre llega precedida de viento (y se va calmando).
  if (current === 'clear') w.sandstorm *= 0.3
  if (current === 'windy') w.sandstorm *= 2.5
  if (current === 'sandstorm') w.sandstorm = 0
  if (current === 'rain') w.rain = 0
  return w
}
