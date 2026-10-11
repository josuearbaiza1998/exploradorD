import { BUILD_DISTANCE, STRUCTURES, type StructureType } from '@/config/structures'
import { CRASH_SITE } from '@/config/world'
import { getGame } from '@/store/gameStore'
import { queryColliders } from '@/systems/physics/staticColliders'
import { player } from '@/systems/player'
import { getHeight, getSlope, isUnderwater } from '@/utils/terrain/heightfield'

export type PlacementCheck = { x: number; z: number; y: number; ok: boolean; reason: string }

/** Punto de construcción: delante del robot, a BUILD_DISTANCE. */
export function buildSpot(): { x: number; z: number } {
  return {
    x: player.position.x + Math.sin(player.heading) * BUILD_DISTANCE,
    z: player.position.z + Math.cos(player.heading) * BUILD_DISTANCE,
  }
}

/** Valida si una estructura cabe ahí: suelo firme, plano, sin agua ni obstáculos. */
export function checkPlacement(type: StructureType, x: number, z: number): PlacementCheck {
  const def = STRUCTURES[type]
  const y = getHeight(x, z)
  const fail = (reason: string): PlacementCheck => ({ x, z, y, ok: false, reason })

  if (isUnderwater(x, z)) return fail('No se puede construir en el agua')
  if (getSlope(x, z, def.footprint) > 0.35) return fail('El suelo está demasiado inclinado')
  if (Math.hypot(x - CRASH_SITE.x, z - CRASH_SITE.z) < 12) return fail('Demasiado cerca de la nave')
  for (const c of queryColliders(x, z, def.footprint)) {
    if (Math.hypot(c.x - x, c.z - z) < c.r + def.footprint) return fail('Hay algo en medio')
  }
  for (const st of getGame().structures) {
    if (Math.hypot(st.x - x, st.z - z) < STRUCTURES[st.type].footprint + def.footprint) return fail('Hay otra estructura')
  }
  if (!getGame().hasItems(def.cost)) return fail('Faltan materiales')
  return { x, z, y, ok: true, reason: '' }
}
