import { useMemo } from 'react'
import type { Matrix4, MeshToonMaterial } from 'three'
import { InstancedProp, type PropPart } from '@/components/common/InstancedProp'
import { PROP_LAYERS, type PropLayer, type PropLayerId } from '@/config/propLayers'
import { getLayerChunk } from '@/systems/propPlacement'
import { useVisibleChunks } from '@/hooks/useVisibleChunks'
import { MATERIALS } from '@/materials/toonMaterials'
import { applyWindSway } from '@/materials/windSway'
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

const PARTS: Record<PropLayerId, PropPart[]> = {
  palms: [
    { geometry: palmTrunkGeometry, material: swayTrunk },
    { geometry: palmCrownGeometry, material: swayLeaf },
  ],
  oasisShrubs: [{ geometry: shrubGeometry, material: swayShrubGreen }],
  dryShrubs: [{ geometry: shrubGeometry, material: swayShrubDry }],
  smallTrees: [
    { geometry: smallTreeGeometry.trunk, material: swayTreeTrunk },
    { geometry: smallTreeGeometry.crown, material: swayShrubDry },
  ],
  cacti: [{ geometry: cactusGeometry, material: MATERIALS.cactus }],
  rocks: [{ geometry: rockGeometry, material: MATERIALS.rock }],
}

function layerMatrices(layer: PropLayer, chunks: { cx: number; cz: number }[]): Matrix4[] {
  const all: Matrix4[] = []
  for (const c of chunks) for (const m of getLayerChunk(layer, c.cx, c.cz)) all.push(m)
  return all
}

/** Vegetación y rocas instanciadas por capas, distribuidas por chunk. */
export function Vegetation() {
  const chunks = useVisibleChunks()
  const layers = useMemo(
    () => PROP_LAYERS.map((layer) => ({ layer, matrices: layerMatrices(layer, chunks) })),
    [chunks],
  )
  return (
    <group name="vegetation">
      {layers.map(({ layer, matrices }) => (
        <InstancedProp key={layer.id} id={layer.model} fallback={PARTS[layer.id]} matrices={matrices} />
      ))}
    </group>
  )
}
