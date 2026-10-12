import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicMaterial, type Group, type Mesh } from 'three'
import { sharedToon, MATERIALS } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { NOTE_WORLD } from '@/systems/interaction/interactables'
import { radialTexture } from '@/utils/radialTexture'

/** Halo en la arena bajo los registros sin leer (compartido: late a la vez). */
const haloMaterial = new MeshBasicMaterial({ color: '#bfefff', map: radialTexture(), transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false })
const glintMaterial = sharedToon('#fffbe0', { emissive: '#fff2b0', emissiveIntensity: 2.2 })

/** Tableta de datos: la pantalla parpadea hasta leerla. */
function Pad({ read, x }: { read: boolean; x: number }) {
  const screen = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (screen.current) screen.current.visible = read || Math.sin(clock.elapsedTime * 3 + x) > -0.4
  })
  const glow = read ? sharedToon('#3a6d7a') : sharedToon('#7fe3ff', { emissive: '#3ad0ff', emissiveIntensity: 1.3 })
  return (
    <group rotation={[-0.25, 0, 0.1]}>
      <mesh material={MATERIALS.shipDark} castShadow>
        <boxGeometry args={[0.55, 0.08, 0.4]} />
      </mesh>
      <mesh ref={screen} material={glow} position-y={0.045} userData={{ noOutline: true }}>
        <boxGeometry args={[0.45, 0.02, 0.3]} />
      </mesh>
    </group>
  )
}

/** Disquete medio enterrado: carcasa azul, persiana metálica y etiqueta. */
function Disk() {
  return (
    <group rotation={[-0.35, 0, 0.15]}>
      <mesh material={sharedToon('#2c4f8f')} castShadow>
        <boxGeometry args={[0.4, 0.035, 0.42]} />
      </mesh>
      <mesh material={sharedToon('#c9ced4')} position={[0, 0.02, -0.13]} userData={{ noOutline: true }}>
        <boxGeometry args={[0.2, 0.012, 0.15]} />
      </mesh>
      <mesh material={sharedToon('#f2ead8')} position={[0, 0.02, 0.09]} userData={{ noOutline: true }}>
        <boxGeometry args={[0.3, 0.012, 0.18]} />
      </mesh>
    </group>
  )
}

/** Tuerca grande con algo grabado en las caras. */
function Nut() {
  return (
    <group rotation={[0.2, 0.4, -0.15]}>
      <mesh material={sharedToon('#a9a296')} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.16, 6]} />
      </mesh>
      <mesh material={sharedToon('#3a352f')} userData={{ noOutline: true }}>
        <cylinderGeometry args={[0.1, 0.1, 0.17, 10]} />
      </mesh>
    </group>
  )
}

/**
 * Registro tirado en el mundo. Mientras no se ha leído, un halo suave late en
 * la arena y de vez en cuando le salta un destello: se distingue sin gritar.
 */
function NoteProp({ x, y, z, id, rot, kind }: { x: number; y: number; z: number; id: string; rot: number; kind: 'pad' | 'disk' | 'nut' }) {
  const read = useGameStore((s) => !!s.notesRead[id])
  const glint = useRef<Group>(null)
  useFrame(({ clock }) => {
    const g = glint.current
    if (!g) return
    // Destello corto cada ~4 s, desfasado por registro.
    const k = Math.max(0, Math.sin(clock.elapsedTime * 1.6 + x * 0.7) - 0.85) / 0.15
    g.visible = k > 0.01
    g.scale.setScalar(k * 0.9)
    g.rotation.y = clock.elapsedTime * 3
  })
  return (
    <group position={[x, y + 0.08, z]} rotation-y={rot}>
      {kind === 'disk' ? <Disk /> : kind === 'nut' ? <Nut /> : <Pad read={read} x={x} />}
      {!read && (
        <>
          <mesh material={haloMaterial} rotation-x={-Math.PI / 2} position-y={-0.05} renderOrder={2}>
            <planeGeometry args={[1.6, 1.6]} />
          </mesh>
          <group ref={glint} position-y={0.35}>
            <mesh material={glintMaterial} userData={{ noOutline: true }} scale={[0.08, 0.22, 0.08]}>
              <octahedronGeometry args={[1, 0]} />
            </mesh>
            <mesh material={glintMaterial} userData={{ noOutline: true }} scale={[0.22, 0.08, 0.08]}>
              <octahedronGeometry args={[1, 0]} />
            </mesh>
          </group>
        </>
      )}
    </group>
  )
}

export function Notes() {
  // El halo late suave para todos a la vez.
  useFrame(({ clock }) => {
    haloMaterial.opacity = 0.18 + Math.sin(clock.elapsedTime * 1.8) * 0.1
  })
  const notes = useMemo(() => NOTE_WORLD, [])
  return (
    <>
      {notes.map((n, i) => (
        <NoteProp key={n.id} id={n.id} x={n.x} y={n.y} z={n.z} rot={i * 1.3} kind={n.kind ?? 'pad'} />
      ))}
    </>
  )
}
