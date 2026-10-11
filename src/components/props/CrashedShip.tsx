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
import { useGameStore } from '@/store/gameStore'
import type { RepairId } from '@/config/repairs'
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

/** Tobera reparada: resplandor azul que late despacio. */
function EngineGlow() {
  const ref = useRef<Group>(null)
  const mat = sharedToon('#7fe3ff', { emissive: '#3ad0ff', emissiveIntensity: 1.4 })
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(0.9 + Math.sin(clock.elapsedTime * 3) * 0.08)
  })
  return (
    <group ref={ref}>
      <mesh material={mat} rotation-x={Math.PI / 2} userData={{ noOutline: true }}>
        <cylinderGeometry args={[0.7, 0.4, 0.5, 8]} />
      </mesh>
    </group>
  )
}

/** Luz de navegación parpadeante (verde) en la punta del ala. */
function NavLight({ position }: { position: [number, number, number] }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.visible = Math.sin(clock.elapsedTime * 4) > -0.2
  })
  const mat = sharedToon('#7dff8a', { emissive: '#3dff5a', emissiveIntensity: 2 })
  return (
    <group ref={ref} position={position}>
      <mesh material={mat} userData={{ noOutline: true }}>
        <icosahedronGeometry args={[0.28, 0]} />
      </mesh>
    </group>
  )
}

/** Piezas nuevas que aparecen en la nave a medida que se reparan sus sistemas. */
function ShipRepairs({ repairs }: { repairs: Partial<Record<RepairId, true>> }) {
  const metal = sharedToon('#c9ced4')
  const pipe = sharedToon('#4fb3d9', { emissive: '#1f7fa8', emissiveIntensity: 0.3 })
  return (
    <>
      {repairs.comms && (
        <group position={[0, 4.4, -1.5]}>
          {/* Mástil y plato de la antena */}
          <mesh material={metal} position-y={1.2} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 2.4, 6]} />
          </mesh>
          <mesh material={metal} position={[0, 2.3, 0]} rotation-x={-0.9} castShadow>
            <coneGeometry args={[0.9, 0.35, 10, 1, true]} />
          </mesh>
          <mesh material={MATERIALS.shipAccent} position-y={2.5}>
            <icosahedronGeometry args={[0.14, 0]} />
          </mesh>
        </group>
      )}
      {repairs.navigation && (
        <>
          <NavLight position={[11.2, 1.1, -5.2]} />
          <NavLight position={[0, 4.7, 6.4]} />
        </>
      )}
      {repairs.cooling &&
        [-1, 1].map((side) => (
          <group key={side} position={[side * 2.35, 2.2, -5]}>
            <mesh material={pipe} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.18, 0.18, 7, 6]} />
            </mesh>
            {[-2.5, 0, 2.5].map((z) => (
              <mesh key={z} material={metal} position-z={z} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.26, 0.26, 0.25, 6]} />
              </mesh>
            ))}
          </group>
        ))}
    </>
  )
}

/**
 * Caza estrellado (procedural lowpoly, inspirado en el concept): fuselaje
 * afilado, alas en flecha (una partida y clavada en la arena), derivas,
 * toberas dobles y cabina. Huella compatible con los colisionadores y los
 * escombros de config/world.ts.
 */
function ShipPlaceholder() {
  const repairs = useGameStore((s) => s.repairs)
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
        <group position={[0.9, 2.3, -10.9]}>{repairs.engine ? <EngineGlow /> : <EngineFire />}</group>
        <group position={[-0.9, 2.3, -10.9]}>{repairs.engine && <EngineGlow />}</group>
        <ShipRepairs repairs={repairs} />
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
  const engineFixed = useGameStore((s) => !!s.repairs.engine)
  return (
    <group name="crashed-ship">
      <group position={[CRASH_SITE.x, groundY - 0.6, CRASH_SITE.z]} rotation-y={-CRASH_SITE.rotation}>
        <ModelSlot id="crashedShip" placeholder={<ShipPlaceholder />} />
      </group>
      <SmokeColumn position={[engine.x, engine.y, engine.z]} clean={engineFixed} />
    </group>
  )
}
