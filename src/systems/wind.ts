/**
 * Viento global. Un solo origen de verdad para vegetación, humo y, en
 * fases posteriores, el polvo, las tormentas de arena y el sucio de sensores.
 */
export const wind = {
  /** Dirección dominante (radianes, plano XZ). */
  direction: 0.5,
  /** Fuerza base 0..1. */
  baseStrength: 0.35,
  /** Fuerza actual con ráfagas (se actualiza cada frame). */
  strength: 0.35,
  dirX: Math.cos(0.5),
  dirZ: Math.sin(0.5),
  time: 0,
}

export function updateWind(delta: number) {
  wind.time += delta
  const t = wind.time
  const gust = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 1.3) * 0.3 + Math.sin(t * 0.13) * 0.4
  wind.strength = Math.max(0.05, wind.baseStrength * (1 + gust * 0.6))
  const dir = wind.direction + Math.sin(t * 0.05) * 0.25
  wind.dirX = Math.cos(dir)
  wind.dirZ = Math.sin(dir)
}
