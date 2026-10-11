import { Vector3 } from 'three'
import { ModelSlot } from '@/components/common/ModelSlot'
import { CRASH_SITE } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { getHeight } from '@/utils/terrain/heightfield'
import { SmokeColumn } from './SmokeColumn'

const groundY = getHeight(CRASH_SITE.x, CRASH_SITE.z)

// Posición de mundo del motor dañado (el humo va fuera del grupo rotado
// para que su deriva use la dirección real del viento).
const engine = new Vector3(0, 3, -10.5)
  .applyAxisAngle(new Vector3(0, 1, 0), -CRASH_SITE.rotation)
  .add(new Vector3(CRASH_SITE.x, groundY - 0.6, CRASH_SITE.z))

/** Primitivas temporales de la nave (casco, alas, motor, escombros). */
function ShipPlaceholder() {
  return (
    <group rotation={[0.12, 0, -0.18]}>
      {/* Casco */}
      <mesh material={MATERIALS.shipHull} position={[0, 2.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 3.2, 16]} />
      </mesh>
      {/* Cabina */}
      <mesh material={MATERIALS.shipAccent} position={[0, 3.6, 6]} rotation-x={-0.35} castShadow>
        <boxGeometry args={[4, 1.6, 4]} />
      </mesh>
      {/* Ala intacta */}
      <mesh material={MATERIALS.shipHull} position={[6.5, 1.6, -1]} rotation-z={-0.12} castShadow receiveShadow>
        <boxGeometry args={[8, 0.5, 6]} />
      </mesh>
      {/* Ala rota, clavada en la arena */}
      <mesh material={MATERIALS.shipDark} position={[-7, 0.6, 4]} rotation={[0.3, 0.6, 0.9]} castShadow>
        <boxGeometry args={[6, 0.5, 5]} />
      </mesh>
      {/* Motor trasero dañado: aquí nace el humo */}
      <mesh material={MATERIALS.shipDark} position={[0, 2.4, -9]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[1.8, 2.2, 3, 8]} />
      </mesh>
      <mesh material={MATERIALS.ember} position={[0, 2.4, -10.6]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[1.3, 1.3, 0.3, 8]} />
      </mesh>
      {/* Escombros: futura fuente de chatarra (scavenging) */}
      {[
        [5, 0.4, 9, 0.4],
        [-4, 0.3, -12, 1.2],
        [8, 0.3, -6, 2.1],
        [-9, 0.5, -3, 0.7],
        [3, 0.3, 14, 1.9],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} material={i % 2 ? MATERIALS.shipHull : MATERIALS.shipAccent} position={[x, y, z]} rotation={[r, r * 2, r * 0.5]} castShadow>
          <boxGeometry args={[1.4, 0.6, 1.1]} />
        </mesh>
      ))}
    </group>
  )
}

/** Nave estrellada: base de recarga del robot y faro de humo visible desde el spawn. */
export function CrashedShip() {
  return (
    <group name="crashed-ship">
      <group position={[CRASH_SITE.x, groundY - 0.6, CRASH_SITE.z]} rotation-y={-CRASH_SITE.rotation}>
        <ModelSlot id="crashedShip" placeholder={<ShipPlaceholder />} />
      </group>
      <SmokeColumn position={[engine.x, engine.y, engine.z]} />
    </group>
  )
}
