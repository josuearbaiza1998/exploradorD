import { memo, useEffect, useMemo } from 'react'
import { CHUNK_RESOLUTION, CHUNK_SIZE } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { buildChunkGeometry } from '@/utils/terrain/chunkGeometry'

type Props = { cx: number; cz: number }

/** Un chunk de terreno. La geometría se libera al descargarse el chunk. */
export const TerrainChunk = memo(function TerrainChunk({ cx, cz }: Props) {
  const geometry = useMemo(() => buildChunkGeometry(cx, cz, CHUNK_SIZE, CHUNK_RESOLUTION), [cx, cz])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={MATERIALS.terrain} receiveShadow castShadow />
})
