import { ModelSlot } from '@/components/common/ModelSlot'
import { MATERIALS, robotBatteryMaterial } from '@/materials/toonMaterials'

/** Primitivas temporales de la sonda (estilo Chappie). Pivote en los pies. */
function RobotPlaceholder() {
  return (
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
      {/* Mochila con indicador de batería: visible desde la cámara (UI diegética) */}
      <mesh material={MATERIALS.shipDark} position={[0, 1.15, -0.38]} castShadow>
        <boxGeometry args={[0.42, 0.62, 0.18]} />
      </mesh>
      <mesh material={robotBatteryMaterial} position={[0, 1.15, -0.475]}>
        <boxGeometry args={[0.12, 0.46, 0.02]} />
      </mesh>
      {/* Antenas */}
      <mesh material={MATERIALS.shipAccent} position={[0.2, 2.3, -0.05]} rotation-z={-0.2}>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
      </mesh>
      <mesh material={MATERIALS.shipAccent} position={[-0.2, 2.3, -0.05]} rotation-z={0.2}>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
      </mesh>
    </group>
  )
}

/**
 * Modelo visual del robot: placeholder hoy, .glb mañana (src/assets/models.ts → robot).
 * Al sustituirlo por el .glb, conserva una malla con robotBatteryMaterial
 * para mantener el indicador de batería en la espalda.
 */
export function RobotModel() {
  return <ModelSlot id="robot" placeholder={<RobotPlaceholder />} />
}
