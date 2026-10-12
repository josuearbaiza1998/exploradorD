import type { Vector3 } from 'three'
import { pierDeck } from '@/config/boat'
import { isClimbWall, ISLAND, OASIS } from '@/config/world'
import { getHeight, getSlope } from '@/utils/terrain/heightfield'
import { ecology } from '@/systems/ecology'
import { seaSurface } from '@/systems/sea'
import { queryColliders } from './staticColliders'
import { cave, caveCanEnter, caveFloor } from '@/config/cave'

/** Suelo bajo el robot: el terreno o, dentro de la cueva, su propio suelo. */
export const groundAt = (x: number, z: number) => {
  if (cave.active) return caveFloor(x, z)
  const h = getHeight(x, z)
  // La tarima del muelle (cuando el barco ya existe) se pisa por encima del agua.
  if (pier.on) {
    const deck = pierDeck(x, z)
    if (deck !== null && deck > h) return deck
  }
  return h
}

/** El muelle existe (lo activa <Boat/> al botar el barco). */
export const pier = { on: false }

/**
 * Motor de personaje "cinemático" ligero (sin motor de físicas).
 *
 * Todo el movimiento pasa por esta interfaz. Si en el futuro hace falta
 * física real (Rapier), se escribe otra implementación de CharacterMotor y
 * el controlador del robot no cambia.
 */
export type CharacterBody = {
  position: Vector3
  velocity: Vector3
  grounded: boolean
  inWater: boolean
  /** Está trepando una pared de roca (lo calcula el motor). */
  climbing: boolean
  /** Completamente sumergido (buceando). */
  underwater?: boolean
  /** Nadando en agua honda (con el sellado estanco). */
  swimming?: boolean
}

export interface CharacterMotor {
  groundHeight(x: number, z: number): number
  /** Mueve el cuerpo con una velocidad horizontal deseada (m/s). */
  step(body: CharacterBody, wishX: number, wishZ: number, jump: boolean, dt: number): void
}

export const MOTOR_CONFIG = {
  radius: 0.45,
  gravity: 24,
  jumpSpeed: 9.6,
  /** Pendiente máxima subible (1 = 45°). */
  maxSlope: 1.05,
  /** Profundidad de agua a partir de la cual el robot no entra (no es sumergible). */
  maxWaterDepth: 0.9,
  waterSpeedFactor: 0.55,
  /** Distancia máxima para "pegarse" al suelo al bajar pendientes. */
  snapDistance: 0.45,
  /** Tiene garras de escalada (lo pone el controlador según las mejoras). */
  canClimb: false,
  /** Velocidad al trepar (m/s). */
  climbSpeed: 1.7,
  /** Tiene el sellado estanco: puede entrar en agua honda, nadar y bucear. */
  canDive: false,
  /** Multiplicador de velocidad bajo el agua. */
  diveSpeed: 0.55,
  /** Multiplicador de velocidad nadando en la superficie. */
  swimSpeed: 0.5,
  /** Orden vertical al nadar: 1 subir, -1 bucear, 0 mantenerse (lo pone el controlador). */
  swimInput: 0,
  /** Sin control (emergencia): el sellado lo devuelve flotando a la superficie. */
  buoyant: false,
}

/** Último intento bloqueado por agua honda (para avisar al jugador). */
export const waterBlock = { at: -10 }

/** Profundidad de agua a partir de la cual el robot (con sellado) nada en vez de andar. */
export const SWIM_DEPTH = 1.6
/** Al nadar en la superficie los pies quedan esto por debajo del agua (hombros fuera). */
export const SWIM_FLOAT = 1.3
/** Con la cabeza esto por debajo de su altura de flote, va buceando. */
const SUBMERGED = 0.55
const SWIM_RISE = 2.4

/** Último intento bloqueado por una pared de roca (para avisar al jugador). */
export const wallBlock = { at: -10 }

const SLOPE_STEP = 0.75

function waterDepth(x: number, z: number, ground: number): number {
  return Math.max(waterLevel(x, z) - ground, 0)
}

/** Altura de la superficie del agua (el mar con sus olas o la laguna del oasis). */
export function waterLevel(x: number, z: number): number {
  const sea = ISLAND.enabled ? seaSurface(x, z) : -Infinity
  const oasisDist = Math.hypot(x - OASIS.x, z - OASIS.z)
  const oasis = oasisDist < OASIS.radius * 1.45 ? ecology.oasisLevel : -Infinity
  return Math.max(sea, oasis)
}

function canEnter(x: number, z: number, fromY: number, fromGround: number): boolean {
  if (cave.active) return caveCanEnter(x, z, MOTOR_CONFIG.radius)
  const ground = groundAt(x, z)
  if (!MOTOR_CONFIG.canDive && waterDepth(x, z, ground) > MOTOR_CONFIG.maxWaterDepth) {
    waterBlock.at = performance.now() / 1000
    return false
  }
  const slope = getSlope(x, z, SLOPE_STEP)
  // Pared de roca: sin garras no se sube (ni a saltos: se compara con el suelo, no con la altura del salto).
  if (ground > fromGround + 0.001 && isClimbWall(x, z, ground, slope)) {
    if (!MOTOR_CONFIG.canClimb) {
      wallBlock.at = performance.now() / 1000
      return false
    }
    return true
  }
  // Cuesta arriba demasiado empinada: bloquea. Cuesta abajo siempre se puede.
  if (ground > fromY + 0.05 && slope > MOTOR_CONFIG.maxSlope) return false
  return true
}

function resolveCollisions(pos: Vector3) {
  if (cave.active) return
  const r = MOTOR_CONFIG.radius
  for (let iter = 0; iter < 2; iter++) {
    for (const c of queryColliders(pos.x, pos.z, r)) {
      const dx = pos.x - c.x
      const dz = pos.z - c.z
      const min = r + c.r
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min) continue
      const d = Math.sqrt(d2) || 1e-4
      const push = min - d
      pos.x += (dx / d) * push
      pos.z += (dz / d) * push
    }
  }
}

export const simpleMotor: CharacterMotor = {
  groundHeight: groundAt,

  step(body, wishX, wishZ, jump, dt) {
    const p = body.position
    const ground0 = groundAt(p.x, p.z)
    const depth0 = cave.active ? 0 : waterDepth(p.x, p.z, ground0)
    body.inWater = depth0 > 0.15
    // Con un margen para que las olas no lo hagan alternar entre nadar y andar.
    body.swimming = MOTOR_CONFIG.canDive && depth0 > SWIM_DEPTH - (body.swimming ? 0.35 : 0)
    const surface = ground0 + depth0
    body.underwater = !!body.swimming && p.y < surface - SWIM_FLOAT - SUBMERGED
    // Trepando: sobre una pared de roca, con garras. Más lento y sin saltos.
    body.climbing =
      MOTOR_CONFIG.canClimb && !cave.active && p.y - ground0 < 0.3 && isClimbWall(p.x, p.z, ground0, getSlope(p.x, p.z, SLOPE_STEP))
    let factor = body.underwater
      ? MOTOR_CONFIG.diveSpeed
      : body.swimming
        ? MOTOR_CONFIG.swimSpeed
        : body.inWater
          ? MOTOR_CONFIG.waterSpeedFactor
          : 1
    if (body.climbing && !body.swimming) {
      const wish = Math.hypot(wishX, wishZ)
      if (wish > MOTOR_CONFIG.climbSpeed) factor *= MOTOR_CONFIG.climbSpeed / wish
      jump = false
    }

    // --- Horizontal: intento completo, si no deslizar por cada eje ---
    const dx = wishX * factor * dt
    const dz = wishZ * factor * dt
    if (dx !== 0 || dz !== 0) {
      if (canEnter(p.x + dx, p.z + dz, p.y, ground0)) {
        p.x += dx
        p.z += dz
      } else if (dx !== 0 && canEnter(p.x + dx, p.z, p.y, ground0)) {
        p.x += dx
      } else if (dz !== 0 && canEnter(p.x, p.z + dz, p.y, ground0)) {
        p.z += dz
      }
    }
    const prevX = p.x
    const prevZ = p.z
    resolveCollisions(p)
    // Si el empujón de una colisión nos mete en zona prohibida, lo deshacemos.
    if (!canEnter(p.x, p.z, p.y, ground0)) {
      p.x = prevX
      p.z = prevZ
    }
    body.velocity.x = wishX * factor
    body.velocity.z = wishZ * factor

    // --- Vertical: gravedad, salto y anclaje al suelo ---
    const ground = groundAt(p.x, p.z)
    if (body.swimming) {
      // Nadando: sin gravedad. Subir/bucear con los botones; quieto, se queda a
      // esa profundidad (cerca de la superficie, flota a su altura).
      const top = surface - SWIM_FLOAT
      const input = MOTOR_CONFIG.buoyant ? 1 : MOTOR_CONFIG.swimInput
      let want = input > 0 ? SWIM_RISE : input < 0 ? -SWIM_RISE * Math.max(0.6, MOTOR_CONFIG.diveSpeed) : 0
      if (input >= 0 && p.y > top - 0.45) want = (top - p.y) * 4
      body.velocity.y += (want - body.velocity.y) * (1 - Math.exp(-5 * dt))
      p.y += body.velocity.y * dt
      if (p.y > top) {
        p.y = top
        body.velocity.y = Math.min(0, body.velocity.y)
      }
      if (p.y < ground) {
        p.y = ground
        body.velocity.y = Math.max(0, body.velocity.y)
      }
      body.grounded = false
      body.climbing = false
      return
    }
    if (body.grounded && jump) {
      body.velocity.y = MOTOR_CONFIG.jumpSpeed
      body.grounded = false
    }
    body.velocity.y -= MOTOR_CONFIG.gravity * dt
    p.y += body.velocity.y * dt

    if (p.y <= ground) {
      p.y = ground
      body.velocity.y = 0
      body.grounded = true
    } else if (body.grounded && body.velocity.y <= 0 && p.y - ground < MOTOR_CONFIG.snapDistance) {
      p.y = ground
      body.velocity.y = 0
    } else {
      body.grounded = false
    }
  },
}
