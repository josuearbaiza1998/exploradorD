import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { sharedToon } from '@/materials/toonMaterials'
import { scavengers, updateScavengers } from '@/systems/scavengers'
import { getHeight } from '@/utils/terrain/heightfield'

/** Carroñeros: los mueve systems/scavengers.ts; aquí solo se dibujan y animan. */
export function Scavengers() {
  const refs = useRef<(Group | null)[]>([])
  useFrame(({ clock }, delta) => {
    updateScavengers(Math.min(delta, 0.05))
    const t = clock.elapsedTime
    scavengers.forEach((s, i) => {
      const g = refs.current[i]
      if (!g) return
      g.visible = s.active
      if (!s.active) return
      const moving = s.speed > 0.2
      g.position.set(s.x, getHeight(s.x, s.z) + (moving ? Math.abs(Math.sin(t * 18 + i)) * 0.05 : 0), s.z)
      g.rotation.y = s.heading
      // Patas: correteo rápido; quieto, rebusca agachado.
      const body = g.children[0] as Group
      body.rotation.x = moving ? 0.1 : 0.35 + Math.sin(t * 6 + i) * 0.08
      const legs = g.children[1] as Group
      legs.children.forEach((leg, k) => {
        leg.rotation.x = moving ? Math.sin(t * 22 + k * Math.PI * 0.5 + i) * 0.6 : 0
      })
      const sack = g.children[2]
      sack.visible = Object.keys(s.loot).length > 0
    })
  })
  const rust = sharedToon('#8a5a3c')
  const dark = sharedToon('#3a2f2a')
  const eye = sharedToon('#ff4a2e', { emissive: '#ff3a1e', emissiveIntensity: 2 })
  const cloth = sharedToon('#a98c5b')
  return (
    <>
      {scavengers.map((s, i) => (
        <group key={s.id} ref={(g) => (refs.current[i] = g)} visible={false} scale={1.4}>
          <group position-y={0.42}>
            <mesh material={rust} castShadow>
              <boxGeometry args={[0.46, 0.26, 0.6]} />
            </mesh>
            <mesh material={dark} position={[0, 0.18, 0.18]} castShadow>
              <sphereGeometry args={[0.16, 8, 6]} />
            </mesh>
            <mesh material={eye} position={[0, 0.2, 0.33]} userData={{ noOutline: true }}>
              <sphereGeometry args={[0.05, 6, 5]} />
            </mesh>
            <mesh material={dark} position={[0.12, 0.38, 0.12]} rotation-z={-0.3}>
              <cylinderGeometry args={[0.012, 0.012, 0.32, 4]} />
            </mesh>
            {/* Pinza para rebuscar */}
            <mesh material={dark} position={[-0.18, -0.02, 0.36]} rotation-x={0.6}>
              <boxGeometry args={[0.05, 0.05, 0.28]} />
            </mesh>
          </group>
          <group>
            {[
              [0.24, 0.2],
              [-0.24, 0.2],
              [0.24, -0.2],
              [-0.24, -0.2],
            ].map(([x, z], k) => (
              <group key={k} position={[x, 0.36, z]}>
                <mesh material={dark} position-y={-0.18} rotation-z={x > 0 ? -0.35 : 0.35}>
                  <boxGeometry args={[0.05, 0.38, 0.05]} />
                </mesh>
              </group>
            ))}
          </group>
          {/* Saco con lo robado */}
          <mesh material={cloth} position={[0, 0.72, -0.22]} visible={false} castShadow>
            <icosahedronGeometry args={[0.2, 0]} />
          </mesh>
        </group>
      ))}
    </>
  )
}
