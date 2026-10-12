import { Euler, Vector3 } from 'three'
import { BOAT, BOAT_MOOR, PIER, pierDeck } from '@/config/boat'
import { ISLAND } from '@/config/world'
import { BUOYS, ROUTE_HALF_WIDTH, routeCoords, routePoint, STORM_AT } from '@/config/currents'
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
  /** Velocidad real (m/s, mundo): va detrás del rumbo y el barco derrapa un poco en los giros. */
  vx: 0,
  vz: 0,
  /** Giro actual (rad/s), con inercia. */
  yawRate: 0,
  /** Timón -1..1 (para el timón, la rueda y los brazos del robot). */
  rudder: 0,
  /** Muelles del balanceo: velocidad vertical, de cabeceo y de alabeo. */
  vy: 0,
  pitchV: 0,
  rollV: 0,
  /** Aceleración reciente (la proa se levanta al dar gas). */
  surge: 0,
  /** Dónde subió el robot (se guarda como posición segura si se cierra el juego a bordo). */
  boardedFrom: { x: PIER.to.x, z: PIER.to.z },
  /** Último aviso de mar abierto (s). */
  openSeaNoticeAt: -100,
}

/** Dónde cuelga el dron a bordo (el farol del mástil), en el mundo. Lo actualiza <Boat/>. */
export const boatLamp = { x: 0, y: 0, z: 0, valid: false }

const depthAt = (x: number, z: number) => ISLAND.seaLevel - getHeight(x, z)

/** ¿Cabe el casco aquí? (proa, centro y popa con agua suficiente, fuera del muelle). */
function navigable(x: number, z: number, heading: number) {
  const fx = Math.sin(heading)
  const fz = Math.cos(heading)
  for (const k of [-1, 0, 1]) {
    const px = x + fx * BOAT.halfLength * k
    const pz = z + fz * BOAT.halfLength * k
    if (depthAt(px, pz) < BOAT.minDepth) return false
    // Las boyas también estorban.
    for (const b of BUOYS) if (Math.hypot(b.x - px, b.z - pz) < 2.5) return false
  }
  return true
}

/**
 * Hasta dónde se puede navegar: sin carta, solo cerca de la isla; con la
 * carta, también por el pasillo de la corriente hacia la otra isla, hasta la
 * tormenta que las separa. Devuelve hacia dónde empuja el oleaje y el aviso.
 */
function seaLimit(x: number, z: number): { pushX: number; pushZ: number; message: string } | null {
  const r = Math.hypot(x, z)
  if (r <= BOAT.openSeaRadius) return null
  const hasChart = !!getGame().inventory.currentChart
  const route = routeCoords(x, z)
  if (hasChart && route.off < ROUTE_HALF_WIDTH && route.t > 0) {
    if (route.t < STORM_AT) return null
    // La tormenta: empuja de vuelta por la ruta.
    const back = routePoint(0)
    const d = Math.hypot(back.x - x, back.z - z) || 1
    return { pushX: (back.x - x) / d, pushZ: (back.z - z) / d, message: '⛈️ Una tormenta perpetua cierra el paso a la otra isla: el barco no aguantaría ese oleaje tal como está' }
  }
  return {
    pushX: -x / r,
    pushZ: -z / r,
    message: hasChart
      ? '🗺️ Fuera de la ruta de la carta las olas son enormes: sigue el pasillo de la corriente (míralo en el mapa)'
      : '🌊 Mar adentro las olas son enormes: para cruzar hace falta saber por dónde van las corrientes',
  }
}

/**
 * Pilotaje (inspirado en el Mascarón Rojo de Wind Waker): el barco gira hacia
 * donde apunta el stick con un giro que coge y suelta inercia, acelera si va
 * más o menos en esa dirección, derrapa un poco en las curvas y se inclina
 * hacia dentro. Con inercia: frena despacio.
 */
export function stepBoat(dt: number, wishX: number, wishZ: number, t: number) {
  const wish = Math.min(1, Math.hypot(wishX, wishZ))
  let thrust = 0
  let wantYaw = 0
  if (wish > 0.15) {
    const want = Math.atan2(wishX, wishZ)
    const diff = Math.atan2(Math.sin(want - boat.heading), Math.cos(want - boat.heading))
    // Parado gira despacio; con algo de marcha, el giro completo.
    const maxRate = BOAT.turn * (0.4 + 0.6 * Math.min(1, boat.speed / 3))
    wantYaw = Math.max(-maxRate, Math.min(maxRate, diff * 2.4))
    thrust = wish * Math.max(0.15, Math.cos(diff))
  }
  boat.yawRate += (wantYaw - boat.yawRate) * (1 - Math.exp(-3.2 * dt))
  boat.heading += boat.yawRate * dt
  boat.rudder += (Math.max(-1, Math.min(1, wantYaw / BOAT.turn)) - boat.rudder) * (1 - Math.exp(-6 * dt))
  const target = BOAT.maxSpeed * thrust
  const before = boat.speed
  boat.speed += (target - boat.speed) * (1 - Math.exp(-(target > boat.speed ? (BOAT.accel / BOAT.maxSpeed) * 3 : BOAT.drag * 0.4) * dt))
  boat.surge += ((boat.speed - before) / Math.max(dt, 1e-3) - boat.surge) * (1 - Math.exp(-4 * dt))
  // La velocidad real sigue al rumbo con retraso: derrape suave al girar.
  const k = 1 - Math.exp(-2.6 * dt)
  boat.vx += (Math.sin(boat.heading) * boat.speed - boat.vx) * k
  boat.vz += (Math.cos(boat.heading) * boat.speed - boat.vz) * k
  const nx = boat.x + boat.vx * dt
  const nz = boat.z + boat.vz * dt
  if (navigable(nx, nz, boat.heading)) {
    const limit = seaLimit(nx, nz)
    if (limit) {
      // Mar abierto o tormenta: el oleaje devuelve el barco.
      boat.speed *= 0.5
      boat.vx = limit.pushX * 3
      boat.vz = limit.pushZ * 3
      boat.x += limit.pushX * 3 * dt
      boat.z += limit.pushZ * 3 * dt
      if (t - boat.openSeaNoticeAt > 20) {
        boat.openSeaNoticeAt = t
        getGame().notify(limit.message, 'warn')
      }
    } else {
      boat.x = nx
      boat.z = nz
    }
  } else {
    // Toca fondo: se para con un golpe (cabezada hacia delante).
    if (boat.speed > 2) boat.pitchV += boat.speed * 0.25
    boat.speed = 0
    boat.vx = 0
    boat.vz = 0
  }
  floatBoat(t, dt)
}

/**
 * Balanceo sobre las olas con muelles (también amarrado): la altura, el
 * cabeceo y el alabeo persiguen a las olas con rebote, así al cruzar crestas
 * a toda marcha el barco brinca y se mece en vez de pegarse rígido al agua.
 */
export function floatBoat(t: number, dt = 1 / 60) {
  dt = Math.min(dt, 0.05)
  if (!boat.boating) {
    boat.speed *= Math.exp(-0.8 * dt)
    boat.yawRate *= Math.exp(-2 * dt)
    boat.rudder *= Math.exp(-3 * dt)
    boat.surge *= Math.exp(-3 * dt)
    boat.vx *= Math.exp(-0.8 * dt)
    boat.vz *= Math.exp(-0.8 * dt)
  }
  const fx = Math.sin(boat.heading)
  const fz = Math.cos(boat.heading)
  const h = (x: number, z: number) => waveHeight(x, z, t)
  const L = BOAT.halfLength * 0.75
  const W = 1.6
  const front = h(boat.x + fx * L, boat.z + fz * L)
  const back = h(boat.x - fx * L, boat.z - fz * L)
  const left = h(boat.x - fz * W, boat.z + fx * W)
  const right = h(boat.x + fz * W, boat.z - fx * W)
  // A toda marcha el casco planea: va algo más alto y con la proa levantada.
  const plane = Math.min(1, boat.speed / BOAT.maxSpeed)
  const targetY = ISLAND.seaLevel + (front + back + left + right) / 4 + plane * 0.12
  const targetPitch = Math.atan2(back - front, L * 2) - plane * 0.1 - Math.max(-0.08, Math.min(0.14, boat.surge * 0.05))
  // Se inclina hacia dentro de la curva, más cuanto más rápido va.
  const targetRoll = Math.atan2(left - right, W * 2) + boat.yawRate * (0.06 + plane * 0.16)
  boat.vy += ((targetY - boat.y) * 38 - boat.vy * 5.5) * dt
  boat.y += boat.vy * dt
  boat.pitchV += ((targetPitch - boat.pitch) * 30 - boat.pitchV * 4.5) * dt
  boat.pitch += boat.pitchV * dt
  boat.rollV += ((targetRoll - boat.roll) * 22 - boat.rollV * 3.5) * dt
  boat.roll += boat.rollV * dt
}

/** Posición de la cubierta en el mundo (donde va el robot). */
export function deckPosition(out: { x: number; y: number; z: number }) {
  // Mismo giro que el casco (cabeceo y alabeo incluidos): el robot va pegado a la cubierta.
  _deck.set(BOAT.deck.x, BOAT.deck.y, BOAT.deck.z).applyEuler(_euler.set(boat.pitch, boat.heading, boat.roll, 'YXZ'))
  out.x = boat.x + _deck.x
  out.z = boat.z + _deck.z
  out.y = boat.y - BOAT.draft + _deck.y
  return out
}
const _deck = new Vector3()
const _euler = new Euler()

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
  for (let t = -BOAT.halfLength; t <= BOAT.halfLength; t += 1.5) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2
      for (const r of [3, 4.5, 6, 8]) {
        const x = boat.x + fx * t + Math.cos(ang) * r
        const z = boat.z + fz * t + Math.sin(ang) * r
        // Fuera del casco: no se baja encima del propio barco.
        if (nearestHullPoint(x, z).d < 2.4) continue
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
