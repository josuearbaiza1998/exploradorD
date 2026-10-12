import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three'
import { ISLAND } from '@/config/world'
import { SUNKEN_CRATES } from '@/config/sunken'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { sunkenKey } from '@/systems/interaction/interactables'
import { player } from '@/systems/player'
import { getHeight } from '@/utils/terrain/heightfield'

/** Caja de carga hundida, algo ladeada, con algas pegadas. */
function Crate({ x, z, rot, opened }: { x: number; z: number; rot: number; opened: boolean }) {
  const y = getHeight(x, z)
  const rust = sharedToon('#7a5a3e')
  const weed = sharedToon('#3f8f5a', { bands: 2 })
  return (
    <group position={[x, y, z]} rotation={[0.12, rot, -0.08]}>
      <mesh material={rust} position-y={0.4} castShadow>
        <boxGeometry args={[1.1, 0.8, 0.8]} />
      </mesh>
      <mesh material={MATERIALS.shipDark} position-y={0.4}>
        <boxGeometry args={[1.14, 0.12, 0.84]} />
      </mesh>
      {!opened && (
        <mesh material={rust} position={[0, 0.85, 0]}>
          <boxGeometry args={[1.12, 0.1, 0.82]} />
        </mesh>
      )}
      {opened && (
        <mesh material={rust} position={[0.5, 0.95, 0.1]} rotation-z={-1.1}>
          <boxGeometry args={[1.12, 0.1, 0.82]} />
        </mesh>
      )}
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={weed} position={[-0.7 + i * 0.25, 0.5 + i * 0.1, 0.5 - i * 0.3]} rotation-z={0.2 * (i - 1)}>
          <coneGeometry args={[0.08, 1 + i * 0.3, 4]} />
        </mesh>
      ))}
    </group>
  )
}

const BUBBLES = 14

/** Burbujas que suben del robot mientras está sumergido. */
function Bubbles() {
  const ref = useRef<InstancedMesh>(null)
  const { geo, mat, state } = useMemo(
    () => ({
      geo: new IcosahedronGeometry(1, 0),
      mat: new MeshBasicMaterial({ color: '#d9f6ff', transparent: true, opacity: 0.7 }),
      state: Array.from({ length: BUBBLES }, () => ({ x: 0, y: -999, z: 0, s: 0.05, v: 1 })),
    }),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  const spawn = useRef(0)
  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return
    const dt = Math.min(delta, 0.1)
    const under = player.underwater
    m.visible = under || state.some((b) => b.y > -900)
    if (!m.visible) return
    if (under && (spawn.current -= dt) <= 0) {
      spawn.current = 0.18 + Math.random() * 0.3
      const b = state.find((q) => q.y < -900)
      if (b) {
        b.x = player.position.x + (Math.random() - 0.5) * 0.4
        b.z = player.position.z + (Math.random() - 0.5) * 0.4
        b.y = player.position.y + 1.4
        b.s = 0.04 + Math.random() * 0.06
        b.v = 0.8 + Math.random() * 0.8
      }
    }
    const surface = ISLAND.seaLevel
    state.forEach((b, i) => {
      if (b.y > -900) {
        b.y += b.v * dt
        b.x += Math.sin(b.y * 4 + i) * dt * 0.2
        if (b.y > surface) b.y = -999
      }
      dummy.position.set(b.x, b.y, b.z)
      dummy.scale.setScalar(b.y > -900 ? b.s : 0)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, BUBBLES]} frustumCulled={false} />
}

/** Lo que hay bajo el mar: el cargamento hundido y las burbujas del robot buceando. */
export function Underwater() {
  const harvested = useGameStore((s) => s.harvested)
  return (
    <>
      {SUNKEN_CRATES.map((c, i) => (
        <Crate key={i} x={c.x} z={c.z} rot={c.rot} opened={sunkenKey(i) in harvested} />
      ))}
      <Bubbles />
    </>
  )
}
