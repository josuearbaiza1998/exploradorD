import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CHARGING_PAD } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { PALETTE } from '@/config/palette'
import { getGame } from '@/store/gameStore'
import { cameraAxes } from '@/systems/cameraRig'
import { focus } from '@/systems/focus'
import { consumeJump, getMoveVector } from '@/systems/input'
import { MOTOR_CONFIG, simpleMotor } from '@/systems/physics/characterMotor'
import { upgradeEffects } from '@/config/upgrades'
import { player } from '@/systems/player'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import { ROBOT_RIGGED, RobotModel } from './RobotModel'

const RUN_SPEED = 6.5
const BASE_JUMP = MOTOR_CONFIG.jumpSpeed
/** Segundos con el stick al máximo para activar el sprint. */
const SPRINT_HOLD = 3
/** Velocidad del piloto automático en modo emergencia (renqueante). */
const AUTOPILOT_SPEED = 2.4
/** Batería (%) bajo la que las gafas parpadean en rojo. */
const LOW_LENS_BELOW = 15
/** Batería (%) bajo la que el robot cojea. */
const LIMP_BELOW = 9
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
  const sprintSince = useRef(-1)

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
      const fx = upgradeEffects(getGame().upgrades)
      // Sprint: stick al máximo durante SPRINT_HOLD segundos; al soltarlo se corta.
      const full = Math.hypot(move.x, move.y) >= 0.97
      // Reloj real (no el dt recortado): 3 s son 3 s aunque el móvil vaya a pocos fps.
      const now = performance.now() / 1000
      if (!full) sprintSince.current = -1
      else if (sprintSince.current < 0) sprintSince.current = now
      player.sprintCharge = sprintSince.current < 0 ? 0 : Math.min(1, (now - sprintSince.current) / SPRINT_HOLD)
      player.sprinting = player.sprintCharge >= 1
      MOTOR_CONFIG.jumpSpeed = BASE_JUMP * fx.jump
      // Con la batería casi agotada el robot cojea y va más lento.
      const limp = getGame().battery < LIMP_BELOW ? 0.7 : 1
      const speed = limp * RUN_SPEED * fx.speed * (player.sprinting ? fx.sprint : 1) * (environment.sheltered ? 1 : weatherState.speed) * (1 - headwind * storm * 0.35)
      targetX = dirX * speed
      targetZ = dirZ * speed
      // Las ráfagas fuertes empujan al robot (sensación de tormenta).
      if (!environment.sheltered && storm > 0) {
        pushX = wind.dirX * storm * 0.9
        pushZ = wind.dirZ * storm * 0.9
      }
      jump = consumeJump()
    } else {
      player.sprintCharge = 0
      player.sprinting = false
      sprintSince.current = -1
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
    // Cojera con muy poca batería: balanceo irregular al andar.
    const battery = getGame().battery
    if (body.current && ROBOT_RIGGED) {
      const limping = mode === 'active' && battery < LIMP_BELOW && player.grounded && player.speed > 0.5
      const t = state.clock.elapsedTime
      const target = limping ? Math.max(0, Math.sin(t * 7)) * 0.14 - 0.03 : 0
      body.current.rotation.z += (target - body.current.rotation.z) * (1 - Math.exp(-12 * dt))
      body.current.position.y = limping ? -Math.max(0, Math.sin(t * 7)) * 0.07 : 0
    }
    // Visor: se apaga en emergencia, parpadea durante la recarga y en rojo
    // cuando queda poca batería.
    const t = state.clock.elapsedTime
    const low = mode === 'active' && battery < LOW_LENS_BELOW
    const blinkOn = Math.sin(t * (battery < LIMP_BELOW ? 10 : 5)) > 0
    MATERIALS.robotAccent.color.set(low && blinkOn ? '#ff3b30' : PALETTE.robotAccent)
    MATERIALS.robotAccent.emissive.set(low && blinkOn ? '#ff3b30' : PALETTE.robotAccent)
    MATERIALS.robotAccent.emissiveIntensity =
      mode === 'active' ? (low ? (blinkOn ? 1.2 : 0.15) : 0.6) : mode === 'recharging' ? 0.25 + Math.sin(t * 2) * 0.2 : 0.05
  })

  return (
    <group ref={root} name="robot">
      <group ref={body}>
        <RobotModel />
      </group>
    </group>
  )
}
