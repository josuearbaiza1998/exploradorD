import { CRASH_SITE } from '@/config/world'

/** Radio alrededor de la nave que protege del clima (a sotavento del casco). */
const SHIP_SHELTER_RADIUS = 14

/**
 * ¿Está el robot a cubierto? Hoy solo la nave protege; en la Fase 6 los
 * refugios construidos se añadirán aquí y todo el resto funcionará igual.
 */
export function isSheltered(x: number, z: number): boolean {
  return Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < SHIP_SHELTER_RADIUS
}
