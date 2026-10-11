import { STRUCTURES } from '@/config/structures'
import { CRASH_SITE } from '@/config/world'
import { getGame } from '@/store/gameStore'

/** Radio alrededor de la nave que protege del clima (a sotavento del casco). */
const SHIP_SHELTER_RADIUS = 14

/** ¿Está el robot a cubierto? La nave y los refugios construidos protegen del clima y del frío. */
export function isSheltered(x: number, z: number): boolean {
  if (Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < SHIP_SHELTER_RADIUS) return true
  for (const st of getGame().structures) {
    const r = STRUCTURES[st.type].shelterRadius
    if (r && Math.hypot(x - st.x, z - st.z) < r) return true
  }
  return false
}
