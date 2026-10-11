import { ANCHORS, ANCHOR_RING, GRAPPLE_RANGE, type Anchor } from '@/config/grapple'
import { getHeight } from '@/utils/terrain/heightfield'
import { player } from './player'

/** Vuelo con el gancho (estado mutable por frame). */
export const grapple = {
  active: false,
  t: 0,
  duration: 1,
  from: { x: 0, y: 0, z: 0 },
  to: { x: 0, y: 0, z: 0 },
  anchor: null as Anchor | null,
}

export const anchorTop = (a: Anchor) => getHeight(a.x, a.z) + ANCHOR_RING

/** Poste al que se puede lanzar el gancho ahora (a tiro y más o menos delante). */
export function findAnchor(): Anchor | null {
  let best: Anchor | null = null
  let bestScore = Infinity
  const fx = Math.sin(player.heading)
  const fz = Math.cos(player.heading)
  for (const a of ANCHORS) {
    const dx = a.x - player.position.x
    const dz = a.z - player.position.z
    const d = Math.hypot(dx, dz)
    if (d < 4 || d > GRAPPLE_RANGE) continue
    const facing = (dx * fx + dz * fz) / d
    if (facing < 0.35) continue
    const score = d * (2 - facing)
    if (score < bestScore) {
      bestScore = score
      best = a
    }
  }
  return best
}

/** Lanza el gancho: el robot vuela en arco hasta el pie del poste. */
export function startGrapple(a: Anchor) {
  const p = player.position
  const dx = a.x - p.x
  const dz = a.z - p.z
  const d = Math.hypot(dx, dz)
  // Aterriza un poco antes del poste, del lado desde el que llega.
  const lx = a.x - (dx / d) * 1.3
  const lz = a.z - (dz / d) * 1.3
  grapple.active = true
  grapple.t = 0
  grapple.duration = 0.6 + d / 40
  grapple.from = { x: p.x, y: p.y, z: p.z }
  grapple.to = { x: lx, y: getHeight(lx, lz), z: lz }
  grapple.anchor = a
  player.heading = Math.atan2(dx, dz)
}

/** Avanza el vuelo; devuelve true mientras dura. */
export function stepGrapple(dt: number): boolean {
  if (!grapple.active) return false
  grapple.t = Math.min(1, grapple.t + dt / grapple.duration)
  const k = grapple.t
  const e = k * k * (3 - 2 * k)
  const { from, to } = grapple
  const lift = Math.max(2.5, Math.hypot(to.x - from.x, to.z - from.z) * 0.18)
  player.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e + Math.sin(Math.PI * k) * lift, from.z + (to.z - from.z) * e)
  player.velocity.set(0, k < 0.5 ? 5 : -5, 0)
  player.grounded = false
  if (k >= 1) {
    grapple.active = false
    player.position.y = to.y
    player.velocity.set(0, 0, 0)
    player.grounded = true
  }
  return true
}
