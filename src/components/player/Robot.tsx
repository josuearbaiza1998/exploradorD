import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CHARGING_PAD } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { PALETTE } from '@/config/palette'
import { thermal } from '@/systems/thermal'
import { grapple, stepGrapple } from '@/systems/grapple'
import { getGame } from '@/store/gameStore'
import { cameraAxes } from '@/systems/cameraRig'
import { focus } from '@/systems/focus'
import { consumeJump, getMoveVector, input } from '@/systems/input'
import { MOTOR_CONFIG, simpleMotor, wallBlock, waterBlock } from '@/systems/physics/characterMotor'
import { getHeight, getSlope } from '@/utils/terrain/heightfield'
import { upgradeEffects } from '@/config/upgrades'
import { player } from '@/systems/player'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import { boat, deckPosition, stepBoat } from '@/systems/boat'
import { seaState } from '@/systems/sea'
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
  const lean = useRef<Group>(null)
  const wish = useRef({ x: 0, z: 0 })
  const sprintSince = useRef(-1)
  const wallNoticeAt = useRef(-100)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const mode = getGame().mode
    let targetX = 0
    let targetZ = 0
    let jump = false
    let pushX = 0
    let pushZ = 0

    if (mode === 'active' && boat.boating) {
      // A bordo: el stick pilota el barco (relativo a la cámara) y el robot va en cubierta.
      const move = getMoveVector()
      const axes = cameraAxes()
      stepBoat(dt, axes.rightX * move.x + axes.forwardX * move.y, axes.rightZ * move.x + axes.forwardZ * move.y, seaState.time)
      consumeJump()
      player.sprintCharge = 0
      player.sprinting = false
      player.bracing = false
      player.headwind = 0
    } else if (mode === 'active') {
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
      MOTOR_CONFIG.canClimb = fx.climb > 0
      MOTOR_CONFIG.climbSpeed = fx.climbSpeed
      MOTOR_CONFIG.canDive = fx.dive > 0
      MOTOR_CONFIG.diveSpeed = fx.diveSpeed
      MOTOR_CONFIG.swimSpeed = fx.swimSpeed
      // Nadando: el botón de salto sube y el de bucear baja (mantenidos).
      MOTOR_CONFIG.swimInput = (input.jumpHeld ? 1 : 0) - (input.diveHeld ? 1 : 0)
      MOTOR_CONFIG.buoyant = false
      // Con la batería casi agotada el robot cojea y va más lento.
      const limp = (getGame().battery < LIMP_BELOW ? 0.7 : 1) * (thermal.overheated ? 0.6 : 1)
      const speed = limp * RUN_SPEED * fx.speed * (player.sprinting ? fx.sprint : 1) * (environment.sheltered ? 1 : weatherState.speed) * (1 - headwind * storm * 0.35)
      targetX = dirX * speed
      targetZ = dirZ * speed
      // Las ráfagas fuertes empujan al robot (sensación de tormenta). Quieto,
      // se planta contra el viento y apenas se desliza.
      const exposed = !environment.sheltered && storm > 0 && !player.climbing
      player.bracing = exposed && Math.hypot(move.x, move.y) < 0.15 && player.grounded
      player.headwind = exposed && !player.bracing ? Math.min(1, headwind * storm) : 0
      if (exposed) {
        const k = player.bracing ? 0.3 : 0.9
        pushX = wind.dirX * storm * k
        pushZ = wind.dirZ * storm * k
      }
      jump = consumeJump()
      // Aviso al chocar con una pared de roca sin garras.
      if (now - wallBlock.at < 0.2 && now - wallNoticeAt.current > 25 && fx.climb === 0) {
        wallNoticeAt.current = now
        getGame().notify('🧗 Pared de roca: hacen falta garras de escalada (mejora en la nave)', 'warn')
      }
      // Aviso al llegar a agua honda sin el sellado.
      if (now - waterBlock.at < 1 && now - wallNoticeAt.current > 25 && fx.dive === 0) {
        wallNoticeAt.current = now
        getGame().notify('🌊 Demasiado hondo: el agua dañaría los circuitos. Hace falta el sellado estanco (mejora en la nave)', 'warn')
      }
    } else {
      player.sprintCharge = 0
      player.sprinting = false
      player.bracing = false
      player.headwind = 0
      sprintSince.current = -1
      // Sin control, el sellado lo sube flotando a la superficie.
      MOTOR_CONFIG.swimInput = 0
      MOTOR_CONFIG.buoyant = true
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

    // A bordo va pegado a la cubierta; con el gancho vuela en arco; si no, el motor normal.
    if (boat.boating) {
      deckPosition(player.position)
      player.velocity.set(0, 0, 0)
      player.grounded = true
      player.inWater = false
      player.underwater = false
      player.swimming = false
      player.climbing = false
      player.heading = boat.heading
      wish.current.x = 0
      wish.current.z = 0
    } else if (stepGrapple(dt)) {
      wish.current.x = 0
      wish.current.z = 0
    } else simpleMotor.step(player, wish.current.x, wish.current.z, jump, dt)
    player.speed = Math.hypot(player.velocity.x, player.velocity.z)

    // Girar el modelo hacia donde se mueve; trepando, de cara a la pared;
    // aguantando la tormenta, de cara al viento.
    let face: number | null = null
    if (player.climbing) {
      const px = player.position.x
      const pz = player.position.z
      face = Math.atan2(getHeight(px + 0.6, pz) - getHeight(px - 0.6, pz), getHeight(px, pz + 0.6) - getHeight(px, pz - 0.6))
    } else if (player.bracing) face = Math.atan2(-wind.dirX, -wind.dirZ)
    else if (Math.hypot(targetX, targetZ) > 0.3) face = Math.atan2(targetX, targetZ)
    if (!grapple.active && !boat.boating && face !== null) {
      player.heading += angleDelta(player.heading, face) * (1 - Math.exp(-(player.bracing ? 4 : TURN_SPEED) * dt))
    }
    // Inclinación del cuerpo: hacia la pared al trepar, hacia delante contra el viento.
    if (lean.current) {
      const t = state.clock.elapsedTime
      const kk = 1 - Math.exp(-6 * dt)
      let want = player.bracing ? 0.3 + Math.sin(t * 17) * 0.025 : player.headwind * 0.22
      let sway = 0
      let back = 0
      let up = 0
      if (player.climbing) {
        // El cuerpo se pega a la pared: paralelo a la roca, según lo empinada que esté.
        const slope = getSlope(player.position.x, player.position.z, 0.75)
        want = Math.min(0.95, Math.max(0.35, Math.PI / 2 - Math.atan(slope)))
        player.climbPhase += dt * Math.min(1, player.speed / 1.1) * 3.2
        // Cada tirón sube el cuerpo y lo balancea hacia el brazo que agarra.
        const ph = player.climbPhase * Math.PI * 2
        sway = Math.sin(ph) * 0.09
        up = 0.32 + Math.abs(Math.sin(ph)) * 0.1
        back = -0.5 - want * 0.25
      }
      if (player.swimming) {
        // Nadando: tumbado y avanzando; quieto, casi erguido pataleando. El
        // cuerpo se sube y se centra para quedar a flor de agua.
        const m = Math.min(1, player.speed / 1.4)
        player.swimPhase += dt * (0.45 + m * 0.75)
        const dive = player.underwater ? Math.max(-0.5, Math.min(0.5, -player.velocity.y * 0.25)) : 0
        want = 0.15 + m * (1.2 + dive)
        sway = Math.sin(player.swimPhase * Math.PI * 2) * 0.14 * m
        up = m * 1.1
        back = -m * 0.95
      }
      // En el barco el cuerpo se mece con las olas.
      if (boat.boating) {
        want = boat.pitch
        sway = boat.roll
      }
      lean.current.rotation.x += (want - lean.current.rotation.x) * kk
      lean.current.rotation.z += (sway - lean.current.rotation.z) * kk
      // Trepando se separa de la pared para no meterse dentro de la roca.
      lean.current.position.z += (back - lean.current.position.z) * kk
      lean.current.position.y += (up - lean.current.position.y) * kk
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
      <group ref={lean}>
        <group ref={body}>
          <RobotModel />
        </group>
      </group>
    </group>
  )
}
