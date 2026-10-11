/**
 * Reloj del mundo (hora in-game).
 *
 * TEMPORAL: en la Fase 3 este estado se moverá a la tienda de Zustand
 * (para que la batería, la recarga en la nave y la temperatura lean de
 * la misma fuente). Se mantiene como objeto mutable para no provocar
 * re-renders de React en cada frame.
 */
export const DAY_LENGTH_SECONDS = 480 // 8 minutos reales = 24 h in-game

export const worldClock = {
  /** Hora in-game en [0, 24). */
  hour: 8.5,
  /** Multiplicador de velocidad (útil para depurar el ciclo). */
  speed: 1,
  paused: false,
  day: 1,
}

export function advanceClock(delta: number) {
  if (worldClock.paused) return
  worldClock.hour += (delta * worldClock.speed * 24) / DAY_LENGTH_SECONDS
  if (worldClock.hour >= 24) {
    worldClock.hour -= 24
    worldClock.day += 1
  }
}

/** Temperatura ambiente aproximada (°C): calor de día, frío fuerte de noche. */
export function ambientTemperature(hour: number): number {
  // Mínima ~5:00, máxima ~15:00.
  const t = Math.cos(((hour - 15) / 24) * Math.PI * 2)
  return 12 + t * 26 // de -14 °C a 38 °C
}
