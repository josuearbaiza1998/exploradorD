import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { DoubleSide, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, type Material, type MeshStandardMaterial, type Texture } from 'three'
import { Outlined } from '@/components/common/Outlined'
import { createToonMaterial } from '@/materials/toonMaterials'
import { boat } from '@/systems/boat'
import type { RepairId } from '@/config/repairs'
import { STACK_TOP } from './boatLayout'

export { LAMP_LOCAL } from './boatLayout'

type Parts = Partial<Record<RepairId, true>>

/** Modelo hecho en Tripo y adaptado con scripts/import-tripo-boat.cjs (mallas meshopt). */
const BOAT_GLB = '/models/boat.glb'
useGLTF.preload(BOAT_GLB, false, true)

const PART_GROUPS: [string, RepairId][] = [
  ['part_navigation', 'navigation'],
  ['part_comms', 'comms'],
  ['part_cooling', 'cooling'],
  ['part_engine', 'engine'],
]

/** Materiales toon equivalentes a los del .glb (uno por material, compartidos). */
const toonCache = new Map<string, Material>()
function toToon(src: MeshStandardMaterial): Material {
  let m = toonCache.get(src.name)
  if (!m) {
    const map = src.map as Texture | null
    m = createToonMaterial({
      color: src.color.clone(),
      ...(map ? { map } : {}),
      ...(src.emissiveIntensity > 0 && src.emissive.getHex() !== 0 ? { emissive: src.emissive.clone(), emissiveIntensity: src.emissiveIntensity } : {}),
      ...(src.side === DoubleSide ? { side: DoubleSide } : {}),
      flatShading: !!src.userData?.flat,
    })
    m.name = src.name
    toonCache.set(src.name, m)
  }
  return m
}

/**
 * El barco: la nave convertida en barquito (modelo .glb). Se anima la aleta,
 * la hélice y los banderines (y el timón y la tobera si el modelo los trae).
 * En el astillero (`parts`) solo se ve lo ya reparado.
 */
export function BoatModel(props: { afloat?: boolean; parts?: Parts }) {
  return (
    <Suspense fallback={null}>
      <BoatGlb {...props} />
    </Suspense>
  )
}

function BoatGlb({ afloat = false, parts }: { afloat?: boolean; parts?: Parts }) {
  const has = (afloat ? { hull: true, comms: true, navigation: true, cooling: true, engine: true } : parts ?? {}) as Parts
  const { scene } = useGLTF(BOAT_GLB, false, true)
  const model = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      if (o instanceof Mesh) {
        o.material = toToon(o.material as MeshStandardMaterial)
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const find = (n: string) => root.getObjectByName(n) ?? null
    return {
      root,
      wheel: find('wheel'),
      rudder: find('rudder'),
      prop: find('prop'),
      flags: [find('flag0'), find('flag1')],
      glow: find('glow'),
      groups: PART_GROUPS.map(([n, id]) => [find(n), id] as const),
    }
  }, [scene])

  model.groups.forEach(([g, id]) => {
    if (g) g.visible = !!has[id]
  })

  const spin = useRef(0)
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    if (model.wheel) model.wheel.rotation.z = -boat.rudder * 2.2
    if (model.rudder) model.rudder.rotation.y = -boat.rudder * 0.55
    // Hélice al ralentí; con marcha, más rápido.
    spin.current += dt * (1 + boat.speed * 0.5)
    const s = spin.current
    if (model.prop) model.prop.rotation.z = s * 2.4
    model.flags.forEach((f, i) => {
      if (f) f.rotation.y = Math.sin(t * (5 + i * 1.3) + i) * 0.28 + Math.min(0.5, boat.speed * 0.03) * (i ? -1 : 1) * 0.3
    })
    if (model.glow) model.glow.scale.setScalar(0.9 + Math.sin(t * 3) * 0.08 + Math.min(0.2, boat.speed * 0.02))
  })

  return (
    <group>
      <Outlined thickness={0.035}>
        <primitive object={model.root} />
      </Outlined>
      {has.engine && <StackSmoke />}
    </group>
  )
}

const PUFFS = 14

/** Humo de la chimenea en ráfagas: tres bocanadas seguidas y una pausa. */
function StackSmoke() {
  const ref = useRef<InstancedMesh>(null)
  const { mat, puffs, dummy } = useMemo(
    () => ({
      mat: new MeshBasicMaterial({ color: '#d9dde2', transparent: true, opacity: 0.4, depthWrite: false }),
      puffs: Array.from({ length: PUFFS }, () => ({ age: 99, x: 0, z: 0 })),
      dummy: new Object3D(),
    }),
    [],
  )
  const timer = useRef({ next: 0, burst: 0 })
  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const tm = timer.current
    tm.next -= dt
    if (tm.next <= 0) {
      const free = puffs.reduce((a, b) => (b.age > a.age ? b : a))
      free.age = 0
      free.x = 0
      free.z = 0
      tm.burst++
      tm.next = tm.burst % 3 === 0 ? Math.max(0.6, 1.8 - boat.speed * 0.1) : 0.14
    }
    puffs.forEach((p, i) => {
      p.age += dt
      const k = p.age / 2.2
      if (k < 1) {
        p.z -= dt * (0.25 + boat.speed * 0.7)
        p.x += dt * 0.12
        dummy.position.set(STACK_TOP.x + p.x, STACK_TOP.y + 0.15 + k * 1.4, STACK_TOP.z - 0.1 + p.z)
        dummy.scale.setScalar((0.1 + k * 0.3) * (k < 0.15 ? k / 0.15 : 1))
      } else dummy.scale.setScalar(0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, mat, PUFFS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}
