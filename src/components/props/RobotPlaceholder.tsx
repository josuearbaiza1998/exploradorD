import { ModelSlot } from '@/components/common/ModelSlot'
import { CRASH_SITE, SPAWN } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { getHeight } from '@/utils/terrain/heightfield'

const spawnY = getHeight(SPAWN.x, SPAWN.z)
// El robot aparece mirando hacia el humo de la nave.
const facing = Math.atan2(CRASH_SITE.x - SPAWN.x, CRASH_SITE.z - SPAWN.z)

/**
 * Sonda robótica en el punto de aparición (solo referencia de escala en la
 * Fase 1). En la Fase 2 este componente pasará a estar controlado por el
 * controlador en tercera persona.
 */
export function RobotPlaceholder() {
  return (
    <group name="robot" position={[SPAWN.x, spawnY, SPAWN.z]} rotation-y={facing}>
      <ModelSlot
        id="robot"
        placeholder={
          <group>
            <mesh material={MATERIALS.robot} position={[0, 0.95, 0]} castShadow>
              <capsuleGeometry args={[0.38, 1.0, 4, 10]} />
            </mesh>
            {/* Cabeza con visor: el "sensor" que se ensuciará con las tormentas */}
            <mesh material={MATERIALS.robot} position={[0, 1.95, 0]} castShadow>
              <boxGeometry args={[0.6, 0.38, 0.5]} />
            </mesh>
            <mesh material={MATERIALS.robotAccent} position={[0, 1.97, 0.26]}>
              <boxGeometry args={[0.46, 0.12, 0.04]} />
            </mesh>
            {/* Antenas estilo Chappie */}
            <mesh material={MATERIALS.shipAccent} position={[0.2, 2.3, -0.05]} rotation-z={-0.2}>
              <boxGeometry args={[0.06, 0.4, 0.06]} />
            </mesh>
            <mesh material={MATERIALS.shipAccent} position={[-0.2, 2.3, -0.05]} rotation-z={0.2}>
              <boxGeometry args={[0.06, 0.4, 0.06]} />
            </mesh>
          </group>
        }
      />
    </group>
  )
}
