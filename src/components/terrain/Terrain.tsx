import { useVisibleChunks } from '@/hooks/useVisibleChunks'
import { TerrainChunk } from './TerrainChunk'

/**
 * Gestor de chunks: monta/desmonta TerrainChunk según el foco.
 * Hoy la isla cabe entera en el radio de vista; mañana, con terreno
 * infinito, el mismo componente irá generando chunks al avanzar.
 */
export function Terrain() {
  const chunks = useVisibleChunks()
  return (
    <group name="terrain">
      {chunks.map((c) => (
        <TerrainChunk key={c.key} cx={c.cx} cz={c.cz} />
      ))}
    </group>
  )
}
