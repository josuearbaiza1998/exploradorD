import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Euler, InstancedMesh, MeshBasicMaterial, Object3D, Vector3, type Group } from 'three'
import { BOAT, BOAT_MOOR, PIER, PIER_HEADING } from '@/config/boat'
import { ISLAND } from '@/config/world'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { getGame, useGameStore } from '@/store/gameStore'
import { isShipRepaired } from '@/store/slices/explorationSlice'
import { boat, boatLamp, floatBoat, stepBoat } from '@/systems/boat'
import { cameraAxes } from '@/systems/cameraRig'
import { getMoveVector } from '@/systems/input'
import { seaState } from '@/systems/sea'
import { getHeight } from '@/utils/terrain/heightfield'
import { BoatModel, LAMP_LOCAL } from './BoatModel'

const _lamp = new Vector3()

/** Muelle de tablones sobre postes, de la playa al amarre. */
function Pier() {
  const len = Math.hypot(PIER.to.x - PIER.from.x, PIER.to.z - PIER.from.z)
  const cx = (PIER.from.x + PIER.to.x) / 2
  const cz = (PIER.from.z + PIER.to.z) / 2
  const plank = sharedToon('#a87b4f')
  const posts = useMemo(() => {
    const out: { x: number; z: number; y: number; h: number }[] = []
    for (let t = 0; t <= 1.001; t += 1 / 6) {
      for (const side of [-1, 1]) {
        const x = PIER.from.x + (PIER.to.x - PIER.from.x) * t + Math.cos(PIER_HEADING) * side * (PIER.halfWidth - 0.2)
        const z = PIER.from.z + (PIER.to.z - PIER.from.z) * t - Math.sin(PIER_HEADING) * side * (PIER.halfWidth - 0.2)
        const ground = getHeight(x, z)
        out.push({ x, z, y: (ground + PIER.y) / 2, h: PIER.y - ground + 0.4 })
      }
    }
    return out
  }, [])
  return (
    <group>
      <group position={[cx, PIER.y - 0.12, cz]} rotation-y={PIER_HEADING}>
        {Array.from({ length: Math.floor(len / 0.9) }, (_, i) => (
          <mesh key={i} material={plank} position-z={-len / 2 + 0.45 + i * 0.9} rotation-y={(i % 3) * 0.02} castShadow receiveShadow>
            <boxGeometry args={[PIER.halfWidth * 2, 0.16, 0.8]} />
          </mesh>
        ))}
      </group>
      {posts.map((p, i) => (
        <mesh key={i} material={MATERIALS.palmTrunk} position={[p.x, p.y, p.z]} castShadow>
          <cylinderGeometry args={[0.16, 0.18, Math.max(0.5, p.h), 6]} />
        </mesh>
      ))}
    </group>
  )
}

const WAKE = 24

/** Estela de espuma: anillos blancos que se abren y se desvanecen tras la popa. */
function Wake() {
  const ref = useRef<InstancedMesh>(null)
  const { geo, mat, rings, dummy } = useMemo(
    () => ({
      geo: new CircleGeometry(1, 16).rotateX(-Math.PI / 2),
      mat: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }),
      rings: Array.from({ length: WAKE }, () => ({ x: 0, z: 0, age: 99 })),
      dummy: new Object3D(),
    }),
    [],
  )
  const spawn = useRef(0)
  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return
    const dt = Math.min(delta, 0.1)
    if (boat.speed > 1 && (spawn.current -= dt) <= 0) {
      spawn.current = 0.16
      const r = rings.reduce((a, b) => (b.age > a.age ? b : a))
      r.x = boat.x - Math.sin(boat.heading) * (BOAT.halfLength + 0.5)
      r.z = boat.z - Math.cos(boat.heading) * (BOAT.halfLength + 0.5)
      r.age = 0
    }
    rings.forEach((r, i) => {
      r.age += dt
      const k = r.age / 2.2
      dummy.position.set(r.x, ISLAND.seaLevel + 0.12, r.z)
      dummy.scale.setScalar(k < 1 ? 0.4 + k * 1.9 : 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, WAKE]} frustumCulled={false} renderOrder={2} />
}

/**
 * El barco: la nave adaptada, flotando junto al muelle de la playa este.
 * Se mece con las olas; cuando el robot la pilota, la mueve el controlador.
 */
export function Boat() {
  const launched = useGameStore(isShipRepaired)
  const group = useRef<Group>(null)
  const euler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), [])

  useEffect(() => {
    boat.launched = launched
    if (!launched) return
    const saved = useGameStore.getState().boatPos
    const [x, z, h] = saved ?? [BOAT_MOOR.x, BOAT_MOOR.z, BOAT_MOOR.heading]
    boat.x = x
    boat.z = z
    boat.heading = h
  }, [launched])

  useFrame((_, delta) => {
    const g = group.current
    if (!g || !launched) return
    const dt = Math.min(delta, 0.05)
    // El barco se mueve aquí, antes que el robot y la cámara: si se moviera
    // después, el casco se pintaría con la posición del frame anterior y
    // temblaría respecto al robot a toda marcha.
    if (boat.boating && getGame().mode === 'active') {
      const move = getMoveVector()
      const axes = cameraAxes()
      stepBoat(dt, axes.rightX * move.x + axes.forwardX * move.y, axes.rightZ * move.x + axes.forwardZ * move.y, seaState.time)
    } else floatBoat(seaState.time, dt)
    g.position.set(boat.x, boat.y - BOAT.draft, boat.z)
    euler.set(boat.pitch, boat.heading, boat.roll)
    g.rotation.copy(euler)
    // Farol del mástil en el mundo, con la pose de este mismo frame (el dron va ahí).
    g.updateMatrixWorld()
    g.localToWorld(_lamp.copy(LAMP_LOCAL))
    boatLamp.x = _lamp.x
    boatLamp.y = _lamp.y
    boatLamp.z = _lamp.z
    boatLamp.valid = true
  })

  // El muelle está desde el principio; el barco aparece amarrado al botarlo.
  if (!launched) return <Pier />
  return (
    <>
      <Pier />
      <group ref={group} name="boat">
        <BoatModel afloat />
      </group>
      <Wake />
    </>
  )
}
