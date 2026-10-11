import { useMemo } from 'react'
import type { Matrix4, MeshToonMaterial } from 'three'
import { InstancedProp, type PropPart } from '@/components/common/InstancedProp'
import type { ModelId } from '@/assets/models'
import { useVisibleChunks } from '@/hooks/useVisibleChunks'
import { MATERIALS } from '@/materials/toonMaterials'
import { applyWindSway } from '@/materials/windSway'
import { OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'
import { oasisProximity, scatterInChunk, type ScatterRule } from '@/utils/scatter'
import {
  cactusGeometry,
  palmCrownGeometry,
  palmTrunkGeometry,
  rockGeometry,
  shrubGeometry,
  smallTreeGeometry,
} from '@/utils/placeholderGeometry'

// Materiales con balanceo por viento (clones para no afectar a otros usos).
// Material.copy() no conserva flatShading, así que lo reaplicamos.
const toonClone = (m: MeshToonMaterial) => Object.assign(m.clone(), { flatShading: true })
const swayLeaf = applyWindSway(toonClone(MATERIALS.palmLeaf), 0.11)
const swayTrunk = applyWindSway(toonClone(MATERIALS.palmTrunk), 0.025)
const swayShrubDry = applyWindSway(toonClone(MATERIALS.shrubDry), 0.5)
const swayShrubGreen = applyWindSway(toonClone(MATERIALS.shrubGreen), 0.18)
const swayTreeTrunk = applyWindSway(toonClone(MATERIALS.palmTrunk), 0.05)

type Layer = { name: string; model: ModelId; rule: ScatterRule; parts: PropPart[] }

const LAYERS: Layer[] = [
  {
    name: 'palms',
    model: 'palmTree',
    rule: {
      seed: 1,
      cellsPerSide: 10,
      probability: (x, z) => oasisProximity(x, z, 1.9) * 0.9,
      maxSlope: 0.5,
      minHeight: OASIS_WATER_LEVEL + 0.15,
      scale: [0.85, 1.25],
      tilt: 0.12,
    },
    parts: [
      { geometry: palmTrunkGeometry, material: swayTrunk },
      { geometry: palmCrownGeometry, material: swayLeaf },
    ],
  },
  {
    name: 'oasisShrubs',
    model: 'shrub',
    rule: {
      seed: 2,
      cellsPerSide: 16,
      probability: (x, z) => oasisProximity(x, z, 2.3) * 0.8,
      maxSlope: 0.7,
      minHeight: OASIS_WATER_LEVEL + 0.1,
      scale: [0.7, 1.4],
    },
    parts: [{ geometry: shrubGeometry, material: swayShrubGreen }],
  },
  {
    name: 'dryShrubs',
    model: 'shrub',
    rule: {
      seed: 3,
      cellsPerSide: 9,
      probability: (x, z) => 0.22 * (1 - oasisProximity(x, z, 2.5)),
      maxSlope: 0.45,
      maxHeight: 14,
      scale: [0.5, 1.0],
    },
    parts: [{ geometry: shrubGeometry, material: swayShrubDry }],
  },
  {
    // Árboles pequeños: los que el robot podrá romper sin herramientas.
    name: 'smallTrees',
    model: 'smallTree',
    rule: {
      seed: 4,
      cellsPerSide: 6,
      probability: (x, z) => 0.12 + oasisProximity(x, z, 3) * 0.3,
      maxSlope: 0.4,
      maxHeight: 12,
      scale: [0.8, 1.3],
      tilt: 0.1,
    },
    parts: [
      { geometry: smallTreeGeometry.trunk, material: swayTreeTrunk },
      { geometry: smallTreeGeometry.crown, material: swayShrubDry },
    ],
  },
  {
    name: 'cacti',
    model: 'cactus',
    rule: {
      seed: 5,
      cellsPerSide: 6,
      probability: (x, z) => 0.1 * (1 - oasisProximity(x, z, 2.5)),
      maxSlope: 0.4,
      scale: [0.8, 1.5],
    },
    parts: [{ geometry: cactusGeometry, material: MATERIALS.cactus }],
  },
  {
    // Rocas: en la Fase 4 requerirán herramientas para minarse.
    name: 'rocks',
    model: 'rock',
    rule: {
      seed: 6,
      cellsPerSide: 7,
      probability: () => 0.18,
      maxSlope: 1.2,
      scale: [0.6, 2.4],
      tilt: 0.4,
    },
    parts: [{ geometry: rockGeometry, material: MATERIALS.rock }],
  },
]

const cache = new Map<string, Matrix4[]>()

function layerMatrices(layer: Layer, chunks: { cx: number; cz: number; key: string }[]): Matrix4[] {
  const all: Matrix4[] = []
  for (const c of chunks) {
    const k = `${layer.name}|${c.key}`
    let list = cache.get(k)
    if (!list) {
      list = scatterInChunk(c.cx, c.cz, layer.rule)
      cache.set(k, list)
    }
    for (const m of list) all.push(m)
  }
  return all
}

/** Vegetación y rocas instanciadas por capas, distribuidas por chunk. */
export function Vegetation() {
  const chunks = useVisibleChunks()
  const layers = useMemo(
    () => LAYERS.map((layer) => ({ layer, matrices: layerMatrices(layer, chunks) })),
    [chunks],
  )
  return (
    <group name="vegetation">
      {layers.map(({ layer, matrices }) => (
        <InstancedProp key={layer.name} id={layer.model} fallback={layer.parts} matrices={matrices} />
      ))}
    </group>
  )
}
