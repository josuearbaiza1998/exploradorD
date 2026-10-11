import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CHARGING_PAD } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { getGame } from '@/store/gameStore'
import { cameraAxes } from '@/systems/cameraRig'
import { focus } from '@/systems/focus'
import { consumeJump, getMoveVector } from '@/systems/input'
import { simpleMotor } from '@/systems/physics/characterMotor'
import { player } from '@/systems/player'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import { ROBOT_RIGGED, RobotModel } from './RobotModel'

const RUN_SPEED = 6.5
/** Velocidad del piloto automático en modo emergencia (renqueante). */
const AUTOPILOT_SPEED = 2.4
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
    const mode = getGame().mode
    let targetX = 0
    let targetZ = 0
    let jump = false
    let pushX = 0
    let pushZ = 0

    if (mode === 'active') {
      // Dirección deseada relativa a la cámara (joystick analógico => velocidad analógica).
      const move = getMoveVector()
      const axes = cameraAxes()
      const dirX = axes.rightX * move.x + axes.forwardX * move.y
      const dirZ = axes.rightZ * move.x + axes.forwardZ * move.y
      // Clima: la lluvia y la arena frenan; contra el viento de tormenta cuesta más.
      const len = Math.hypot(dirX, dirZ)
      const headwind = len > 0 ? Math.max(0, -(dirX * wind.dirX + dirZ * wind.dirZ) / len) : 0
      const storm = Math.max(0, wind.strength - 0.6) * 2.5
      const speed = RUN_SPEED * (environment.sheltered ? 1 : weatherState.speed) * (1 - headwind * storm * 0.35)
      targetX = dirX * speed
      targetZ = dirZ * speed
      // Las ráfagas fuertes empujan al robot (sensación de tormenta).
      if (!environment.sheltered && storm > 0) {
        pushX = wind.dirX * storm * 0.9
        pushZ = wind.dirZ * storm * 0.9
      }
      jump = consumeJump()
    } else {
      consumeJump() // descartar pulsaciones durante la emergencia
      if (mode === 'returning') {
        // Piloto automático: se dirige a la plataforma de recarga de la nave.
        const dx = CHARGING_PAD.x - player.position.x
        const dz = CHARGING_PAD.z - player.position.z
        const len = Math.hypot(dx, dz) || 1
        targetX = (dx / len) * AUTOPILOT_SPEED
        targetZ = (dz / len) * AUTOPILOT_SPEED
      }
    }

    const k = 1 - Math.exp(-ACCELERATION * dt)
    wish.current.x += (targetX + pushX - wish.current.x) * k
    wish.current.z += (targetZ + pushZ - wish.current.z) * k

    simpleMotor.step(player, wish.current.x, wish.current.z, jump, dt)
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
    if (body.current && !ROBOT_RIGGED) {
      const t = state.clock.elapsedTime
      const run = Math.min(player.speed / RUN_SPEED, 1)
      // Emergencia/recarga: el robot se encorva ("modo reposo").
      const slump = mode === 'active' ? 0 : mode === 'recharging' ? 0.35 : 0.5
      const kk = 1 - Math.exp(-6 * dt)
      body.current.rotation.x += (run * 0.18 + slump - body.current.rotation.x) * kk
      body.current.position.y = player.grounded ? Math.abs(Math.sin(t * 9)) * 0.08 * run : 0
      body.current.rotation.z = Math.sin(t * 9) * 0.04 * run
      // Golpe: embestida corta hacia delante al recolectar.
      const since = performance.now() / 1000 - player.actionAt
      if (since < 0.3) {
        const punch = Math.sin((since / 0.3) * Math.PI)
        body.current.rotation.x += punch * 0.35
        body.current.position.z = punch * 0.25
      } else {
        body.current.position.z = 0
      }
    }
    // Visor: se apaga en emergencia y parpadea durante la recarga.
    MATERIALS.robotAccent.emissiveIntensity =
      mode === 'active' ? 0.6 : mode === 'recharging' ? 0.25 + Math.sin(state.clock.elapsedTime * 2) * 0.2 : 0.05
  })

  return (
    <group ref={root} name="robot">
      <group ref={body}>
        <RobotModel />
      </group>
    </group>
  )
}
