import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Group } from 'three'
import { ModelSlot } from '@/components/common/ModelSlot'
import { Outlined } from '@/components/common/Outlined'
import { CRASH_SITE } from '@/config/world'
import { PALETTE } from '@/config/palette'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { getHeight } from '@/utils/terrain/heightfield'
import { SmokeColumn } from './SmokeColumn'
import { finGeometry, fuselageGeometry, wingGeometry } from './shipGeometry'

const groundY = getHeight(CRASH_SITE.x, CRASH_SITE.z)

// Posición de mundo del motor dañado (el humo va fuera del grupo rotado
// para que su deriva use la dirección real del viento).
const engine = new Vector3(0.9, 2.6, -10.6)
  .applyAxisAngle(new Vector3(0, 1, 0), -CRASH_SITE.rotation)
  .add(new Vector3(CRASH_SITE.x, groundY - 0.6, CRASH_SITE.z))

/** Llamas parpadeantes en la tobera rota. */
function EngineFire() {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const k = 0.75 + Math.sin(t * (9 + i * 3) + i) * 0.25
      c.scale.setScalar(k)
      c.position.y = Math.abs(Math.sin(t * 4 + i * 2)) * 0.35
    })
  })
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={MATERIALS.ember} position-x={(i - 1) * 0.45}>
          <icosahedronGeometry args={[0.5 - i * 0.08, 0]} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Caza estrellado (procedural lowpoly, inspirado en el concept): fuselaje
 * afilado, alas en flecha (una partida y clavada en la arena), derivas,
 * toberas dobles y cabina. Huella compatible con los colisionadores y los
 * escombros de config/world.ts.
 */
function ShipPlaceholder() {
  const geo = useMemo(
    () => ({ fuselage: fuselageGeometry(), wing: wingGeometry(), broken: wingGeometry(true, -1), fin: finGeometry() }),
    [],
  )
  const glass = sharedToon('#1f5f7a', { emissive: '#3ad0ff', emissiveIntensity: 0.15 })
  const scorch = sharedToon('#3b2a22')
  return (
    <Outlined thickness={0.07}>
      <group rotation={[0.1, 0, -0.16]}>
        {/* Fuselaje */}
        <mesh geometry={geo.fuselage} material={MATERIALS.shipHull} position={[0, 2.3, 0]} castShadow receiveShadow />
        {/* Franjas naranjas */}
        <mesh material={MATERIALS.shipAccent} position={[0, 2.3, 2.2]} rotation-x={Math.PI / 2} scale={[1, 1, 0.72]}>
          <cylinderGeometry args={[2.45, 2.55, 0.6, 8]} />
        </mesh>
        <mesh material={MATERIALS.shipDark} position={[0, 2.3, -4.5]} rotation-x={Math.PI / 2} scale={[1, 1, 0.72]}>
          <cylinderGeometry args={[2.66, 2.66, 0.9, 8]} />
        </mesh>
        {/* Cabina: burbuja de cristal alargada */}
        <mesh material={glass} position={[0, 3.75, 4.6]} scale={[1.1, 0.75, 2.6]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
        {/* Ala derecha intacta */}
        <mesh geometry={geo.wing} material={MATERIALS.shipHull} position={[1.9, 1.7, 0]} rotation-z={-0.08} castShadow receiveShadow />
        <mesh material={MATERIALS.shipAccent} position={[10.4, 1.05, -5.2]} rotation={[0, -0.6, -0.08]}>
          <boxGeometry args={[0.5, 0.46, 2.2]} />
        </mesh>
        {/* Muñón del ala izquierda (dientes de sierra) */}
        <mesh geometry={geo.broken} material={MATERIALS.shipHull} position={[-1.9, 1.7, 0]} castShadow />
        {/* Derivas de cola, algo abiertas */}
        <mesh geometry={geo.fin} material={MATERIALS.shipHull} position={[1.1, 3.6, -6]} rotation-z={-0.35} castShadow />
        <mesh geometry={geo.fin} material={MATERIALS.shipDark} position={[-1.1, 3.6, -6]} rotation-z={0.6} castShadow />
        {/* Toberas: la derecha arde y echa el humo */}
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} material={MATERIALS.shipDark} position={[x, 2.3, -10]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.85, 1.05, 1.6, 8]} />
          </mesh>
        ))}
        <group position={[0.9, 2.3, -10.9]}>
          <EngineFire />
        </group>
        {/* Toma de aire bajo la cabina */}
        <mesh material={MATERIALS.shipDark} position={[0, 1.15, 3]} castShadow>
          <boxGeometry args={[2.4, 0.7, 4]} />
        </mesh>
      </group>
      {/* Ala izquierda arrancada, clavada en la arena */}
      <mesh geometry={geo.wing} material={MATERIALS.shipHull} position={[-6.5, 0.2, 5]} rotation={[0.35, 0.9, 1.05]} scale={0.7} castShadow />
      {/* Surco del impacto: arena removida y quemada detrás de la nave */}
      <mesh material={scorch} position={[0, 0.25, -17]} rotation-y={0.05} receiveShadow userData={{ noOutline: true }}>
        <boxGeometry args={[5, 0.5, 14]} />
      </mesh>
      <mesh material={sharedToon(PALETTE.sandDark)} position={[3.4, 0.45, -16]} rotation={[0, 0.05, 0.25]} receiveShadow userData={{ noOutline: true }}>
        <boxGeometry args={[1.6, 0.9, 16]} />
      </mesh>
      <mesh material={sharedToon(PALETTE.sandDark)} position={[-3.4, 0.45, -16]} rotation={[0, 0.05, -0.25]} receiveShadow userData={{ noOutline: true }}>
        <boxGeometry args={[1.6, 0.9, 16]} />
      </mesh>
    </Outlined>
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
