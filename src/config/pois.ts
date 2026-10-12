import type { Inventory, ItemId } from './items'
import type { Vec2 } from './world'

/**
 * Lugares por descubrir. Cada uno guarda un contenedor con una pieza única
 * para adaptar la nave como barco y algo de botín. Están detrás de colinas o en lo alto
 * (regla del triángulo) y tienen una silueta o luz que se ve de lejos.
 */
export type PoiId = 'probeWreck' | 'ruins' | 'cave' | 'beacon'

export type PoiDef = Vec2 & {
  id: PoiId
  name: string
  icon: string
  /** Texto al descubrirlo (registro de la sonda). */
  log: string
  /** Giro del conjunto (rad). */
  rotation: number
  /** Contenedor: posición local (antes de girar). */
  cache: [number, number]
  /** Si el contenedor está en otro sitio del mundo (p. ej. un islote). */
  cacheWorld?: Vec2
  part: ItemId
  loot: Inventory
  /** Colisionadores locales (x, z, radio, alto). */
  colliders: [number, number, number, number][]
  /** Radio de la zona allanada y libre de vegetación. */
  clearRadius: number
}

export const POIS: PoiDef[] = [
  {
    id: 'probeWreck',
    name: 'Restos de la sonda D-2',
    icon: '🛰️',
    x: -62,
    z: 142,
    rotation: 0.8,
    log: 'Registro: una sonda como yo, modelo anterior. Llegó antes y no volvió a despegar. Su chip de navegación sigue intacto.',
    cache: [2.6, 1.5],
    part: 'navChip',
    loot: { techParts: 2, scrapMetal: 2 },
    colliders: [[0, 0, 2.4, 3], [-3.5, -2, 1.2, 1.5]],
    clearRadius: 12,
  },
  {
    id: 'ruins',
    name: 'Ruinas antiguas',
    icon: '🏛️',
    x: 146,
    z: 22,
    rotation: 0.3,
    log: 'Registro: estructuras de piedra talladas. Alguien vivió aquí hace mucho. En el altar late un cristal con energía pura.',
    cache: [0, 0],
    part: 'energyCrystal',
    loot: { stone: 4, techParts: 1 },
    colliders: [[0, 0, 1.2, 1.2], ...pillarRing(6.5, 7).map(([x, z]) => [x, z, 0.7, 4] as [number, number, number, number])],
    clearRadius: 13,
  },
  {
    id: 'cave',
    name: 'Cueva de cristal',
    icon: '🕳️',
    x: -112,
    z: -118,
    rotation: 2.4,
    log: 'Registro: dentro hace frío y brillan minerales azules. Hay restos de un depósito con una bomba de refrigerante.',
    cache: [0, 2.8],
    part: 'coolant',
    loot: { stone: 3, scrapMetal: 2, techParts: 1 },
    colliders: [[-4.2, -1.5, 3.2, 5], [4.2, -1.5, 3.2, 5], [0, -4.5, 4, 6]],
    clearRadius: 12,
  },
  {
    id: 'beacon',
    name: 'Baliza en la cima',
    icon: '🗼',
    x: 104,
    z: -158,
    rotation: 0,
    log: 'Registro: una baliza de otra expedición sigue emitiendo. La tormenta tiró su antena al islote de enfrente: hará falta un gancho para cruzar.',
    cache: [2.2, 0],
    cacheWorld: { x: 123.5, z: -187.5 },
    part: 'antenna',
    loot: { scrapMetal: 3, techParts: 2 },
    colliders: [[0, 0, 1.4, 8]],
    clearRadius: 7,
  },
]

/** Posiciones de un anillo de pilares (local). */
export function pillarRing(radius: number, count: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return [Math.cos(a) * radius, Math.sin(a) * radius]
  })
}

/** Local → mundo para un POI (mismo giro que el grupo de su modelo). */
export function poiLocalToWorld(poi: PoiDef, lx: number, lz: number): Vec2 {
  const c = Math.cos(poi.rotation)
  const s = Math.sin(poi.rotation)
  return { x: poi.x + lx * c + lz * s, z: poi.z - lx * s + lz * c }
}

/** Distancia a la que se "descubre" un lugar. */
export const DISCOVER_RADIUS = 22
