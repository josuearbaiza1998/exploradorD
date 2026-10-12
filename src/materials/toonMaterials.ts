import { createTerrainMaterial } from './terrainMaterial'
import { Color, DoubleSide, MeshToonMaterial, type MeshToonMaterialParameters, type Side } from 'three'
import { PALETTE } from '@/config/palette'
import { toonGradient2, toonGradient3 } from './gradientMap'

/**
 * Fábrica de materiales toon. Centralizar aquí permite:
 *  - Reutilizar instancias (menos cambios de estado en GPU => mejor en móvil).
 *  - Ajustar el estilo de todo el juego desde un único sitio.
 */
export function createToonMaterial(
  params: MeshToonMaterialParameters & { bands?: 2 | 3; flatShading?: boolean } = {},
) {
  const { bands = 3, flatShading = false, ...rest } = params
  const mat = new MeshToonMaterial({
    gradientMap: bands === 2 ? toonGradient2 : toonGradient3,
    ...rest,
  })
  // MeshToonMaterial no declara flatShading en sus tipos, pero el renderer
  // lo respeta: caras facetadas => look lowpoly limpio.
  Object.assign(mat, { flatShading })
  return mat
}

const cache = new Map<string, MeshToonMaterial>()

/** Material toon compartido por color (evita duplicados al instanciar props). */
export function sharedToon(
  color: string,
  opts: { bands?: 2 | 3; emissive?: string; emissiveIntensity?: number; side?: Side; flatShading?: boolean } = {},
) {
  const key = `${color}|${opts.bands ?? 3}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 0}|${opts.side ?? 0}|${opts.flatShading ? 1 : 0}`
  let mat = cache.get(key)
  if (!mat) {
    mat = createToonMaterial({
      color: new Color(color),
      bands: opts.bands,
      flatShading: opts.flatShading,
      ...(opts.side !== undefined ? { side: opts.side } : {}),
      // Solo claves definidas: three avisa si se le pasan valores undefined.
      ...(opts.emissive ? { emissive: new Color(opts.emissive), emissiveIntensity: opts.emissiveIntensity ?? 1 } : {}),
    })
    cache.set(key, mat)
  }
  return mat
}

/** Materiales nombrados del mundo. */
export const MATERIALS = {
  terrain: createTerrainMaterial(),
  shipHull: createToonMaterial({ color: PALETTE.shipHull, flatShading: true }),
  shipAccent: createToonMaterial({ color: PALETTE.shipAccent, flatShading: true }),
  shipDark: createToonMaterial({ color: PALETTE.shipDark, flatShading: true }),
  ember: createToonMaterial({ color: PALETTE.ember, emissive: PALETTE.ember, emissiveIntensity: 1.5 }),
  palmTrunk: createToonMaterial({ color: PALETTE.palmTrunk, flatShading: true }),
  palmLeaf: createToonMaterial({ color: PALETTE.palmLeaf, flatShading: true, side: DoubleSide, bands: 2 }),
  shrubDry: createToonMaterial({ color: PALETTE.shrubDry, flatShading: true, bands: 2 }),
  shrubGreen: createToonMaterial({ color: PALETTE.shrubGreen, flatShading: true, bands: 2 }),
  cactus: createToonMaterial({ color: PALETTE.cactus, flatShading: true }),
  rock: createToonMaterial({ color: PALETTE.sandstoneLight, flatShading: true }),
  rockBand: createToonMaterial({ color: PALETTE.sandstone, flatShading: true }),
  mesa: createToonMaterial({ color: PALETTE.sandstone, flatShading: true }),
  mesaBand: createToonMaterial({ color: PALETTE.sandstoneDark, flatShading: true }),
  deadWood: createToonMaterial({ color: PALETTE.deadWood, flatShading: true, bands: 2 }),
  deadWoodLight: createToonMaterial({ color: PALETTE.deadWoodLight, flatShading: true, bands: 2 }),
  robot: createToonMaterial({ color: PALETTE.robot }),
  robotAccent: createToonMaterial({ color: PALETTE.robotAccent, emissive: PALETTE.robotAccent, emissiveIntensity: 0.6 }),
}

/** Barra de batería en la espalda del robot (su color lo actualiza RobotSystems). */
export const robotBatteryMaterial = createToonMaterial({ color: '#3dff7a', emissive: '#3dff7a', emissiveIntensity: 0.8 })
