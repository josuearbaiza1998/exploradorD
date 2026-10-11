import { Vector3 } from 'three'
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
}
