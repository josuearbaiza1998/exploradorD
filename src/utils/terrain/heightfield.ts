import {
  CRASH_SITE,
  FLAT_ZONES,
  ISLAND,
  ISLETS,
  LANDMARK_HILLS,
  OASIS,
  WORLD_SEED,
} from '@/config/world'
import { clamp, lerp, smoothstep } from '@/utils/math'
import { fbm2D, ridged2D, valueNoise2D } from '@/utils/noise'

/**
 * Campo de alturas del mundo: una función PURA de (x, z).
 *
 * Es la pieza clave para la escalabilidad: cualquier chunk, la física,
 * el posicionamiento de vegetación o el controlador del personaje
 * consultan la misma función, así que los chunks encajan sin costuras y
 * el terreno puede extenderse infinitamente (basta desactivar ISLAND).
 */

export const OASIS_WATER_LEVEL = 0.6

/** Dunas base orientadas con el viento dominante (estiradas en un eje). */
function dunes(x: number, z: number): number {
  // Rotamos el espacio para alinear las crestas con el viento dominante.
  const a = 0.5
  const u = x * Math.cos(a) - z * Math.sin(a)
  const v = x * Math.sin(a) + z * Math.cos(a)
  const crests = ridged2D(u / 38, v / 14, WORLD_SEED) * 3.2
  const swell = fbm2D(x / 120, z / 120, WORLD_SEED + 7, 3) * 4.5
  const detail = valueNoise2D(x / 6, z / 6, WORLD_SEED + 13) * 0.25
  return crests + swell + detail
}

/** Colinas de la regla del triángulo: huella triangular y cresta afilada. */
function landmarkHills(x: number, z: number): number {
  let h = 0
  for (let i = 0; i < LANDMARK_HILLS.length; i++) {
    const hill = LANDMARK_HILLS[i]
    const dx = x - hill.x
    const dz = z - hill.z
    const d = Math.hypot(dx, dz)
    if (d > hill.radius * 1.2) continue
    // Huella de tres lóbulos => silueta triangular desde casi cualquier ángulo.
    const theta = Math.atan2(dz, dx)
    const rEff = hill.radius * (1 + 0.16 * Math.cos(3 * theta + i * 1.7))
    const t = clamp(1 - d / rEff, 0, 1)
    if (t <= 0) continue
    const rough = 1 + valueNoise2D(x / 9, z / 9, WORLD_SEED + 31 + i) * 0.08
    // max() en vez de suma: las colinas solapadas no se apilan en picos absurdos.
    h = Math.max(h, hill.height * Math.pow(t, hill.ridge) * rough)
  }
  return h
}

/** Surco que dejó la nave al estrellarse: cuenta la historia sin texto. */
function crashTrench(x: number, z: number): number {
  const len = 90
  const dirX = Math.cos(CRASH_SITE.rotation + Math.PI / 2)
  const dirZ = Math.sin(CRASH_SITE.rotation + Math.PI / 2)
  const sx = CRASH_SITE.x - dirX * len
  const sz = CRASH_SITE.z - dirZ * len
  const px = x - sx
  const pz = z - sz
  const along = clamp((px * dirX + pz * dirZ) / len, 0, 1)
  const cx = sx + dirX * along * len
  const cz = sz + dirZ * along * len
  const across = Math.hypot(x - cx, z - cz)
  const width = lerp(2, 9, along)
  const depth = lerp(0.3, 2.2, along)
  return -depth * (1 - smoothstep(0, width, across))
}

/** Altura sin zonas aplanadas (se usa también para fijar la altura de las zonas). */
function rawHeight(x: number, z: number): number {
  let h = 1.5 + dunes(x, z) + landmarkHills(x, z) + crashTrench(x, z)

  // Cuenca del oasis.
  const od = Math.hypot(x - OASIS.x, z - OASIS.z)
  const r = OASIS.radius
  if (od < r * 2) {
    const bowl =
      od < r ? OASIS_WATER_LEVEL - OASIS.depth * (1 - (od / r) ** 2) : OASIS_WATER_LEVEL + 0.4
    h = lerp(bowl, h, smoothstep(r * 0.7, r * 1.9, od))
  }

  // Caída de la isla hacia el mar.
  if (ISLAND.enabled) {
    const d = Math.hypot(x, z)
    const wobble = fbm2D(x / 70, z / 70, WORLD_SEED + 99, 2) * 25
    const mask = 1 - smoothstep(ISLAND.radius - ISLAND.shoreWidth, ISLAND.radius, d + wobble)
    h = lerp(ISLAND.seaLevel - 6, h, mask)
    // Islotes: montículos que asoman del mar.
    for (const it of ISLETS) {
      const id = Math.hypot(x - it.x, z - it.z)
      if (id < it.radius * 1.6) {
        const k = 1 - smoothstep(it.radius * 0.55, it.radius * 1.6, id)
        h = Math.max(h, ISLAND.seaLevel - 6 + (it.height + 6) * k + Math.sin(x * 0.8) * Math.cos(z * 0.6) * 0.25 * k)
      }
    }
  }
  return h
}

const flatZoneHeights = FLAT_ZONES.map((zone) => rawHeight(zone.x, zone.z))

export function getHeight(x: number, z: number): number {
  let h = rawHeight(x, z)
  for (let i = 0; i < FLAT_ZONES.length; i++) {
    const zone = FLAT_ZONES[i]
    const d = Math.hypot(x - zone.x, z - zone.z)
    if (d < zone.radius * 1.6) {
      h = lerp(flatZoneHeights[i], h, smoothstep(zone.radius * 0.6, zone.radius * 1.6, d))
    }
  }
  return h
}

/** Normal aproximada por diferencias finitas (útil para pendientes y colocación). */
export function getSlope(x: number, z: number, e = 1): number {
  const dx = getHeight(x + e, z) - getHeight(x - e, z)
  const dz = getHeight(x, z + e) - getHeight(x, z - e)
  return Math.hypot(dx, dz) / (2 * e) // 0 = plano, 1 = 45°
}

export function isUnderwater(x: number, z: number): boolean {
  const h = getHeight(x, z)
  const od = Math.hypot(x - OASIS.x, z - OASIS.z)
  return h < ISLAND.seaLevel + 0.2 || (od < OASIS.radius * 1.2 && h < OASIS_WATER_LEVEL + 0.15)
}
