import { Color, Vector3 } from 'three'
import { createSample } from './dayNightPalette'

/**
 * Estado visual del entorno calculado una vez por frame por <DayNightCycle/>
 * y leído por cielo, luces, niebla y props (sin re-renders de React).
 */
export const environment = {
  palette: createSample(),
  /** Dirección hacia el astro activo (sol o luna). */
  lightDir: new Vector3(0.5, 0.8, -0.3),
  isDay: true,
  /** Tinte de clima ya ajustado a la hora (más oscuro de noche). */
  weatherTint: new Color('#ffffff'),
  /** El robot está a cubierto del clima (lo calcula RobotSystems). */
  sheltered: false,
  /** Bruma baja 0..1 (noche y amanecer, la disipa el viento). */
  mist: 0,
  /** Visión nocturna efectiva 0..1 (encendida y de noche). */
  nightVision: 0,
}

/** Intensidad de la bruma según la hora: crece de noche, máxima al amanecer. */
export function mistForHour(h: number): number {
  if (h >= 21) return ((h - 21) / 3) * 0.6
  if (h < 3) return 0.6 + (h / 3) * 0.4
  if (h < 6.5) return 1
  if (h < 8.5) return 1 - (h - 6.5) / 2
  return 0
}
