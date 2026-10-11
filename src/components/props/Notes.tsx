import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { sharedToon, MATERIALS } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { NOTE_WORLD } from '@/systems/interaction/interactables'

/** Tableta de datos tirada en la arena; la pantalla parpadea hasta leerla. */
function NotePad({ x, y, z, id, rot }: { x: number; y: number; z: number; id: string; rot: number }) {
  const read = useGameStore((s) => !!s.notesRead[id])
  const screen = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (screen.current) screen.current.visible = read || Math.sin(clock.elapsedTime * 3 + x) > -0.4
  })
  const glow = read ? sharedToon('#3a6d7a') : sharedToon('#7fe3ff', { emissive: '#3ad0ff', emissiveIntensity: 1.3 })
  return (
    <group position={[x, y + 0.08, z]} rotation={[-0.25, rot, 0.1]}>
      <mesh material={MATERIALS.shipDark} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.4]} />
      </mesh>
      <mesh ref={screen} material={glow} position-y={0.045} userData={{ noOutline: true }}>
        <boxGeometry args={[0.45, 0.02, 0.3]} />
      </mesh>
    </group>
  )
}

export function Notes() {
  return (
    <>
      {NOTE_WORLD.map((n, i) => (
        <NotePad key={n.id} id={n.id} x={n.x} y={n.y} z={n.z} rot={i * 1.3} />
      ))}
    </>
  )
}
