import { useFrame } from '@react-three/fiber'
import { getGame } from '@/store/gameStore'
import { hourOfDay } from '@/store/slices/clockSlice'
import { celestialDirection, handoverFade, sampleDayNight } from '@/systems/dayNightPalette'
import { mistForHour, environment } from '@/systems/environmentState'
import { updateWind, wind } from '@/systems/wind'
import { windUniforms } from '@/materials/windSway'
import { updateWeatherState, weatherState } from '@/systems/weatherState'

/**
 * Sistema sin geometría: avanza el reloj, el clima, el viento (y sus
 * uniforms de shader) y recalcula la paleta.
 * Prioridad -1 => se ejecuta antes que los componentes que leen el estado.
 */
export function DayNightCycle() {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    getGame().advanceClock(dt)
    const game = getGame()
    const hour = hourOfDay(game.totalHours)

    // Clima: decidir cambios y mezclar parámetros antes que el viento y la luz.
    game.tickWeather()
    updateWeatherState(game.previousWeather, game.weather, game.weatherSince, game.totalHours)
    wind.baseStrength = weatherState.wind

    updateWind(dt)
    windUniforms.uTime.value = wind.time
    windUniforms.uWindDir.value.set(wind.dirX, wind.dirZ)
    windUniforms.uWindStrength.value = wind.strength
    sampleDayNight(hour, environment.palette)
    environment.isDay = celestialDirection(hour, environment.lightDir)
    environment.palette.sunIntensity *= handoverFade(hour) * weatherState.sun
    // Con polvo o nubes la luz se difunde: menos sol directo, algo más de ambiente.
    environment.palette.ambient *= 1 + (1 - weatherState.sun) * 0.8
    // Bruma: el viento fuerte y la arena en suspensión la deshacen.
    environment.mist =
      mistForHour(hour) * Math.max(0, 1 - Math.max(0, weatherState.wind - 0.4) * 2) * (1 - Math.min(1, weatherState.dust))
    environment.weatherTint.copy(weatherState.tint).multiplyScalar(0.2 + 0.8 * environment.palette.daylight)
  }, -1)
  return null
}
