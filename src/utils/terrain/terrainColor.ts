import { Color } from 'three'
import { PALETTE } from '@/config/palette'
import { isClimbWall, ISLAND, OASIS, WORLD_SEED } from '@/config/world'
import { smoothstep } from '@/utils/math'
import { valueNoise2D } from '@/utils/noise'
import { OASIS_WATER_LEVEL } from './heightfield'

const c = {
  sandLight: new Color(PALETTE.sandLight),
  sand: new Color(PALETTE.sand),
  sandDark: new Color(PALETTE.sandDark),
  rock: new Color(PALETTE.rockRed),
  rockDark: new Color(PALETTE.rockDark),
  wet: new Color(PALETTE.wetSand),
  grass: new Color(PALETTE.oasisGrass),
}
const tmp = new Color()

/**
 * Color por vértice: arena con matices, roca roja en pendientes y cumbres,
 * arena húmeda en la orilla y un anillo verde brillante alrededor del oasis.
 * Se usa con MeshToonMaterial(vertexColors) => cero texturas.
 */
export function terrainColor(x: number, y: number, z: number, slope: number, out: Color): Color {
  const n = valueNoise2D(x / 18, z / 18, WORLD_SEED + 55)
  out.copy(c.sand).lerp(n > 0 ? c.sandLight : c.sandDark, Math.abs(n) * 0.8)

  // Roca en laderas empinadas y en lo alto de las colinas guía.
  const rockiness = Math.max(smoothstep(0.55, 0.95, slope), smoothstep(16, 30, y) * 0.85)
  if (rockiness > 0) {
    tmp.copy(c.rock).lerp(c.rockDark, smoothstep(0.9, 1.4, slope))
    out.lerp(tmp, rockiness)
  }

  // Paredes escalables: roca oscura con estratos horizontales, se reconocen de lejos.
  if (isClimbWall(x, z, y, slope)) {
    const band = Math.sin(y * 0.9 + n * 2) > 0.3 ? 0.55 : 0.85
    out.copy(c.rockDark).multiplyScalar(band + 0.15)
  }

  // Orilla del mar.
  out.lerp(c.wet, 1 - smoothstep(ISLAND.seaLevel + 0.2, ISLAND.seaLevel + 1.5, y))

  // Oasis: hierba vibrante => contraste fuerte con el desierto.
  const od = Math.hypot(x - OASIS.x, z - OASIS.z)
  const green = (1 - smoothstep(OASIS.radius * 1.05, OASIS.radius * 1.55, od + n * 4)) *
    smoothstep(OASIS_WATER_LEVEL - 0.2, OASIS_WATER_LEVEL + 0.3, y)
  if (green > 0) out.lerp(c.grass, green)
  if (od < OASIS.radius * 1.1 && y < OASIS_WATER_LEVEL + 0.2) out.lerp(c.wet, 0.7)

  return out
}
