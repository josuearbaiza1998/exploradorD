import type { Vector3 } from 'three'
import { ISLAND, OASIS } from '@/config/world'
import { getHeight, getSlope, OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'
import { queryColliders } from './staticColliders'

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
}

export interface CharacterMotor {
  groundHeight(x: number, z: number): number
  /** Mueve el cuerpo con una velocidad horizontal deseada (m/s). */
  step(body: CharacterBody, wishX: number, wishZ: number, jump: boolean, dt: number): void
}

export const MOTOR_CONFIG = {
  radius: 0.45,
  gravity: 24,
  jumpSpeed: 7.5,
  /** Pendiente máxima subible (1 = 45°). */
  maxSlope: 1.05,
  /** Profundidad de agua a partir de la cual el robot no entra (no es sumergible). */
  maxWaterDepth: 0.9,
  waterSpeedFactor: 0.55,
  /** Distancia máxima para "pegarse" al suelo al bajar pendientes. */
  snapDistance: 0.45,
}

function waterDepth(x: number, z: number, ground: number): number {
  const sea = ISLAND.enabled ? ISLAND.seaLevel - ground : 0
  const oasisDist = Math.hypot(x - OASIS.x, z - OASIS.z)
  const oasis = oasisDist < OASIS.radius * 1.2 ? OASIS_WATER_LEVEL - ground : 0
  return Math.max(sea, oasis, 0)
}

function canEnter(x: number, z: number, fromY: number): boolean {
  const ground = getHeight(x, z)
  if (waterDepth(x, z, ground) > MOTOR_CONFIG.maxWaterDepth) return false
  // Cuesta arriba demasiado empinada: bloquea. Cuesta abajo siempre se puede.
  if (ground > fromY + 0.05 && getSlope(x, z, 0.75) > MOTOR_CONFIG.maxSlope) return false
  return true
}

function resolveCollisions(pos: Vector3) {
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
  groundHeight: getHeight,

  step(body, wishX, wishZ, jump, dt) {
    const p = body.position
    const ground0 = getHeight(p.x, p.z)
    body.inWater = waterDepth(p.x, p.z, ground0) > 0.15
    const factor = body.inWater ? MOTOR_CONFIG.waterSpeedFactor : 1

    // --- Horizontal: intento completo, si no deslizar por cada eje ---
    const dx = wishX * factor * dt
    const dz = wishZ * factor * dt
    if (dx !== 0 || dz !== 0) {
      if (canEnter(p.x + dx, p.z + dz, p.y)) {
        p.x += dx
        p.z += dz
      } else if (dx !== 0 && canEnter(p.x + dx, p.z, p.y)) {
        p.x += dx
      } else if (dz !== 0 && canEnter(p.x, p.z + dz, p.y)) {
        p.z += dz
      }
    }
    const prevX = p.x
    const prevZ = p.z
    resolveCollisions(p)
    // Si el empujón de una colisión nos mete en zona prohibida, lo deshacemos.
    if (!canEnter(p.x, p.z, p.y)) {
      p.x = prevX
      p.z = prevZ
    }
    body.velocity.x = wishX * factor
    body.velocity.z = wishZ * factor

    // --- Vertical: gravedad, salto y anclaje al suelo ---
    const ground = getHeight(p.x, p.z)
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
