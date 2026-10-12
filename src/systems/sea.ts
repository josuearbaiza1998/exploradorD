import { ISLAND } from '@/config/world'
import { wind } from '@/systems/wind'
import { weatherState } from '@/systems/weatherState'

/**
 * Olas del mar (las mismas en el shader y en la CPU, para que lo que flota
 * o el robot que entra al agua coincidan con lo que se ve). El oasis no tiene.
 */
export const seaState = {
  time: 0,
  /** Amplitud actual (m): crece con el viento y las tormentas. */
  amp: 0.2,
}

export function updateSea(dt: number) {
  seaState.time += dt
  const target = 0.2 + wind.strength * 0.35 + weatherState.lightning * 0.15
  seaState.amp += (target - seaState.amp) * Math.min(1, dt * 0.3)
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** Mar adentro el oleaje crece (lejos de la isla las olas son más grandes). */
export const openSea = (x: number, z: number) => smooth(220, 430, Math.hypot(x, z))

/** Altura de la ola en (x, z) sin contar la atenuación junto a la orilla. */
export function waveHeight(x: number, z: number, t = seaState.time, amp = seaState.amp) {
  return (
    amp *
    (1 + openSea(x, z) * 1.4) *
    (Math.sin(x * 0.11 + z * 0.05 + t * 0.9) * 0.6 +
      Math.sin(x * -0.04 + z * 0.13 + t * 0.7) * 0.4 +
      Math.sin((x + z) * 0.23 + t * 1.6) * 0.15)
  )
}

/** Nivel del mar con olas en ese punto. */
export const seaSurface = (x: number, z: number) => ISLAND.seaLevel + waveHeight(x, z)

/** GLSL equivalente a `waveHeight` (para el vértice del mar). */
export const WAVE_GLSL = /* glsl */ `
  float openSea(vec2 p) { return smoothstep(220.0, 430.0, length(p)); }
  float waveHeight(vec2 p, float t, float amp) {
    return amp * (1.0 + openSea(p) * 1.4) * (sin(p.x * 0.11 + p.y * 0.05 + t * 0.9) * 0.6
      + sin(p.x * -0.04 + p.y * 0.13 + t * 0.7) * 0.4
      + sin((p.x + p.y) * 0.23 + t * 1.6) * 0.15);
  }
`
