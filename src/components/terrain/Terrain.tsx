import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVisibleChunks } from '@/hooks/useVisibleChunks'
import { isChunkReady, processChunkQueue, requestChunks, useChunkVersion } from '@/systems/chunkStreamer'
import { TerrainChunk } from './TerrainChunk'

/** Milisegundos por frame dedicados a generar chunks nuevos. */
const BUILD_BUDGET_MS = 6

/**
 * Gestor de chunks: pide los chunks visibles alrededor del foco, los genera
 * poco a poco (más cercanos primero) y dibuja los que ya están listos.
 * Funciona igual en modo isla y en terreno infinito.
 */
export function Terrain() {
  const chunks = useVisibleChunks()
  useChunkVersion()

  useEffect(() => {
    requestChunks(chunks)
    // Al arrancar, los chunks más cercanos se generan de golpe para no ver el vacío.
    processChunkQueue(250)
  }, [chunks])

  useFrame(() => processChunkQueue(BUILD_BUDGET_MS))

  return (
    <group name="terrain">
      {chunks
        .filter((c) => isChunkReady(c.key))
        .map((c) => (
          <TerrainChunk key={c.key} chunkKey={c.key} />
        ))}
    </group>
  )
}
