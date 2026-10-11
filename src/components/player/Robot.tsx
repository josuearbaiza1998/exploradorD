import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { cameraAxes } from '@/systems/cameraRig'
import { focus } from '@/systems/focus'
import { consumeJump, getMoveVector } from '@/systems/input'
import { simpleMotor } from '@/systems/physics/characterMotor'
import { player } from '@/systems/player'
import { RobotModel } from './RobotModel'

const RUN_SPEED = 6.5
const ACCELERATION = 10
const TURN_SPEED = 10

/** Diferencia angular más corta en [-PI, PI]. */
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/**
 * Controlador en tercera persona del robot.
 * Lee la entrada, la orienta según la cámara y delega el movimiento en el
 * CharacterMotor (hoy cinemático, mañana Rapier si hace falta).
 */
export function Robot() {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const wish = useRef({ x: 0, z: 0 })

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const move = getMoveVector()
    const axes = cameraAxes()

    // Dirección deseada relativa a la cámara (joystick analógico => velocidad analógica).
    const targetX = (axes.rightX * move.x + axes.forwardX * move.y) * RUN_SPEED
    const targetZ = (axes.rightZ * move.x + axes.forwardZ * move.y) * RUN_SPEED
    const k = 1 - Math.exp(-ACCELERATION * dt)
    wish.current.x += (targetX - wish.current.x) * k
    wish.current.z += (targetZ - wish.current.z) * k

    simpleMotor.step(player, wish.current.x, wish.current.z, consumeJump(), dt)
    player.speed = Math.hypot(player.velocity.x, player.velocity.z)

    // Girar el modelo hacia donde se mueve.
    if (Math.hypot(targetX, targetZ) > 0.3) {
      const targetHeading = Math.atan2(targetX, targetZ)
      player.heading += angleDelta(player.heading, targetHeading) * (1 - Math.exp(-TURN_SPEED * dt))
    }

    focus.copy(player.position)

    if (root.current) {
      root.current.position.copy(player.position)
      root.current.rotation.y = player.heading
    }
    // Animación procedural del placeholder: inclinación y balanceo al andar.
    if (body.current) {
      const t = state.clock.elapsedTime
      const run = Math.min(player.speed / RUN_SPEED, 1)
      body.current.rotation.x = run * 0.18
      body.current.position.y = player.grounded ? Math.abs(Math.sin(t * 9)) * 0.08 * run : 0
      body.current.rotation.z = Math.sin(t * 9) * 0.04 * run
    }
  })

  return (
    <group ref={root} name="robot">
      <group ref={body}>
        <RobotModel />
      </group>
    </group>
  )
}
