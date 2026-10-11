import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { ModelSlot } from '@/components/common/ModelSlot'
import { STRUCTURES } from '@/config/structures'
import { getGame, useGameStore } from '@/store/gameStore'
import type { PlacedStructure } from '@/store/slices/structuresSlice'
import { getHeight } from '@/utils/terrain/heightfield'
import { StructurePlaceholder } from './StructureModels'

/** Estructuras colocadas por el jugador (guardadas en la partida). */
export function Structures() {
  const structures = useGameStore((s) => s.structures)
  return (
    <group name="structures">
      {structures.map((s) => (
        <Structure key={s.id} structure={s} />
      ))}
    </group>
  )
}

function Structure({ structure }: { structure: PlacedStructure }) {
  const ref = useRef<Group>(null)
  const y = useMemo(() => getHeight(structure.x, structure.z), [structure.x, structure.z])

  // Banco de baterías: la barra luminosa crece con la carga guardada.
  useFrame(() => {
    if (structure.type !== 'batteryBank' || !ref.current) return
    const light = ref.current.getObjectByName('bank-light')
    if (!light) return
    const cap = STRUCTURES.batteryBank.bankCapacity ?? 1
    const level = Math.max(0.02, (getGame().bankCharge[structure.id] ?? 0) / cap)
    light.scale.y = level
    light.position.y = 0.15 + 0.45 * level
  })

  return (
    <group ref={ref} position={[structure.x, y, structure.z]} rotation-y={structure.rot}>
      <ModelSlot id={structure.type} placeholder={<StructurePlaceholder type={structure.type} />} />
    </group>
  )
}
