import { boat } from '@/systems/boat'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BOAT } from '@/config/boat'
import { Vector3 } from 'three'
import { cameraRig } from '@/systems/cameraRig'
import { consumeLook } from '@/systems/input'
import { queryColliders } from '@/systems/physics/staticColliders'
import { player } from '@/systems/player'
import { hitFx } from '@/systems/hitFx'
import { clamp } from '@/utils/math'
import { getHeight } from '@/utils/terrain/heightfield'
import { cave, caveContains } from '@/config/cave'

const TARGET_HEIGHT = 1.7
const MIN_GROUND_CLEARANCE = 0.6
const FOLLOW_SHARPNESS = 14
const CAMERA_RADIUS = 0.35
const CAVE_CAMERA_DISTANCE = 5.2

type Obstacle = { x: number; z: number; r: number; top: number }
const obstacles: Obstacle[] = []

/** Rocas, troncos y la nave cerca del brazo de la cámara, con su altura absoluta. */
function gatherObstacles(x: number, z: number, reach: number) {
  obstacles.length = 0
  if (cave.active) return
  for (const c of queryColliders(x, z, reach)) {
    if (Math.hypot(c.x - x, c.z - z) > reach + c.r) continue
    obstacles.push({ x: c.x, z: c.z, r: c.r + CAMERA_RADIUS, top: getHeight(c.x, c.z) + c.h })
  }
}

function blocked(x: number, y: number, z: number): boolean {
  // Dentro de la cueva la cámara no puede atravesar paredes ni techo.
  if (cave.active) return !caveContains(x, y, z, 0.35)
  if (y < getHeight(x, z) + MIN_GROUND_CLEARANCE) return true
  for (const o of obstacles) {
    if (y < o.top && (x - o.x) ** 2 + (z - o.z) ** 2 < o.r * o.r) return true
  }
  return false
}

/**
 * Cámara en tercera persona: orbita con el arrastre del lado derecho de la
 * pantalla y se acerca al robot si una duna, roca o tronco se interpone.
 */
export function ThirdPersonCamera() {
  const camera = useThree((s) => s.camera)
  const target = useMemo(() => new Vector3(), [])
  const desired = useMemo(() => new Vector3(), [])
  const smoothed = useMemo(() => new Vector3().copy(player.position), [])

  const lastTeleport = useRef(player.teleportId)
  const smoothDist = useRef(cameraRig.distance)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    // Tras un teletransporte (regreso a la nave) la cámara salta sin suavizado.
    if (lastTeleport.current !== player.teleportId) {
      lastTeleport.current = player.teleportId
      smoothed.copy(player.position)
      cameraRig.yaw = player.heading + Math.PI
    }
    const look = consumeLook()
    cameraRig.yaw -= look.x * cameraRig.sensitivity
    cameraRig.pitch = clamp(cameraRig.pitch + look.y * cameraRig.sensitivity, cameraRig.minPitch, cameraRig.maxPitch)

    // Seguimiento suave del objetivo (evita tirones al saltar o bajar dunas).
    if (boat.boating) {
      // A bordo: sigue al barco sin retraso en horizontal (si no, a toda marcha
      // el retraso varía con cada frame y todo parece vibrar) y filtra en
      // vertical el cabeceo y el oleaje, para que la cámara no se maree.
      const s = Math.sin(boat.heading)
      const c = Math.cos(boat.heading)
      smoothed.x = boat.x + BOAT.deck.x * c + BOAT.deck.z * s
      smoothed.z = boat.z - BOAT.deck.x * s + BOAT.deck.z * c
      smoothed.y += (boat.y - BOAT.draft + BOAT.deck.y - smoothed.y) * (1 - Math.exp(-2.5 * dt))
    } else smoothed.lerp(player.position, 1 - Math.exp(-FOLLOW_SHARPNESS * dt))
    target.set(smoothed.x, smoothed.y + TARGET_HEIGHT, smoothed.z)

    const cosP = Math.cos(cameraRig.pitch)
    const dirX = Math.sin(cameraRig.yaw) * cosP
    const dirY = Math.sin(cameraRig.pitch)
    const dirZ = Math.cos(cameraRig.yaw) * cosP

    // Si una duna, roca o tronco se interpone, acercamos la cámara (muestreo del brazo).
    // En la cueva la cámara va más cerca (el túnel no deja sitio para más).
    // A bordo se aleja para ver el barco entero.
    const reach = cave.active ? Math.min(cameraRig.distance, CAVE_CAMERA_DISTANCE) : boat.boating ? Math.max(cameraRig.distance, 10) : cameraRig.distance
    gatherObstacles(target.x, target.z, reach)
    let dist = reach
    const SAMPLES = 12
    for (let i = 1; i <= SAMPLES; i++) {
      const d = (reach * i) / SAMPLES
      if (blocked(target.x + dirX * d, target.y + dirY * d, target.z + dirZ * d)) {
        dist = Math.max(1.2, d - reach / SAMPLES)
        break
      }
    }
    // Suavizado de la distancia: sin saltos bruscos al rozar una pared.
    smoothDist.current += (dist - smoothDist.current) * (dist < smoothDist.current ? 1 : 1 - Math.exp(-5 * dt))
    dist = smoothDist.current

    desired.set(target.x + dirX * dist, target.y + dirY * dist, target.z + dirZ * dist)
    if (!cave.active) desired.y = Math.max(desired.y, getHeight(desired.x, desired.z) + MIN_GROUND_CLEARANCE)
    camera.position.copy(desired)
    camera.lookAt(target)
    // Temblor breve al golpear (más fuerte al romper algo).
    if (hitFx.shake > 0) {
      const k = hitFx.shake * hitFx.shake * 0.12
      camera.position.x += (Math.random() - 0.5) * k
      camera.position.y += (Math.random() - 0.5) * k
      camera.position.z += (Math.random() - 0.5) * k
    }
  })

  return null
}
