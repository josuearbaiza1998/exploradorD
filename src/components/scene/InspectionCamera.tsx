import { useRef, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CRASH_SITE, SPAWN } from '@/config/world'
import { focus } from '@/systems/focus'
import { getHeight } from '@/utils/terrain/heightfield'

const spawnY = getHeight(SPAWN.x, SPAWN.z)

// Cámara inicial detrás del robot, mirando hacia el humo de la nave.
const dirX = CRASH_SITE.x - SPAWN.x
const dirZ = CRASH_SITE.z - SPAWN.z
const len = Math.hypot(dirX, dirZ)
export const INITIAL_CAMERA: [number, number, number] = [
  SPAWN.x - (dirX / len) * 9,
  spawnY + 4.5,
  SPAWN.z - (dirZ / len) * 9,
]

/**
 * Cámara de INSPECCIÓN (solo Fase 1): orbitar/zoom/arrastrar para revisar
 * el diseño del nivel. Se sustituirá por la cámara en tercera persona del
 * controlador del robot en la Fase 2.
 */
export function InspectionCamera() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  useFrame(() => {
    const target = controls.current?.target
    if (target) focus.copy(target)
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[SPAWN.x + (dirX / len) * 6, spawnY + 2.5, SPAWN.z + (dirZ / len) * 6]}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI * 0.49}
      minDistance={3}
      maxDistance={260}
      screenSpacePanning={false}
    />
  )
}
