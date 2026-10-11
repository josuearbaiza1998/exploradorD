import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { wind } from '@/systems/wind'
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

  const dirt = useRef<Mesh>(null)
  // Banco de baterías: la barra luminosa crece con la carga guardada.
  useFrame((_, delta) => {
    if (!ref.current) return
    const game = getGame()
    if (structure.type === 'windTurbine') {
      const rotor = ref.current.getObjectByName('turbine-rotor')
      if (rotor) rotor.rotation.z -= Math.min(delta, 0.1) * (0.4 + wind.strength * 9)
      return
    }
    if (structure.type === 'solarPanel') {
      if (dirt.current) {
        const d = game.panelDirt[structure.id] ?? 0
        dirt.current.visible = d > 0.03
        ;(dirt.current.material as MeshBasicMaterial).opacity = Math.min(0.9, d)
      }
      return
    }
    if (structure.type === 'rainCollector') {
      const w = ref.current.getObjectByName('collector-water')
      if (w) {
        const level = game.water[structure.id] ?? 0
        w.visible = level > 0.02
        w.position.y = 0.2 + level * 0.88
      }
      return
    }
    if (structure.type !== 'batteryBank') return
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
      {/* Capa de arena sobre el panel (se limpia a mano o con la lluvia) */}
      {structure.type === 'solarPanel' && (
        <mesh ref={dirt} position-y={1.5} rotation-x={-0.6 - Math.PI / 2} visible={false}>
          <planeGeometry args={[2.2, 1.4]} />
          <meshBasicMaterial color="#c99a5b" transparent opacity={0} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}
    </group>
  )
}
