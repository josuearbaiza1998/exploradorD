import { memo } from 'react'
import { MATERIALS } from '@/materials/toonMaterials'
import { getChunkGeometry } from '@/systems/chunkStreamer'

/** Un chunk de terreno. La geometría la genera y libera el chunkStreamer. */
export const TerrainChunk = memo(function TerrainChunk({ chunkKey }: { chunkKey: string }) {
  const geometry = getChunkGeometry(chunkKey)
  if (!geometry) return null
  return <mesh geometry={geometry} material={MATERIALS.terrain} receiveShadow castShadow />
})
