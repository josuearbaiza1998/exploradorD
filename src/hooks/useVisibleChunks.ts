import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CHUNK_SIZE, ISLAND } from '@/config/world'
import { getQuality, useSettings, qualityLevel } from '@/store/settingsStore'
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
  const radius = getQuality().viewRadius
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dz * dz > radius * radius + 1) continue
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
  // Al cambiar la calidad cambia la distancia de dibujado.
  const level = useSettings(qualityLevel)
  useEffect(() => setChunks(computeChunks(current.current.x, current.current.z)), [level])

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
