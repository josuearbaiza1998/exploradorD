import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import { ecology } from '@/systems/ecology'
import { PALETTE } from '@/config/palette'
import type { BufferGeometry, Matrix4, MeshToonMaterial } from 'three'
import { InstancedProp, type PropPart } from '@/components/common/InstancedProp'
import { PROP_LAYERS, type PropLayer, type PropLayerId } from '@/config/propLayers'
import { getLayerChunk } from '@/systems/propPlacement'
import { propKey } from '@/systems/interaction/interactables'
import { useGameStore } from '@/store/gameStore'
import { useVisibleChunks } from '@/hooks/useVisibleChunks'
import { isChunkReady, useChunkVersion } from '@/systems/chunkStreamer'
import { MATERIALS } from '@/materials/toonMaterials'
import { applyWindSway } from '@/materials/windSway'
import { ensureOutlineNormals, outlineMaterial } from '@/materials/outline'
import {
  cactusGeometry,
  palmCrownGeometry,
  palmTrunkGeometry,
  mesaRockGeometry,
  oasisShrubGeometry,
  rockGeometry,
  shrubGeometry,
  smallTreeGeometry,
} from '@/utils/placeholderGeometry'

// Materiales con balanceo por viento (clones para no afectar a otros usos).
// Material.copy() no conserva flatShading, así que lo reaplicamos.
const toonClone = (m: MeshToonMaterial) => Object.assign(m.clone(), { flatShading: true })
const swayLeaf = applyWindSway(toonClone(MATERIALS.palmLeaf), 0.06)
const swayTrunk = applyWindSway(toonClone(MATERIALS.palmTrunk), 0.06)
const swayShrubDry = applyWindSway(toonClone(MATERIALS.deadWoodLight), 0.35)
const swayShrubGreen = applyWindSway(toonClone(MATERIALS.shrubGreen), 0.18)
// Tronco y copa de un mismo árbol comparten flexión: si no, la copa se separa con viento fuerte.
const swayTreeTrunk = applyWindSway(toonClone(MATERIALS.deadWood), 0.09)
const swayTreeCrown = applyWindSway(toonClone(MATERIALS.deadWood), 0.09)

// Color de las plantas según la humedad: verdes tras la lluvia, pajizas en sequía.
const GREEN = { shrub: new Color(PALETTE.shrubGreen), leaf: new Color(PALETTE.palmLeaf) }
const DRY = new Color('#b9a25a')
const LUSH = new Color('#4fae4a')
function tintPlants(moisture: number) {
  const dry = Math.max(0, 0.45 - moisture) / 0.45
  const lush = Math.max(0, moisture - 0.6) / 0.4
  swayShrubGreen.color.copy(GREEN.shrub).lerp(DRY, dry * 0.7).lerp(LUSH, lush * 0.5)
  swayLeaf.color.copy(GREEN.leaf).lerp(DRY, dry * 0.45).lerp(LUSH, lush * 0.35)
}

/** Contorno de cómic para props instanciados grandes (rocas, mesas). */
const outlined = (geometries: BufferGeometry[], thickness: number): PropPart[] =>
  geometries.map((g) => ({ geometry: ensureOutlineNormals(g), material: outlineMaterial(thickness), castShadow: false }))

const PARTS: Record<PropLayerId, PropPart[]> = {
  palms: [
    { geometry: palmTrunkGeometry, material: swayTrunk },
    { geometry: palmCrownGeometry, material: swayLeaf },
  ],
  oasisShrubs: [{ geometry: oasisShrubGeometry, material: swayShrubGreen }],
  dryShrubs: [{ geometry: shrubGeometry, material: swayShrubDry }],
  smallTrees: [
    { geometry: smallTreeGeometry.trunk, material: swayTreeTrunk },
    { geometry: smallTreeGeometry.crown, material: swayTreeCrown },
  ],
  cacti: [{ geometry: cactusGeometry, material: MATERIALS.cactus }, ...outlined([cactusGeometry], 0.035)],
  rocks: [
    { geometry: rockGeometry[0], material: MATERIALS.rock },
    { geometry: rockGeometry[1], material: MATERIALS.rockBand },
    ...outlined(rockGeometry, 0.05),
  ],
  mesas: [
    { geometry: mesaRockGeometry[0], material: MATERIALS.mesa },
    { geometry: mesaRockGeometry[1], material: MATERIALS.mesaBand },
    ...outlined(mesaRockGeometry, 0.08),
  ],
}

function layerMatrices(
  layer: PropLayer,
  chunks: { cx: number; cz: number }[],
  harvested: Record<string, number>,
): Matrix4[] {
  const all: Matrix4[] = []
  for (const c of chunks) {
    const list = getLayerChunk(layer, c.cx, c.cz)
    for (let i = 0; i < list.length; i++) {
      // Lo recolectado desaparece hasta que rebrota.
      if (layer.harvest && propKey(layer.id, c.cx, c.cz, i) in harvested) continue
      all.push(list[i])
    }
  }
  return all
}

/** Vegetación y rocas instanciadas por capas, distribuidas por chunk. */
export function Vegetation() {
  useFrame(() => tintPlants(ecology.moisture))
  const allChunks = useVisibleChunks()
  const chunkVersion = useChunkVersion()
  const harvested = useGameStore((s) => s.harvested)
  // Solo los chunks ya generados (el streamer ya calculó su vegetación).
  const chunks = useMemo(() => allChunks.filter((c) => isChunkReady(c.key)), [allChunks, chunkVersion])
  const layers = useMemo(
    () => PROP_LAYERS.map((layer) => ({ layer, matrices: layerMatrices(layer, chunks, harvested) })),
    [chunks, harvested],
  )
  return (
    <group name="vegetation">
      {layers.map(({ layer, matrices }) => (
        <InstancedProp key={layer.id} id={layer.model} fallback={PARTS[layer.id]} matrices={matrices} />
      ))}
    </group>
  )
}
