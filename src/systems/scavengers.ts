import { ITEMS, type Inventory, type ItemId } from '@/config/items'
import { cave } from '@/config/cave'
import { getGame } from '@/store/gameStore'
import { player } from '@/systems/player'
import { environment } from '@/systems/environmentState'
import { landSpot } from '@/utils/terrain/landSpot'
import { isUnderwater } from '@/utils/terrain/heightfield'

/**
 * Carroñeros: pequeños robots nativos que rondan la isla buscando chatarra.
 * Si ven una caja caída van a saquearla; huyen del robot si corre hacia
 * ellos y del dron. Golpeados, sueltan lo que llevaban y algo de chatarra.
 */
export type Scavenger = {
  id: number
  x: number
  z: number
  heading: number
  speed: number
  active: boolean
  /** Lo que ha robado (lo suelta al golpearlo). */
  loot: Inventory
  goal: 'wander' | 'box' | 'flee'
  boxId: string | null
  tx: number
  tz: number
  timer: number
  /** Segundos fuera de juego tras romperlo o perderse lejos. */
  down: number
}

const COUNT = 3
let nextId = 1
export const scavengers: Scavenger[] = Array.from({ length: COUNT }, () => ({
  id: nextId++,
  x: 0,
  z: 0,
  heading: 0,
  speed: 0,
  active: false,
  loot: {},
  goal: 'wander',
  boxId: null,
  tx: 0,
  tz: 0,
  timer: 0,
  down: 5 + Math.random() * 20,
}))

export const scavengerKey = (s: Scavenger) => `scav|${s.id}`
/** Aviso de saqueo ya mostrado para esta caja. */
const warned = new Set<string>()

/** Posición del dron (la escribe <Drone/>; null si no hay dron). */
export const dronePos = { x: 0, z: 0, active: false }

export function updateScavengers(dt: number) {
  const game = getGame()
  const px = player.position.x
  const pz = player.position.z
  const night = environment.palette.daylight < 0.3
  // De noche salen más.
  const wanted = cave.active ? 0 : night ? 3 : game.droppedBoxes.length ? 2 : 1
  scavengers.forEach((s, i) => {
    if (!s.active) {
      if (i >= wanted || (s.down -= dt) > 0) return
      const spot = landSpot(px, pz, 35, 60, 2)
      if (!spot) return
      Object.assign(s, { x: spot.x, z: spot.z, active: true, goal: 'wander', loot: {}, boxId: null, timer: 0, heading: Math.random() * 6.28 })
    }
    const dist = Math.hypot(s.x - px, s.z - pz)
    if (dist > 110) {
      s.active = false
      s.down = 10
      return
    }
    // Miedo: el robot corriendo hacia ellos, o el dron cerca.
    const droneNear = dronePos.active && Math.hypot(dronePos.x - s.x, dronePos.z - s.z) < 9
    if (s.goal !== 'flee' && ((dist < 7 && player.speed > 2.5) || dist < 2.2 || droneNear)) {
      s.goal = 'flee'
      s.timer = 4
    }
    if ((s.timer -= dt) <= 0 && s.goal !== 'flee') {
      s.timer = 2 + Math.random() * 2
      const box = game.droppedBoxes
        .filter((b) => hasResources(b.items) && !b.buried)
        .sort((a, b) => Math.hypot(a.position[0] - s.x, a.position[2] - s.z) - Math.hypot(b.position[0] - s.x, b.position[2] - s.z))[0]
      if (box && Math.hypot(box.position[0] - s.x, box.position[2] - s.z) < 90) {
        s.goal = 'box'
        s.boxId = box.id
        s.tx = box.position[0]
        s.tz = box.position[2]
      } else {
        s.goal = 'wander'
        s.tx = s.x + (Math.random() - 0.5) * 30
        s.tz = s.z + (Math.random() - 0.5) * 30
      }
    }
    if (s.goal === 'flee') {
      s.heading = Math.atan2(s.x - px, s.z - pz)
      s.speed = 6
      if ((s.timer -= dt) <= 0) {
        s.goal = 'wander'
        s.timer = 0
      }
    } else {
      const dx = s.tx - s.x
      const dz = s.tz - s.z
      const d = Math.hypot(dx, dz)
      if (d > 1.1) {
        s.heading = Math.atan2(dx, dz)
        s.speed = s.goal === 'box' ? 3.4 : 1.6
      } else {
        s.speed = 0
        if (s.goal === 'box' && s.boxId) steal(s)
      }
    }
    const nx = s.x + Math.sin(s.heading) * s.speed * dt
    const nz = s.z + Math.cos(s.heading) * s.speed * dt
    // No saben nadar: ante el agua dan media vuelta.
    if (isUnderwater(nx, nz)) {
      s.heading += Math.PI * (0.6 + Math.random() * 0.8)
      s.tx = s.x - (s.tx - s.x)
      s.tz = s.z - (s.tz - s.z)
    } else {
      s.x = nx
      s.z = nz
    }
  })
}

const hasResources = (inv: Inventory) => (Object.entries(inv) as [ItemId, number][]).some(([id, n]) => n > 0 && ITEMS[id].kind === 'resource')

let stealClock = 0
/** Saca un recurso de la caja cada poco; con 3 se va con el botín. */
function steal(s: Scavenger) {
  const now = performance.now() / 1000
  if (now - stealClock < 1.6) return
  stealClock = now
  const game = getGame()
  const box = game.droppedBoxes.find((b) => b.id === s.boxId)
  if (!box) return
  const ids = (Object.entries(box.items) as [ItemId, number][]).filter(([id, n]) => n > 0 && ITEMS[id].kind === 'resource').map(([id]) => id)
  if (!ids.length) {
    s.goal = 'wander'
    return
  }
  const id = ids[Math.floor(Math.random() * ids.length)]
  game.takeFromBox(box.id, id, 1)
  s.loot[id] = (s.loot[id] ?? 0) + 1
  if (!warned.has(box.id) && Math.hypot(box.position[0] - player.position.x, box.position[2] - player.position.z) < 120) {
    warned.add(box.id)
    game.notify('🤖 Un carroñero está saqueando tu caja caída. ¡Corre a espantarlo!', 'warn')
  }
  const carried = Object.values(s.loot).reduce((a, b) => a + (b ?? 0), 0)
  if (carried >= 3) {
    // Se lleva lo robado lejos.
    s.goal = 'flee'
    s.timer = 6
  }
}

/** Golpeado hasta romperlo: suelta lo robado y se apaga un rato. Devuelve su botín. */
export function knockScavenger(id: number): Inventory {
  const s = scavengers.find((x) => x.id === id)
  if (!s) return {}
  const loot = s.loot
  s.active = false
  s.down = 40 + Math.random() * 40
  s.loot = {}
  return loot
}
