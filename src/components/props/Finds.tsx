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

/** Hallazgos del clima en el mundo. */
export function Finds() {
  const finds = useGameStore((s) => s.finds)
  return (
    <>
      {finds.map((f) => (f.kind === 'buried' ? <Buried key={f.id} find={f} /> : <Bloom key={f.id} find={f} />))}
    </>
  )
}
