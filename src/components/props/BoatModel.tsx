import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, InstancedMesh, MeshBasicMaterial, Object3D, Vector3, type Group } from 'three'
import { Outlined } from '@/components/common/Outlined'
import { BOAT } from '@/config/boat'
import { PALETTE } from '@/config/palette'
import { MATERIALS, sharedToon, createToonMaterial } from '@/materials/toonMaterials'
import { boat, boatLamp } from '@/systems/boat'
import type { RepairId } from '@/config/repairs'
import { deckGeometry, gunwaleAt, hullGeometry, hullHalfBeam, hullPaint, HULL } from './boatGeometry'

const DECK = BOAT.deck.y
/** Mástil a popa del timón; el farol (el dron) cuelga de un brazo hacia proa. */
const MAST = { x: 0, z: -1.45, top: DECK + 4.4 }
export const LAMP_LOCAL = new Vector3(0, MAST.top - 0.55, -0.55)
const WHEEL = { y: DECK + 1.2, z: 0.35 }
const ENGINE = { y: DECK + 0.72, z: -3.7 }
const STACK = { x: -0.85, z: -2.85, top: DECK + 2.2 }

const _lamp = new Vector3()

/**
 * El barco: el fuselaje de la nave convertido en un bote corto con proa en
 * cuerno pintada con remolinos, cabina de cristal, timón, mástil con
 * banderines y el dron colgado como farol, carga atada, el motor de la nave a
 * popa con chimenea, hélice y un timón naranja. Un trozo de ala hace de
 * flotador lateral, unido al casco con dos puntales. Todo encaja: nada suelto.
 */
export function BoatModel({ afloat = false, parts }: { afloat?: boolean; parts?: Partial<Record<RepairId, true>> }) {
  // A flote lleva todo; en el astillero, solo lo ya reparado.
  const has = (afloat ? { hull: true, comms: true, navigation: true, cooling: true, engine: true } : parts ?? {}) as Partial<Record<RepairId, true>>
  const geo = useMemo(
    () => ({
      hull: hullGeometry(),
      deck: deckGeometry(DECK, 0.1, HULL.bow - 0.3),
      paint: hullPaint(PALETTE.shipHull, PALETTE.shipAccent),
    }),
    [],
  )
  const hullMat = useMemo(() => createToonMaterial({ map: geo.paint, flatShading: true, side: DoubleSide }), [geo.paint])
  const plank = sharedToon('#a67a4c')
  const wood = sharedToon('#7c5130', { flatShading: true })
  const metal = sharedToon('#b9c0c8', { flatShading: true })
  const steel = sharedToon('#6f7780', { flatShading: true })
  const glass = sharedToon('#3fb6e8', { emissive: '#3ad0ff', emissiveIntensity: 0.25 })
  const sack = sharedToon('#cdb58a', { flatShading: true })
  const rope = sharedToon('#d8c28e')
  const solar = sharedToon(PALETTE.solarCell, { emissive: '#3b6fd6', emissiveIntensity: 0.15 })

  const wheel = useRef<Group>(null)
  const rudder = useRef<Group>(null)
  const prop = useRef<Group>(null)
  const flags = useRef<Group[]>([])
  const lamp = useRef<Group>(null)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    if (wheel.current) wheel.current.rotation.z = -boat.rudder * 2.2
    if (rudder.current) rudder.current.rotation.y = -boat.rudder * 0.55
    if (prop.current) prop.current.rotation.z += dt * (1.5 + boat.speed * 3)
    flags.current.forEach((f, i) => {
      if (f) f.rotation.y = Math.sin(t * (6 + i) + i) * 0.25 + Math.min(0.5, boat.speed * 0.03)
    })
    // Punto del farol en el mundo (para que el dron se cuelgue ahí).
    if (afloat && lamp.current) {
      lamp.current.getWorldPosition(_lamp)
      boatLamp.x = _lamp.x
      boatLamp.y = _lamp.y
      boatLamp.z = _lamp.z
      boatLamp.valid = true
    }
  })

  // Barandilla de tubo: postes sobre la borda y pasamanos.
  const rails = useMemo(() => {
    const posts: [number, number, number][] = []
    const segs: { p: [number, number, number]; len: number; yaw: number; pitch: number }[] = []
    for (const side of [-1, 1]) {
      const ps: [number, number, number][] = []
      for (let z = -3.9; z <= 1.7; z += 0.95) ps.push([side * (hullHalfBeam(z) * 0.98 - 0.07), gunwaleAt(z), z])
      posts.push(...ps)
      for (let i = 0; i < ps.length - 1; i++) segs.push(segment(ps[i], ps[i + 1], 0.62))
    }
    // Pasamanos de popa, de banda a banda.
    const zs = -3.9
    const hb = hullHalfBeam(zs) * 0.98 - 0.07
    segs.push(segment([-hb, gunwaleAt(zs), zs], [hb, gunwaleAt(zs), zs], 0.62))
    return { posts, segs }
  }, [])

  return (
    <group>
      <Outlined thickness={0.035}>
        <group>
          {/* Casco pintado y cubierta de tablones */}
          <mesh geometry={geo.hull} material={hullMat} castShadow receiveShadow />
          <mesh geometry={geo.deck} material={plank} receiveShadow />
          {/* Cabina de proa: el morro de la nave con su burbuja de cristal */}
          <mesh material={MATERIALS.shipHull} position={[0, DECK, 2.55]} scale={[1.05, 0.62, 1.55]} castShadow>
            <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {has.navigation && (
            <>
            <mesh material={glass} position={[0, DECK + 0.42, 2.35]} scale={[0.72, 0.42, 0.95]} castShadow>
              <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            </>
          )}
          <mesh material={MATERIALS.shipAccent} position={[0.92, DECK + 0.3, 2.45]} rotation-y={0.25}>
            <boxGeometry args={[0.12, 0.32, 0.4]} />
          </mesh>
          {has.navigation && (
            <>
            {/* Consola con relojes y tuberías delante del timón */}
            <group position={[0, DECK, 0.95]}>
              <mesh material={steel} position-y={0.42} castShadow>
                <boxGeometry args={[1.1, 0.84, 0.42]} />
              </mesh>
              {[-0.32, 0.05, 0.36].map((x, i) => (
                <mesh key={x} material={i === 1 ? MATERIALS.shipAccent : metal} position={[x, 0.62, -0.22]} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.09, 0.09, 0.04, 10]} />
                </mesh>
              ))}
              <mesh material={MATERIALS.shipAccent} position={[0.42, 0.2, -0.26]} rotation-z={Math.PI / 2}>
                <cylinderGeometry args={[0.05, 0.05, 0.4, 6]} />
              </mesh>
            </group>
            {/* Timón: eje desde la consola y rueda de cabillas */}
            <mesh material={wood} position={[0, WHEEL.y, WHEEL.z + 0.3]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
            </mesh>
            <group ref={wheel} position={[0, WHEEL.y, WHEEL.z]}>
              <mesh material={wood}>
                <torusGeometry args={[0.36, 0.045, 5, 14]} />
              </mesh>
              <mesh material={wood} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.08, 0.08, 0.1, 8]} />
              </mesh>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} material={wood} rotation-z={(i * Math.PI) / 4}>
                  <boxGeometry args={[0.98, 0.045, 0.045]} />
                </mesh>
              ))}
            </group>
            </>
          )}
          {/* Barandilla */}
          {rails.posts.map((p, i) => (
            <mesh key={i} material={metal} position={[p[0], p[1] + 0.31, p[2]]}>
              <cylinderGeometry args={[0.035, 0.035, 0.62, 5]} />
            </mesh>
          ))}
          {rails.segs.map((s, i) => (
            <mesh key={i} material={metal} position={s.p} rotation={[s.pitch, s.yaw, 0, 'YXZ']}>
              <cylinderGeometry args={[0.04, 0.04, s.len + 0.06, 5]} />
            </mesh>
          ))}
          {has.comms && (
            <>
            {/* Mástil con brazo del farol y banderines */}
            <mesh material={wood} position={[MAST.x, (DECK + MAST.top) / 2, MAST.z]} castShadow>
              <cylinderGeometry args={[0.07, 0.1, MAST.top - DECK, 6]} />
            </mesh>
            <mesh material={wood} position={[MAST.x, MAST.top - 0.15, (MAST.z + LAMP_LOCAL.z) / 2]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.045, 0.045, Math.abs(LAMP_LOCAL.z - MAST.z) + 0.1, 5]} />
            </mesh>
            <mesh material={steel} position={[MAST.x, MAST.top - 0.3, LAMP_LOCAL.z]}>
              <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
            </mesh>
            <group ref={lamp} position={LAMP_LOCAL} />
            {[
              { y: MAST.top - 0.7, c: PALETTE.shipAccent },
              { y: MAST.top - 1.2, c: '#f2a23a' },
              { y: MAST.top - 1.7, c: '#2f5fb3' },
            ].map((f, i) => (
              <group key={i} position={[MAST.x, f.y, MAST.z - 0.06]} ref={(g) => { if (g) flags.current[i] = g }}>
                <mesh material={sharedToon(f.c, { side: DoubleSide })} position-z={-0.3} rotation-y={Math.PI / 2}>
                  <planeGeometry args={[0.6, 0.3]} />
                </mesh>
              </group>
            ))}
            {/* Antenas finas con punta azul */}
            {[
              [1.15, -1.7, 2.6],
              [1.3, -2.2, 2.1],
            ].map(([x, z, h], i) => (
              <group key={i} position={[x, gunwaleAt(z), z]}>
                <mesh material={steel} position-y={h / 2}>
                  <cylinderGeometry args={[0.02, 0.03, h, 4]} />
                </mesh>
                <mesh material={glass} position-y={h}>
                  <sphereGeometry args={[0.06, 6, 4]} />
                </mesh>
              </group>
            ))}
            </>
          )}
          {has.cooling && (
            <>
            {/* Carga: caja con panel solar y fardos atados */}
            <group position={[-0.72, DECK, -2.25]}>
              <mesh material={metal} position-y={0.33} castShadow>
                <boxGeometry args={[0.78, 0.66, 0.8]} />
              </mesh>
              <mesh material={solar} position-y={0.67}>
                <boxGeometry args={[0.7, 0.03, 0.72]} />
              </mesh>
            </group>
            <group position={[0.62, DECK, -2.3]}>
              <mesh material={sack} position={[0, 0.25, 0]} castShadow>
                <boxGeometry args={[0.72, 0.5, 1.0]} />
              </mesh>
              <mesh material={sack} position={[0, 0.66, 0.05]} rotation-y={0.12} castShadow>
                <boxGeometry args={[0.62, 0.34, 0.82]} />
              </mesh>
              {[-0.3, 0.3].map((z) => (
                <mesh key={z} material={rope} position={[0, 0.42, z]}>
                  <boxGeometry args={[0.76, 0.86, 0.05]} />
                </mesh>
              ))}
            </group>
            {/* Barriles a popa, a estribor */}
            {[-3.25, -3.85].map((z) => (
              <group key={z} position={[1.15, DECK, z]}>
                <mesh material={wood} position-y={0.3} castShadow>
                  <cylinderGeometry args={[0.24, 0.27, 0.6, 8]} />
                </mesh>
                {[0.12, 0.48].map((y) => (
                  <mesh key={y} material={steel} position-y={y}>
                    <cylinderGeometry args={[0.275, 0.275, 0.04, 8]} />
                  </mesh>
                ))}
              </group>
            ))}
            </>
          )}
          {/* Popa reforzada: defensa de goma a lo ancho del espejo, cinta naranja y bitas en las esquinas */}
          <mesh material={MATERIALS.shipDark} position={[0, 1.05, HULL.stern - 0.06]} castShadow>
            <boxGeometry args={[hullHalfBeam(HULL.stern) * 2 + 0.12, 0.3, 0.2]} />
          </mesh>
          <mesh material={MATERIALS.shipAccent} position={[0, 1.34, HULL.stern - 0.04]}>
            <boxGeometry args={[hullHalfBeam(HULL.stern) * 2 + 0.06, 0.1, 0.14]} />
          </mesh>
          {[-1, 1].map((sx) => (
            <group key={sx} position={[sx * (hullHalfBeam(HULL.stern + 0.3) - 0.22), gunwaleAt(HULL.stern + 0.3), HULL.stern + 0.3]}>
              <mesh material={steel} position-y={0.22} castShadow>
                <cylinderGeometry args={[0.1, 0.12, 0.44, 8]} />
              </mesh>
              <mesh material={steel} position-y={0.46}>
                <cylinderGeometry args={[0.15, 0.15, 0.06, 8]} />
              </mesh>
            </group>
          ))}
          {has.engine && (
            <>
            {/* Motor de la nave a popa: tobera, engranaje y chimenea */}
            <group position={[0, ENGINE.y, ENGINE.z]}>
              {/* Bancada de acero sobre la que va atornillado el motor */}
              <mesh material={steel} position={[0, -0.5, 0.15]} castShadow>
                <boxGeometry args={[1.6, 0.44, 1.7]} />
              </mesh>
              <mesh material={steel} rotation-x={Math.PI / 2} castShadow>
                <cylinderGeometry args={[0.6, 0.74, 1.7, 12]} />
              </mesh>
              <mesh material={metal} position-z={-0.9} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.76, 0.66, 0.24, 12]} />
              </mesh>
              <mesh material={MATERIALS.shipDark} position-z={-1.03} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.5, 0.5, 0.04, 12]} />
              </mesh>
              {[-0.45, 0.45].map((z) => (
                <mesh key={z} material={MATERIALS.shipAccent} position-z={z} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.7, 0.7, 0.08, 12]} />
                </mesh>
              ))}
              {/* Engranaje en el costado */}
              <group position={[-0.68, 0.05, 0.1]} rotation-z={Math.PI / 2}>
                <mesh material={steel}>
                  <cylinderGeometry args={[0.32, 0.32, 0.1, 12]} />
                </mesh>
                {Array.from({ length: 10 }, (_, i) => (
                  <mesh key={i} material={steel} rotation-y={(i * Math.PI) / 5} position={[Math.cos((i * Math.PI) / 5) * 0.34, 0, -Math.sin((i * Math.PI) / 5) * 0.34]}>
                    <boxGeometry args={[0.1, 0.1, 0.08]} />
                  </mesh>
                ))}
              </group>
            </group>
            <group position={[STACK.x, DECK, STACK.z]}>
              <mesh material={metal} position-y={(STACK.top - DECK) / 2} castShadow>
                <cylinderGeometry args={[0.12, 0.14, STACK.top - DECK, 8]} />
              </mesh>
              <mesh material={metal} position={[0, STACK.top - DECK + 0.08, -0.06]} rotation-x={-0.5}>
                <cylinderGeometry args={[0.16, 0.13, 0.3, 8]} />
              </mesh>
            </group>
            {/* Eje, hélice y timón naranja con su herraje al espejo de popa */}
            <mesh material={steel} position={[0, 0.15, HULL.stern - 0.25]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.06, 0.06, 0.6, 6]} />
            </mesh>
            <group ref={prop} position={[0, 0.15, HULL.stern - 0.55]}>
              <mesh material={steel} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.1, 0.12, 0.18, 8]} />
              </mesh>
              {[0, 1, 2, 3].map((i) => (
                <group key={i} rotation-z={(i * Math.PI) / 2}>
                  <mesh material={wood} position-y={0.28} rotation-y={0.5}>
                    <boxGeometry args={[0.18, 0.46, 0.04]} />
                  </mesh>
                </group>
              ))}
            </group>
            {[0.55, 1.2].map((y) => (
              <mesh key={y} material={steel} position={[0, y, HULL.stern - 0.38]}>
                <boxGeometry args={[0.2, 0.16, 0.76]} />
              </mesh>
            ))}
            <group ref={rudder} position={[0, 0, HULL.stern - 0.7]}>
              <mesh material={MATERIALS.shipAccent} position={[0, 0.85, -0.45]} castShadow>
                <boxGeometry args={[0.16, 2.3, 0.92]} />
              </mesh>
              <mesh material={MATERIALS.shipDark} position={[0, 1.7, -0.45]}>
                <boxGeometry args={[0.2, 0.14, 0.96]} />
              </mesh>
              <mesh material={MATERIALS.shipDark} position={[0, 0.05, -0.45]}>
                <boxGeometry args={[0.2, 0.14, 0.96]} />
              </mesh>
            </group>
            </>
          )}
          {/* Trozo de ala como flotador lateral, con dos puntales hasta la borda */}
          <group position={[-2.55, BOAT.draft + 0.05, -0.6]}>
            <mesh material={MATERIALS.shipHull} castShadow>
              <boxGeometry args={[0.9, 0.24, 2.3]} />
            </mesh>
            <mesh material={MATERIALS.shipAccent} position={[-0.47, 0, 0]}>
              <boxGeometry args={[0.1, 0.26, 2.3]} />
            </mesh>
            <mesh material={MATERIALS.shipAccent} position={[0, 0.005, 0.95]}>
              <boxGeometry args={[0.92, 0.25, 0.32]} />
            </mesh>
          </group>
          {[0.2, -1.4].map((z) => {
            const s = segment([-2.4, BOAT.draft + 0.15, z], [-(hullHalfBeam(z) - 0.1), gunwaleAt(z) - 0.1, z], 0)
            return (
              <mesh key={z} material={wood} position={s.p} rotation={[s.pitch, s.yaw, 0, 'YXZ']}>
                <cylinderGeometry args={[0.06, 0.06, s.len + 0.1, 5]} />
              </mesh>
            )
          })}
        </group>
      </Outlined>
      {has.engine && <StackSmoke />}
    </group>
  )
}

/** Tramo recto entre dos puntos (para cilindros a lo largo de él), alzado `lift`. */
function segment(a: [number, number, number], b: [number, number, number], lift: number) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const horiz = Math.hypot(dx, dz)
  return {
    p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + lift, (a[2] + b[2]) / 2] as [number, number, number],
    len: Math.hypot(dx, dy, dz),
    yaw: Math.atan2(dx, dz),
    pitch: Math.atan2(horiz, dy),
  }
}

const PUFFS = 10

/** Bocanadas de humo de la chimenea: suben, se agrandan y se quedan atrás. */
function StackSmoke() {
  const ref = useRef<InstancedMesh>(null)
  const { mat, puffs, dummy } = useMemo(
    () => ({
      mat: new MeshBasicMaterial({ color: '#d9dde2', transparent: true, opacity: 0.55, depthWrite: false }),
      puffs: Array.from({ length: PUFFS }, (_, i) => ({ age: (i / PUFFS) * 2.4, x: 0, z: 0 })),
      dummy: new Object3D(),
    }),
    [],
  )
  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return
    const dt = Math.min(delta, 0.05)
    puffs.forEach((p, i) => {
      p.age += dt * (0.8 + boat.speed * 0.05)
      if (p.age > 2.4) {
        p.age -= 2.4
        p.x = 0
        p.z = 0
      }
      // Con marcha el humo se queda atrás (hacia popa).
      p.z -= dt * (0.3 + boat.speed * 0.7)
      p.x += dt * 0.15
      const k = p.age / 2.4
      dummy.position.set(STACK.x + p.x, STACK.top + 0.25 + k * 1.6, STACK.z - 0.1 + p.z)
      dummy.scale.setScalar(0.1 + k * 0.32)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, mat, PUFFS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}
