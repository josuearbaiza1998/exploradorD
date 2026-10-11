/**
 * Estados del clima. No son solo visuales: cada uno cambia viento,
 * visibilidad, carga solar, suciedad de sensores, consumo y velocidad.
 */
export type WeatherId = 'clear' | 'windy' | 'sandstorm' | 'drizzle' | 'rain' | 'storm'

/** Estados con lluvia (riegan el oasis, enfrían y lavan los sensores). */
export const RAINY: WeatherId[] = ['drizzle', 'rain', 'storm']

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
  /** Rayos por minuto real (0 = ninguno). */
  lightning: number
  /** Duración en horas in-game [min, max]. */
  duration: [number, number]
}

export const WEATHER: Record<WeatherId, WeatherDef> = {
  clear: {
    label: 'Despejado',
    wind: 0.3, fogNear: 160, fogFar: 520, tint: null, tintAmount: 0,
    sun: 1, solar: 1, dirtPerHour: 0, washPerHour: 0, drain: 1, speed: 1,
    dust: 0.08, rain: 0, lightning: 0, duration: [5, 10],
  },
  windy: {
    label: 'Ventoso',
    wind: 0.65, fogNear: 110, fogFar: 380, tint: '#e8b878', tintAmount: 0.25,
    sun: 0.9, solar: 0.85, dirtPerHour: 0.02, washPerHour: 0, drain: 1.1, speed: 0.95,
    dust: 0.45, rain: 0, lightning: 0, duration: [2, 5],
  },
  sandstorm: {
    label: 'Tormenta de arena',
    wind: 1, fogNear: 6, fogFar: 70, tint: '#c98a46', tintAmount: 0.85,
    sun: 0.35, solar: 0.15, dirtPerHour: 0.22, washPerHour: 0, drain: 1.4, speed: 0.75,
    dust: 1, rain: 0, lightning: 0, duration: [1.5, 3.5],
  },
  drizzle: {
    label: 'Llovizna',
    wind: 0.4, fogNear: 60, fogFar: 300, tint: '#8a96a8', tintAmount: 0.45,
    sun: 0.65, solar: 0.6, dirtPerHour: 0, washPerHour: 0.15, drain: 1.1, speed: 0.95,
    dust: 0, rain: 0.35, lightning: 0, duration: [1.5, 3.5],
  },
  rain: {
    label: 'Lluvia torrencial',
    wind: 0.7, fogNear: 20, fogFar: 150, tint: '#5d6b80', tintAmount: 0.7,
    sun: 0.4, solar: 0.25, dirtPerHour: 0, washPerHour: 0.35, drain: 1.3, speed: 0.8,
    dust: 0, rain: 1, lightning: 1.5, duration: [1, 3],
  },
  storm: {
    label: 'Tormenta eléctrica',
    wind: 0.95, fogNear: 14, fogFar: 120, tint: '#3f4a5e', tintAmount: 0.85,
    sun: 0.25, solar: 0.1, dirtPerHour: 0, washPerHour: 0.4, drain: 1.45, speed: 0.72,
    dust: 0, rain: 1, lightning: 7, duration: [1, 2.5],
  },
}

/** Horas in-game que dura la transición entre dos estados (se nota venir). */
export const WEATHER_TRANSITION_HOURS = 0.75

/**
 * Probabilidad relativa del siguiente estado. Las tormentas de arena son
 * más probables por la tarde (calor), la lluvia de madrugada/noche.
 * `dryHours`: horas sin llover; cuanto más dura la sequía, más probable la
 * lluvia (así no pasan días enteros sin ver una gota).
 */
export function weatherWeights(hour: number, current: WeatherId, dryHours = 0): Record<WeatherId, number> {
  const afternoon = hour > 12 && hour < 19
  const night = hour < 6 || hour > 21
  const thirst = 1 + Math.min(4, Math.max(0, dryHours - 6) / 8)
  const w: Record<WeatherId, number> = {
    clear: 5,
    windy: 2.5,
    sandstorm: afternoon ? 2 : 0.7,
    drizzle: (night ? 1.6 : 0.9) * thirst,
    rain: (night ? 1.1 : 0.6) * thirst,
    storm: (afternoon ? 0.4 : 0.25) * thirst,
  }
  // Una tormenta casi siempre llega precedida de viento (y se va calmando).
  if (current === 'clear') w.sandstorm *= 0.3
  if (current === 'windy') w.sandstorm *= 2.5
  // La lluvia va a más: llovizna → aguacero → tormenta eléctrica, y luego amaina.
  if (current === 'drizzle') {
    w.rain *= 3
    w.storm *= 2
  }
  if (current === 'rain') w.storm *= 3
  if (current === 'storm') w.drizzle *= 2
  // Se puede seguir despejado; los demás estados no se repiten seguidos.
  if (current !== 'clear') w[current] = 0
  return w
}
