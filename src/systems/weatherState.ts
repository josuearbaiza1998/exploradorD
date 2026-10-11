import { Color } from 'three'
import { WEATHER, WEATHER_TRANSITION_HOURS, type WeatherDef, type WeatherId } from '@/config/weather'
import { smoothstep } from '@/utils/math'

/**
 * Parámetros de clima MEZCLADOS entre el estado anterior y el actual.
 * Lo calcula <WeatherSystem/> una vez por frame; lo leen luces, niebla,
 * cielo, partículas, el robot y la batería (sin re-renders).
 */
export const weatherState = {
  current: 'clear' as WeatherId,
  /** 0 = aún es el estado anterior, 1 = transición completa. */
  blend: 1,
  wind: WEATHER.clear.wind,
  fogNear: WEATHER.clear.fogNear,
  fogFar: WEATHER.clear.fogFar,
  tint: new Color('#ffffff'),
  tintAmount: 0,
  sun: 1,
  solar: 1,
  dirtPerHour: 0,
  washPerHour: 0,
  drain: 1,
  speed: 1,
  dust: WEATHER.clear.dust,
  rain: 0,
  lightning: 0,
  /** Destello de rayo 0..1 (lo pone <Lightning/>, lo leen luces y cielo). */
  flash: 0,
}

const tintA = new Color()
const tintB = new Color()
const NUMERIC: (keyof WeatherDef & keyof typeof weatherState)[] = [
  'wind', 'fogNear', 'fogFar', 'sun', 'solar', 'dirtPerHour', 'washPerHour', 'drain', 'speed', 'dust', 'rain', 'lightning',
]

export function updateWeatherState(previous: WeatherId, current: WeatherId, since: number, totalHours: number) {
  const a = WEATHER[previous]
  const b = WEATHER[current]
  const t = smoothstep(0, WEATHER_TRANSITION_HOURS, totalHours - since)
  weatherState.current = current
  weatherState.blend = t
  for (const key of NUMERIC) {
    ;(weatherState[key] as number) = (a[key] as number) + ((b[key] as number) - (a[key] as number)) * t
  }
  // El tinte se mezcla con su intensidad (un estado sin tinte aporta 0).
  const amountA = a.tint ? a.tintAmount : 0
  const amountB = b.tint ? b.tintAmount : 0
  tintA.set(a.tint ?? b.tint ?? '#ffffff')
  tintB.set(b.tint ?? a.tint ?? '#ffffff')
  weatherState.tint.copy(tintA).lerp(tintB, t)
  weatherState.tintAmount = amountA + (amountB - amountA) * t
}
