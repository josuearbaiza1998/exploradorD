import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type BufferGeometry, type Group, type Material } from 'three'
import { ModelSlot } from '@/components/common/ModelSlot'
import { Outlined } from '@/components/common/Outlined'
import { CRASH_SITE } from '@/config/world'
import { PALETTE } from '@/config/palette'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { getHeight } from '@/utils/terrain/heightfield'
import { SmokeColumn } from './SmokeColumn'
import { useGameStore } from '@/store/gameStore'
import { isShipRepaired } from '@/store/slices/explorationSlice'
import type { RepairId } from '@/config/repairs'
import { finGeometry, fuselageGeometry, wingGeometry } from './shipGeometry'
import { BoatModel } from './BoatModel'

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
      {repairs.engine && (
        // Hélice bajo las toberas: la nave ahora navega.
        <group position={[0, 0.9, -11.2]}>
          {[0, 1, 2].map((i) => (
            <group key={i} rotation-z={(i * Math.PI * 2) / 3}>
              <mesh material={metal} position-y={0.6}>
                <boxGeometry args={[0.28, 1.1, 0.08]} />
              </mesh>
            </group>
          ))}
        </group>
      )}
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
export function ShipPlaceholder({ variant = 'crashed' }: { variant?: 'crashed' | 'scar' }) {
  const repairs = useGameStore((s) => s.repairs)
  const tilt: [number, number, number] = [0.1, 0, -0.16]
  const geo = useMemo(
    () => ({ fuselage: fuselageGeometry(), wing: wingGeometry(), broken: wingGeometry(true, -1), fin: finGeometry() }),
    [],
  )
  const glass = sharedToon('#1f5f7a', { emissive: '#3ad0ff', emissiveIntensity: 0.15 })
  const scorch = sharedToon('#3b2a22')
  return (
    <Outlined thickness={0.07}>
      <group rotation={tilt} visible={variant !== 'scar'}>
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
      <CrashScar wing={geo.wing} scorch={scorch} />
    </Outlined>
  )
}

/** Lo que queda en la arena: el ala arrancada y el surco del impacto. */
function CrashScar({ wing, scorch }: { wing: BufferGeometry; scorch: Material }) {
  return (
    <>
      {/* Ala izquierda arrancada, clavada en la arena */}
      <mesh geometry={wing} material={MATERIALS.shipHull} position={[-6.5, 0.2, 5]} rotation={[0.35, 0.9, 1.05]} scale={0.7} castShadow />
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
    </>
  )
}

/** El barco en construcción va algo adelantado sobre la huella de la nave. */
const YARD_Z = 2
/** Altura del barco sobre la base (la quilla queda a un palmo de la arena, sobre la grada). */
const YARD_Y = 0.6 + 0.55

/**
 * Grada de madera: calzos en V bajo la quilla y puntales a los costados.
 * Se queda en la arena cuando el barco se bota (cuenta dónde se construyó).
 */
function Cradle() {
  const wood = sharedToon('#7c5130', { flatShading: true })
  return (
    <group position-z={YARD_Z}>
      {[-2.6, 0, 2.6].map((z) => (
        <group key={z} position-z={z}>
          <mesh material={wood} position={[0, 0.6 + 0.12, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.6, 0.32, 0.4]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} material={wood} position={[sx * 0.75, 0.6 + 0.45, 0]} rotation-z={sx * 0.5}>
              <boxGeometry args={[0.7, 0.24, 0.36]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Puntales inclinados contra la borda */}
      {[-1, 1].map((sx) =>
        [-1.6, 1.4].map((z) => (
          <mesh key={`${sx}${z}`} material={wood} position={[sx * 2.15, 0.6 + 0.8, z]} rotation-z={sx * 0.55}>
            <boxGeometry args={[0.14, 1.9, 0.14]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/**
 * La nave a medio convertir en barco: el casco nuevo sobre la grada, con las
 * piezas que ya se han reparado montadas, y los restos de la nave que aún
 * faltan por aprovechar tirados alrededor (la cola con las toberas y las
 * derivas, el morro con la cabina). Cada reparación pasa una pieza de los
 * restos al barco.
 */
function Shipyard({ repairs }: { repairs: Partial<Record<RepairId, true>> }) {
  const geo = useMemo(() => ({ fin: finGeometry() }), [])
  const glass = sharedToon('#1f5f7a', { emissive: '#3ad0ff', emissiveIntensity: 0.15 })
  const scorch = sharedToon('#3b2a22')
  return (
    <>
      <Cradle />
      <group position={[0, YARD_Y, YARD_Z]}>
        <BoatModel parts={repairs} />
      </group>
      <Outlined thickness={0.07}>
        <group>
          {/* Cola de la nave, cortada: toberas (el motor aún sin montar) y derivas */}
          {!repairs.engine && (
            <group rotation={[0.1, 0, -0.16]}>
              <mesh material={MATERIALS.shipHull} position={[0, 2.3, -7.6]} rotation-x={Math.PI / 2} scale={[1, 0.72, 1]} castShadow>
                <cylinderGeometry args={[2.3, 2.1, 4.2, 8]} />
              </mesh>
              <mesh material={scorch} position={[0, 2.3, -5.45]} rotation-x={Math.PI / 2} scale={[1, 0.72, 1]}>
                <cylinderGeometry args={[2.25, 2.25, 0.1, 8]} />
              </mesh>
              {[-0.9, 0.9].map((x) => (
                <mesh key={x} material={MATERIALS.shipDark} position={[x, 2.3, -10]} rotation-x={Math.PI / 2} castShadow>
                  <cylinderGeometry args={[0.85, 1.05, 1.6, 8]} />
                </mesh>
              ))}
              <group position={[0.9, 2.3, -10.9]}>
                <EngineFire />
              </group>
              {!repairs.comms && (
                <>
                  <mesh geometry={geo.fin} material={MATERIALS.shipHull} position={[1.1, 3.6, -6.4]} rotation-z={-0.35} castShadow />
                  <mesh geometry={geo.fin} material={MATERIALS.shipDark} position={[-1.1, 3.6, -6.4]} rotation-z={0.6} castShadow />
                </>
              )}
            </group>
          )}
          {/* Morro con la cabina, desmontado a un lado hasta reparar la navegación */}
          {!repairs.navigation && (
            <group position={[6.5, 0.9, 5]} rotation={[0.15, 0.6, 0.2]}>
              <mesh material={MATERIALS.shipHull} scale={[1.5, 0.9, 2.2]} castShadow>
                <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
              <mesh material={glass} position={[0, 0.35, 0.2]} scale={[1, 0.6, 1.5]}>
                <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              </mesh>
            </group>
          )}
        </group>
      </Outlined>
    </>
  )
}

/**
 * La nave estrellada: base de recarga del robot y faro de humo. Con el casco
 * estanco empieza a convertirse en barco aquí mismo (ver Shipyard); con todo
 * reparado, el barco espera en el muelle y aquí queda la grada vacía.
 */
export function CrashedShip() {
  const repairs = useGameStore((s) => s.repairs)
  const launched = useGameStore(isShipRepaired)
  const base: [number, number, number] = [CRASH_SITE.x, groundY - 0.6, CRASH_SITE.z]
  if (launched)
    return (
      <group name="crash-site" position={base} rotation-y={-CRASH_SITE.rotation}>
        <ShipPlaceholder variant="scar" />
        <Cradle />
      </group>
    )
  if (repairs.hull)
    return (
      <group name="shipyard">
        <group position={base} rotation-y={-CRASH_SITE.rotation}>
          <ShipPlaceholder variant="scar" />
          <Shipyard repairs={repairs} />
        </group>
        {!repairs.engine && <SmokeColumn position={[engine.x, engine.y, engine.z]} clean={false} />}
      </group>
    )
  return (
    <group name="crashed-ship">
      <group position={base} rotation-y={-CRASH_SITE.rotation}>
        <ModelSlot id="crashedShip" placeholder={<ShipPlaceholder />} />
      </group>
      <SmokeColumn position={[engine.x, engine.y, engine.z]} clean={!!repairs.engine} />
    </group>
  )
}
