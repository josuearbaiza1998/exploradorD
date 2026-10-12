import { BOAT, BOAT_MOOR, PIER, pierDeck } from '@/config/boat'
import { ISLAND } from '@/config/world'
import { getGame } from '@/store/gameStore'
import { getHeight, getSlope } from '@/utils/terrain/heightfield'
import { waveHeight } from './sea'
import { player, teleportPlayer } from './player'

/**
 * Estado del barco (mutable por frame). `launched` lo pone <Boat/> cuando la
 * nave está adaptada; `boating` = el robot va a bordo pilotando.
 */
export const boat = {
  launched: false,
  boating: false,
  x: BOAT_MOOR.x,
  z: BOAT_MOOR.z,
  heading: BOAT_MOOR.heading,
  speed: 0,
  y: ISLAND.seaLevel,
  pitch: 0,
  roll: 0,
  /** Dónde subió el robot (se guarda como posición segura si se cierra el juego a bordo). */
  boardedFrom: { x: PIER.to.x, z: PIER.to.z },
  /** Último aviso de mar abierto (s). */
  openSeaNoticeAt: -100,
}

const depthAt = (x: number, z: number) => ISLAND.seaLevel - getHeight(x, z)

/** ¿Cabe el casco aquí? (proa, centro y popa con agua suficiente, fuera del muelle). */
function navigable(x: number, z: number, heading: number) {
  const fx = Math.sin(heading)
  const fz = Math.cos(heading)
  for (const k of [-1, 0, 1]) {
    const px = x + fx * BOAT.halfLength * k
    const pz = z + fz * BOAT.halfLength * k
    if (depthAt(px, pz) < BOAT.minDepth) return false
  }
  return true
}

/**
 * Pilotaje: el barco gira hacia donde apunta el stick (relativo a la cámara)
 * y acelera si va más o menos en esa dirección. Con inercia: frena despacio.
 */
export function stepBoat(dt: number, wishX: number, wishZ: number, t: number) {
  const wish = Math.min(1, Math.hypot(wishX, wishZ))
  let thrust = 0
  if (wish > 0.15) {
    const want = Math.atan2(wishX, wishZ)
    const diff = Math.atan2(Math.sin(want - boat.heading), Math.cos(want - boat.heading))
    const turnRate = BOAT.turn * (0.35 + 0.65 * Math.min(1, boat.speed / 3))
    boat.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff))
    thrust = wish * Math.max(0, Math.cos(diff))
  }
  const target = BOAT.maxSpeed * thrust
  boat.speed += (target - boat.speed) * (1 - Math.exp(-(target > boat.speed ? BOAT.accel / BOAT.maxSpeed * 3 : BOAT.drag * 0.4) * dt))
  const nx = boat.x + Math.sin(boat.heading) * boat.speed * dt
  const nz = boat.z + Math.cos(boat.heading) * boat.speed * dt
  if (navigable(nx, nz, boat.heading)) {
    // Mar abierto: el oleaje devuelve el barco hacia la isla (por ahora).
    if (Math.hypot(nx, nz) > BOAT.openSeaRadius) {
      boat.speed *= 0.5
      boat.x -= (nx / Math.hypot(nx, nz)) * 2 * dt
      boat.z -= (nz / Math.hypot(nx, nz)) * 2 * dt
      if (t - boat.openSeaNoticeAt > 20) {
        boat.openSeaNoticeAt = t
        getGame().notify('🌊 Mar adentro las olas son enormes: para cruzar hace falta saber por dónde van las corrientes', 'warn')
      }
    } else {
      boat.x = nx
      boat.z = nz
    }
  } else {
    // Toca fondo: se para en seco.
    boat.speed = 0
  }
  floatBoat(t)
}

/** Balanceo sobre las olas (también amarrado). */
export function floatBoat(t: number) {
  const fx = Math.sin(boat.heading)
  const fz = Math.cos(boat.heading)
  const h = (x: number, z: number) => waveHeight(x, z, t)
  const front = h(boat.x + fx * 6, boat.z + fz * 6)
  const back = h(boat.x - fx * 6, boat.z - fz * 6)
  const left = h(boat.x - fz * 3, boat.z + fx * 3)
  const right = h(boat.x + fz * 3, boat.z - fx * 3)
  boat.y = ISLAND.seaLevel + (front + back + left + right) / 4
  boat.pitch = Math.atan2(back - front, 12) - boat.speed * 0.006
  boat.roll = Math.atan2(left - right, 6)
}

/** Posición de la cubierta en el mundo (donde va el robot). */
export function deckPosition(out: { x: number; y: number; z: number }) {
  const s = Math.sin(boat.heading)
  const c = Math.cos(boat.heading)
  out.x = boat.x + BOAT.deck.x * c + BOAT.deck.z * s
  out.z = boat.z - BOAT.deck.x * s + BOAT.deck.z * c
  out.y = boat.y - BOAT.draft + BOAT.deck.y
  return out
}

/** Punto del casco más cercano a (x, z) y su distancia (para subir a bordo). */
export function nearestHullPoint(x: number, z: number) {
  const fx = Math.sin(boat.heading)
  const fz = Math.cos(boat.heading)
  const t = Math.max(-BOAT.halfLength, Math.min(BOAT.halfLength, (x - boat.x) * fx + (z - boat.z) * fz))
  const px = boat.x + fx * t
  const pz = boat.z + fz * t
  return { x: px, z: pz, d: Math.hypot(x - px, z - pz) }
}

/** Sitio de tierra firme junto al barco para desembarcar (o null si no hay orilla cerca). */
export function landingSpot(): { x: number; z: number } | null {
  let best: { x: number; z: number; d: number } | null = null
  const fx = Math.sin(boat.heading)
  const fz = Math.cos(boat.heading)
  for (let t = -BOAT.halfLength; t <= BOAT.halfLength; t += 2.5) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2
      for (const r of [4, 6, 8, 10]) {
        const x = boat.x + fx * t + Math.cos(ang) * r
        const z = boat.z + fz * t + Math.sin(ang) * r
        // Fuera del casco: no se baja encima del propio barco.
        if (nearestHullPoint(x, z).d < 3.5) continue
        const onPier = pierDeck(x, z) !== null
        const h = getHeight(x, z)
        if (!onPier && (h < ISLAND.seaLevel + 0.6 || getSlope(x, z) > 0.9)) continue
        const d = Math.hypot(x - boat.x, z - boat.z)
        if (!best || d < best.d) best = { x, z, d }
      }
    }
  }
  return best
}

/** Sube a bordo: el robot pasa a la cubierta y pilota. */
export function boardBoat() {
  const game = getGame()
  boat.boardedFrom = { x: player.position.x, z: player.position.z }
  boat.boating = true
  game.setTarget(null)
  game.notify('⛵ A bordo. Mueve el stick para navegar; acércate a la orilla para desembarcar', 'info')
}

/** Baja a tierra en (x, z) y deja el barco donde está (se guarda). */
export function disembark(x: number, z: number) {
  const game = getGame()
  boat.boating = false
  boat.speed = 0
  game.setBoatPos([boat.x, boat.z, boat.heading])
  teleportPlayer(x, z, Math.atan2(x - boat.x, z - boat.z))
  game.setTarget(null)
}
