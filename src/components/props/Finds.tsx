import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { PALETTE } from '@/config/palette'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import type { Find } from '@/store/slices/explorationSlice'
import { getHeight } from '@/utils/terrain/heightfield'

/** Montículo de arena con una placa de metal asomando y un destello. */
function Buried({ find }: { find: Find }) {
  const spark = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = spark.current
    if (!g) return
    const k = Math.max(0, Math.sin(clock.elapsedTime * 2.5 + find.x))
    g.scale.setScalar(k * k)
    g.rotation.z = clock.elapsedTime
  })
  return (
    <group position={[find.x, getHeight(find.x, find.z), find.z]} rotation-y={find.z}>
      <mesh material={sharedToon(PALETTE.sandDark)} scale={[1, 0.35, 1]} receiveShadow castShadow>
        <icosahedronGeometry args={[0.7, 0]} />
      </mesh>
      <mesh material={MATERIALS.shipHull} position={[0.1, 0.3, 0]} rotation={[0.5, 0.3, 0.4]} castShadow>
        <boxGeometry args={[0.5, 0.05, 0.4]} />
      </mesh>
      <mesh material={MATERIALS.shipAccent} position={[-0.2, 0.22, 0.15]} rotation={[0.2, 0, -0.6]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 6]} />
      </mesh>
      <group ref={spark} position={[0.15, 0.6, 0]}>
        <mesh material={sharedToon('#fff6c8', { emissive: '#fff2a0', emissiveIntensity: 2 })} userData={{ noOutline: true }}>
          <octahedronGeometry args={[0.12, 0]} />
        </mesh>
      </group>
    </group>
  )
}

/** Mata con flores rosas que brota tras la lluvia. */
function Bloom({ find }: { find: Find }) {
  const leaf = sharedToon('#5f9e45')
  const petal = sharedToon('#ff7fb0', { emissive: '#ff5d9e', emissiveIntensity: 0.25 })
  return (
    <group position={[find.x, getHeight(find.x, find.z), find.z]} rotation-y={find.x}>
      <mesh material={leaf} scale={[1, 0.6, 1]} position-y={0.2} castShadow>
        <icosahedronGeometry args={[0.38, 0]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={petal} position={[Math.cos(i * 1.7) * 0.25, 0.42 + (i % 2) * 0.08, Math.sin(i * 1.7) * 0.25]}>
          <icosahedronGeometry args={[0.1, 0]} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Donde cayó un rayo: arena quemada, vidrio de fulgurita brillando y unas
 * llamas que duran poco (la lluvia las apaga).
 */
function Fulgurite({ find }: { find: Find }) {
  const born = useRef(performance.now() / 1000)
  const fire = useRef<Group>(null)
  const glass = sharedToon('#cfe9ff', { emissive: '#7fc8ff', emissiveIntensity: 0.9 })
  const scorch = sharedToon('#2a211d')
  const flame = sharedToon('#ffb03a', { emissive: '#ff7a1a', emissiveIntensity: 2.2 })
  useFrame(({ clock }) => {
    const g = fire.current
    if (!g) return
    const age = performance.now() / 1000 - born.current
    const k = Math.max(0, 1 - age / 25)
    g.visible = k > 0
    g.children.forEach((c, i) => {
      c.scale.setScalar(k * (0.7 + Math.abs(Math.sin(clock.elapsedTime * (9 + i * 2) + i)) * 0.6))
    })
  })
  return (
    <group position={[find.x, getHeight(find.x, find.z), find.z]} rotation-y={find.x * 3}>
      <mesh material={scorch} rotation-x={-Math.PI / 2} position-y={0.03}>
        <circleGeometry args={[1.3, 9]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} material={glass} position={[Math.cos(i * 1.3) * 0.35, 0.18, Math.sin(i * 1.3) * 0.35]} rotation={[0.4 * (i % 2 ? 1 : -1), i, 0.5]} userData={{ noOutline: true }}>
          <cylinderGeometry args={[0.03, 0.06, 0.45, 5]} />
        </mesh>
      ))}
      <group ref={fire}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={flame} position={[Math.cos(i * 2.1) * 0.5, 0.35, Math.sin(i * 2.1) * 0.5]} userData={{ noOutline: true }}>
            <coneGeometry args={[0.22, 0.75, 5]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/**
 * Meteorito recién caído: cráter oscuro, roca negra con grietas incandescentes
 * que se enfrían con las horas y un hilo de humo.
 */
function Meteorite({ find }: { find: Find }) {
  const glow = useRef<Group>(null)
  const smoke = useRef<Group>(null)
  const crater = sharedToon('#3b2f29')
  const rock = sharedToon('#2c2a33')
  const ember = sharedToon('#ffb36b', { emissive: '#ff6a1a', emissiveIntensity: 2 })
  const puff = sharedToon('#a8a29c')
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (glow.current) glow.current.scale.setScalar(0.85 + Math.sin(t * 3 + find.x) * 0.15)
    smoke.current?.children.forEach((c, i) => {
      const k = (t * 0.35 + i / 3) % 1
      c.position.set(Math.sin(k * 5 + i) * 0.2, 0.6 + k * 2.4, Math.cos(k * 4 + i) * 0.2)
      c.scale.setScalar(0.15 + k * 0.45)
    })
  })
  return (
    <group position={[find.x, getHeight(find.x, find.z), find.z]} rotation-y={find.z}>
      <mesh material={crater} rotation-x={-Math.PI / 2} position-y={0.03}>
        <circleGeometry args={[2.2, 10]} />
      </mesh>
      <mesh material={sharedToon(PALETTE.sandDark)} position-y={0.02} rotation-x={-Math.PI / 2} scale={[1.25, 1.25, 0.5]}>
        <torusGeometry args={[0.85, 0.28, 4, 10]} />
      </mesh>
      <mesh material={rock} position-y={0.3} rotation={[0.4, 0.2, 0.7]} castShadow>
        <dodecahedronGeometry args={[0.5, 0]} />
      </mesh>
      <group ref={glow} position-y={0.3}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={ember} position={[Math.cos(i * 1.6) * 0.42, Math.sin(i * 2.3) * 0.2, Math.sin(i * 1.6) * 0.42]} rotation={[i, i * 0.7, 0]} userData={{ noOutline: true }}>
            <boxGeometry args={[0.08, 0.32, 0.05]} />
          </mesh>
        ))}
      </group>
      <group ref={smoke}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={puff} userData={{ noOutline: true }}>
            <icosahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const FIND_VIEW = { buried: Buried, bloom: Bloom, fulgurite: Fulgurite, meteorite: Meteorite }

/** Hallazgos del clima en el mundo. */
export function Finds() {
  const finds = useGameStore((s) => s.finds)
  return (
    <>
      {finds.map((f) => {
        const View = FIND_VIEW[f.kind]
        return <View key={f.id} find={f} />
      })}
    </>
  )
}
