import { queryColliders } from './physics/staticColliders'

/**
 * Temperatura del robot: el sol del mediodía lo recalienta si no busca
 * sombra; el frío de la noche le gasta más batería. Estado mutable por frame.
 */
export const thermal = {
  /** Calor acumulado 0..1; a 1 se sobrecalienta. */
  heat: 0,
  overheated: false,
  /** Está a la sombra (refugio, nube densa, roca alta o cueva). */
  shade: false,
  /** Multiplicador de consumo por frío (1 = sin efecto). */
  cold: 1,
}

/** Por encima de esta temperatura el sol calienta al robot (°C). */
export const HEAT_FROM = 30
/** Por debajo de esta, el frío gasta más batería (°C). */
export const COLD_FROM = 5

/** ¿Hay una roca, árbol o estructura alta pegada al robot? Da sombra. */
export function tallCoverNear(x: number, z: number): boolean {
  return queryColliders(x, z, 2.5).some((c) => c.h > 2 && Math.hypot(c.x - x, c.z - z) < c.r + 2.2)
}

/** Avanza la temperatura `gameHours` horas de juego. */
export function updateThermal(temp: number, shade: boolean, effort: number, sprinting: boolean, gameHours: number) {
  thermal.shade = shade
  if (temp > HEAT_FROM && !shade) {
    // ~3 h de juego (1 min real) corriendo a pleno sol a 38 °C.
    const rate = ((temp - HEAT_FROM) / 8) * 0.22 * (0.4 + effort + (sprinting ? 0.6 : 0))
    thermal.heat = Math.min(1, thermal.heat + rate * gameHours)
  } else {
    thermal.heat = Math.max(0, thermal.heat - (shade ? 0.9 : 0.5) * gameHours)
  }
  if (thermal.heat >= 1) thermal.overheated = true
  else if (thermal.heat < 0.4) thermal.overheated = false
  thermal.cold = temp < COLD_FROM ? 1 + ((COLD_FROM - temp) / 19) * 0.8 : 1
  return thermal
}
