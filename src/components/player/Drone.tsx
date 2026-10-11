import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh, PointLight } from 'three'
import { MeshBasicMaterial } from 'three'
import { useGameStore, getGame } from '@/store/gameStore'
import { sharedToon } from '@/materials/toonMaterials'
import { PALETTE } from '@/config/palette'
import { player } from '@/systems/player'
import { thermal } from '@/systems/thermal'
import { environment } from '@/systems/environmentState'
import { groundAt } from '@/systems/physics/characterMotor'

/** Hueco tras el robot y a su izquierda (local: +x izquierda vista desde atrás). */
const OFFSET_SIDE = 1.1
const OFFSET_BACK = 1.2
const HEIGHT = 2.1
const FOLLOW = 3.5

const eyeMat = new MeshBasicMaterial({ color: PALETTE.robotAccent, toneMapped: false })

/**
 * Dron acompañante: flota detrás del robot, carga 10 de material extra,
 * alumbra de noche y avisa con un parpadeo rojo si la batería está baja o
 * el robot se recalienta. No rastrea recursos: explorar es cosa del jugador.
 */
export function Drone() {
  const owned = useGameStore((s) => !!s.inventory.drone)
  if (!owned) return null
  return <DroneBody />
}

function DroneBody() {
  const root = useRef<Group>(null)
  const rotors = useRef<Group[]>([])
  const eye = useRef<Mesh>(null)
  const lamp = useRef<PointLight>(null)
  const placed = useRef(false)
  const shell = sharedToon(PALETTE.robot)
  const dark = sharedToon(PALETTE.robotDark)
  const joint = sharedToon(PALETTE.robotJoint)

  useFrame((state, delta) => {
    const g = root.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const h = player.heading
    const s = Math.sin(h)
    const c = Math.cos(h)
    // Detrás (-forward) y a la izquierda del robot.
    const tx = player.position.x - s * OFFSET_BACK + c * OFFSET_SIDE
    const tz = player.position.z - c * OFFSET_BACK - s * OFFSET_SIDE
    const floor = Math.max(groundAt(tx, tz), player.position.y)
    const ty = floor + HEIGHT + Math.sin(t * 2.2) * 0.12
    if (!placed.current) {
      g.position.set(tx, ty, tz)
      placed.current = true
    }
    const k = 1 - Math.exp(-FOLLOW * dt)
    const dx = tx - g.position.x
    const dz = tz - g.position.z
    // Lejos (teletransporte, cueva) salta directo.
    if (dx * dx + dz * dz > 400) g.position.set(tx, ty, tz)
    else g.position.set(g.position.x + dx * k, g.position.y + (ty - g.position.y) * k, g.position.z + dz * k)
    // Mira hacia donde mira el robot y se inclina al avanzar.
    g.rotation.y += Math.atan2(Math.sin(h - g.rotation.y), Math.cos(h - g.rotation.y)) * k
    g.rotation.x = Math.min(0.35, Math.hypot(dx, dz) * 0.15)
    g.rotation.z = Math.sin(t * 1.3) * 0.05
    for (const r of rotors.current) if (r) r.rotation.y += dt * 40

    // Ojo: rojo intermitente si hay problema, azul si todo va bien.
    const warn = getGame().battery < 15 || thermal.overheated || thermal.heat > 0.7
    const on = Math.sin(t * 8) > 0
    eyeMat.color.set(warn ? (on ? '#ff3b30' : '#3a0d0b') : PALETTE.robotAccent)
    // Linterna de noche o en la cueva.
    if (lamp.current) {
      const want = !environment.isDay || environment.inCave ? 1 : 0
      lamp.current.intensity += (want * 6 - lamp.current.intensity) * k
      lamp.current.visible = lamp.current.intensity > 0.05
    }
  })

  return (
    <group ref={root} name="drone">
      <mesh material={shell} castShadow>
        <sphereGeometry args={[0.22, 14, 10]} />
      </mesh>
      <mesh material={dark} position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.08, 12]} />
      </mesh>
      <mesh ref={eye} material={eyeMat} position={[0, 0.02, 0.19]}>
        <sphereGeometry args={[0.075, 10, 8]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2
        const x = Math.cos(a) * 0.38
        const z = Math.sin(a) * 0.38
        return (
          <group key={i}>
            <mesh material={joint} position={[x / 2, 0, z / 2]} rotation-y={-a}>
              <boxGeometry args={[0.38, 0.04, 0.05]} />
            </mesh>
            <group position={[x, 0.06, z]} ref={(r) => { if (r) rotors.current[i] = r }}>
              <mesh material={dark}>
                <boxGeometry args={[0.32, 0.015, 0.05]} />
              </mesh>
            </group>
          </group>
        )
      })}
      <pointLight ref={lamp} color="#cfe9ff" intensity={0} distance={14} decay={1.6} position={[0, -0.3, 0.4]} />
    </group>
  )
}
