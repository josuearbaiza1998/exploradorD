import { useFrame } from '@react-three/fiber'
import { advanceClock, worldClock } from '@/systems/worldClock'
import { celestialDirection, handoverFade, sampleDayNight } from '@/systems/dayNightPalette'
import { environment } from '@/systems/environmentState'
import { updateWind, wind } from '@/systems/wind'
import { windUniforms } from '@/materials/windSway'

/**
 * Sistema sin geometría: avanza el reloj, el viento (y sus uniforms
 * de shader) y recalcula la paleta.
 * Prioridad -1 => se ejecuta antes que los componentes que leen el estado.
 */
export function DayNightCycle() {
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    advanceClock(dt)
    updateWind(dt)
    windUniforms.uTime.value = wind.time
    windUniforms.uWindDir.value.set(wind.dirX, wind.dirZ)
    windUniforms.uWindStrength.value = wind.strength
    sampleDayNight(worldClock.hour, environment.palette)
    environment.isDay = celestialDirection(worldClock.hour, environment.lightDir)
    environment.palette.sunIntensity *= handoverFade(worldClock.hour)
  }, -1)
  return null
}
