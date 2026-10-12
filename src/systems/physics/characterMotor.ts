import type { Vector3 } from 'three'
import { pierDeck } from '@/config/boat'
import { isClimbWall, ISLAND, OASIS } from '@/config/world'
import { getHeight, getSlope } from '@/utils/terrain/heightfield'
import { ecology } from '@/systems/ecology'
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
  /** Completamente sumergido (camina por el fondo). */
  underwater?: boolean
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
  /** Tiene el sellado estanco: puede entrar en agua honda y andar por el fondo. */
  canDive: false,
  /** Multiplicador de velocidad bajo el agua. */
  diveSpeed: 0.55,
}

/** Último intento bloqueado por agua honda (para avisar al jugador). */
export const waterBlock = { at: -10 }

/** Profundidad a partir de la cual el robot queda sumergido. */
export const UNDERWATER_DEPTH = 1.3

/** Último intento bloqueado por una pared de roca (para avisar al jugador). */
export const wallBlock = { at: -10 }

const SLOPE_STEP = 0.75

function waterDepth(x: number, z: number, ground: number): number {
  const sea = ISLAND.enabled ? ISLAND.seaLevel - ground : 0
  const oasisDist = Math.hypot(x - OASIS.x, z - OASIS.z)
  const oasis = oasisDist < OASIS.radius * 1.45 ? ecology.oasisLevel - ground : 0
  return Math.max(sea, oasis, 0)
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
    body.underwater = depth0 > UNDERWATER_DEPTH
    // Trepando: sobre una pared de roca, con garras. Más lento y sin saltos.
    body.climbing =
      MOTOR_CONFIG.canClimb && !cave.active && p.y - ground0 < 0.3 && isClimbWall(p.x, p.z, ground0, getSlope(p.x, p.z, SLOPE_STEP))
    let factor = body.underwater ? MOTOR_CONFIG.diveSpeed : body.inWater ? MOTOR_CONFIG.waterSpeedFactor : 1
    if (body.climbing) {
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
    if (body.grounded && jump) {
      // Bajo el agua el salto es un impulso lento y flotante.
      body.velocity.y = MOTOR_CONFIG.jumpSpeed * (body.underwater ? 0.55 : 1)
      body.grounded = false
    }
    body.velocity.y -= MOTOR_CONFIG.gravity * (body.underwater ? 0.25 : 1) * dt
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
