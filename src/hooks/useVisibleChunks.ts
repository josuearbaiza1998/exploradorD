import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CHUNK_SIZE, CHUNK_VIEW_RADIUS, ISLAND } from '@/config/world'
import { focus } from '@/systems/focus'

export type ChunkCoord = { cx: number; cz: number; key: string }

/** ¿El chunk toca tierra? En modo isla evitamos generar chunks de puro mar. */
function chunkHasLand(cx: number, cz: number): boolean {
  if (!ISLAND.enabled) return true
  const minX = cx * CHUNK_SIZE
  const minZ = cz * CHUNK_SIZE
  const nearestX = Math.max(minX, Math.min(0, minX + CHUNK_SIZE))
  const nearestZ = Math.max(minZ, Math.min(0, minZ + CHUNK_SIZE))
  return Math.hypot(nearestX, nearestZ) < ISLAND.radius + 30
}

function computeChunks(centerX: number, centerZ: number): ChunkCoord[] {
  const list: ChunkCoord[] = []
  for (let dz = -CHUNK_VIEW_RADIUS; dz <= CHUNK_VIEW_RADIUS; dz++) {
    for (let dx = -CHUNK_VIEW_RADIUS; dx <= CHUNK_VIEW_RADIUS; dx++) {
      if (dx * dx + dz * dz > CHUNK_VIEW_RADIUS * CHUNK_VIEW_RADIUS + 1) continue
      const cx = centerX + dx
      const cz = centerZ + dz
      if (chunkHasLand(cx, cz)) list.push({ cx, cz, key: `${cx}:${cz}` })
    }
  }
  return list
}

/**
 * Devuelve los chunks que deben existir alrededor del foco.
 * Solo dispara un render de React cuando el foco cambia de chunk.
 */
export function useVisibleChunks(): ChunkCoord[] {
  const toChunk = (v: number) => Math.floor(v / CHUNK_SIZE)
  const current = useRef({ x: toChunk(focus.x), z: toChunk(focus.z) })
  const [chunks, setChunks] = useState(() => computeChunks(current.current.x, current.current.z))

  useFrame(() => {
    const x = toChunk(focus.x)
    const z = toChunk(focus.z)
    if (x !== current.current.x || z !== current.current.z) {
      current.current = { x, z }
      setChunks(computeChunks(x, z))
    }
  })

  return chunks
}
