import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { cameraRig } from '@/systems/cameraRig'
import { consumeLook } from '@/systems/input'
import { player } from '@/systems/player'
import { clamp } from '@/utils/math'
import { getHeight } from '@/utils/terrain/heightfield'

const TARGET_HEIGHT = 1.7
const MIN_GROUND_CLEARANCE = 0.6
const FOLLOW_SHARPNESS = 14

/**
 * Cámara en tercera persona: orbita con el arrastre del lado derecho de la
 * pantalla y evita meterse dentro de las dunas acercándose al robot.
 */
export function ThirdPersonCamera() {
  const camera = useThree((s) => s.camera)
  const target = useMemo(() => new Vector3(), [])
  const desired = useMemo(() => new Vector3(), [])
  const smoothed = useMemo(() => new Vector3().copy(player.position), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const look = consumeLook()
    cameraRig.yaw -= look.x * cameraRig.sensitivity
    cameraRig.pitch = clamp(cameraRig.pitch + look.y * cameraRig.sensitivity, cameraRig.minPitch, cameraRig.maxPitch)

    // Seguimiento suave del objetivo (evita tirones al saltar o bajar dunas).
    smoothed.lerp(player.position, 1 - Math.exp(-FOLLOW_SHARPNESS * dt))
    target.set(smoothed.x, smoothed.y + TARGET_HEIGHT, smoothed.z)

    const cosP = Math.cos(cameraRig.pitch)
    const dirX = Math.sin(cameraRig.yaw) * cosP
    const dirY = Math.sin(cameraRig.pitch)
    const dirZ = Math.cos(cameraRig.yaw) * cosP

    // Si el terreno se interpone, acercamos la cámara (muestreo a lo largo del brazo).
    let dist = cameraRig.distance
    const SAMPLES = 8
    for (let i = 1; i <= SAMPLES; i++) {
      const d = (cameraRig.distance * i) / SAMPLES
      const x = target.x + dirX * d
      const y = target.y + dirY * d
      const z = target.z + dirZ * d
      if (y < getHeight(x, z) + MIN_GROUND_CLEARANCE) {
        dist = Math.max(1.5, d - cameraRig.distance / SAMPLES)
        break
      }
    }

    desired.set(target.x + dirX * dist, target.y + dirY * dist, target.z + dirZ * dist)
    desired.y = Math.max(desired.y, getHeight(desired.x, desired.z) + MIN_GROUND_CLEARANCE)
    camera.position.copy(desired)
    camera.lookAt(target)
  })

  return null
}
