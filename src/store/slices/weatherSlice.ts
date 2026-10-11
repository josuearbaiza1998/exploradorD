import type { StateCreator } from 'zustand'
import { WEATHER, WEATHER_TRANSITION_HOURS, weatherWeights, type WeatherId } from '@/config/weather'
import type { GameState } from '../gameStore'

export type WeatherSlice = {
  weather: WeatherId
  /** Estado anterior (para mezclar durante la transición). */
  previousWeather: WeatherId
  /** Hora in-game total en que empezó el estado actual. */
  weatherSince: number
  /** Hora in-game total en que se elegirá el siguiente estado. */
  weatherUntil: number
  /** Comprueba si toca cambiar de clima. */
  tickWeather: () => void
  /** Fuerza un estado (panel de pruebas). */
  setWeather: (id: WeatherId) => void
}

function pickNext(hour: number, current: WeatherId): WeatherId {
  const weights = weatherWeights(hour, current)
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (const [id, w] of Object.entries(weights) as [WeatherId, number][]) {
    roll -= w
    if (roll <= 0) return id
  }
  return 'clear'
}

const randomDuration = (id: WeatherId) => {
  const [min, max] = WEATHER[id].duration
  return min + Math.random() * (max - min)
}

export const createWeatherSlice: StateCreator<GameState, [], [], WeatherSlice> = (set, get) => ({
  weather: 'clear',
  previousWeather: 'clear',
  weatherSince: 0,
  weatherUntil: 8.5 + randomDuration('clear'),

  tickWeather: () => {
    const { totalHours, weatherUntil, weather } = get()
    if (totalHours < weatherUntil) return
    const next = pickNext(totalHours % 24, weather)
    set({
      previousWeather: weather,
      weather: next,
      weatherSince: totalHours,
      weatherUntil: totalHours + randomDuration(next),
    })
  },

  setWeather: (id) => {
    const { totalHours, weather } = get()
    set({
      previousWeather: weather,
      weather: id,
      // Transición casi inmediata al forzarlo desde el panel.
      weatherSince: totalHours - WEATHER_TRANSITION_HOURS * 0.8,
      weatherUntil: totalHours + randomDuration(id),
    })
  },
})
