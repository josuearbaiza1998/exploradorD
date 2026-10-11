/**
 * Utilidades de tiempo/clima derivadas de la hora del día.
 * El estado del reloj vive en la tienda de Zustand (store/slices/clockSlice.ts).
 */

/** Temperatura ambiente aproximada (°C): calor de día, frío fuerte de noche. */
export function ambientTemperature(hour: number): number {
  // Mínima ~3:00, máxima ~15:00.
  const t = Math.cos(((hour - 15) / 24) * Math.PI * 2)
  return 12 + t * 26 // de -14 °C a 38 °C
}
