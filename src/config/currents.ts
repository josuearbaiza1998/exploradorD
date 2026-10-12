import { BOAT_MOOR } from './boat'
import { FAR_ISLAND } from './farIsland'

/**
 * Boyas de deriva que dejó la sonda anterior para medir las corrientes. Con
 * los datos de las tres se traza la carta de corrientes, que marca la ruta
 * hacia la otra isla.
 */
export type BuoyId = 'b1' | 'b2' | 'b3'

export const BUOYS: { id: BuoyId; x: number; z: number; name: string }[] = [
  { id: 'b1', x: 135, z: -238, name: 'Boya del islote' },
  { id: 'b2', x: 50, z: 252, name: 'Boya del sur' },
  { id: 'b3', x: -255, z: 20, name: 'Boya del oeste' },
]

/** Distancia (m) desde el barco a la que se pueden leer sus datos. */
export const BUOY_READ_RANGE = 14

/** Ruta de la carta: del muelle a la otra isla. */
export const ROUTE = { from: { x: BOAT_MOOR.x, z: BOAT_MOOR.z }, to: { x: FAR_ISLAND.x, z: FAR_ISLAND.z } }
/** Media anchura del pasillo donde la corriente ayuda (m). */
export const ROUTE_HALF_WIDTH = 70
/** Fracción de la ruta donde empieza la tormenta que separa las islas. */
export const STORM_AT = 0.55

/** Posición a lo largo de la ruta (0 muelle, 1 isla) y distancia al eje. */
export function routeCoords(x: number, z: number) {
  const ax = ROUTE.to.x - ROUTE.from.x
  const az = ROUTE.to.z - ROUTE.from.z
  const len = Math.hypot(ax, az)
  const t = ((x - ROUTE.from.x) * ax + (z - ROUTE.from.z) * az) / (len * len)
  const px = ROUTE.from.x + ax * t
  const pz = ROUTE.from.z + az * t
  return { t, off: Math.hypot(x - px, z - pz), len }
}

/** Punto de la ruta en la fracción t. */
export const routePoint = (t: number) => ({
  x: ROUTE.from.x + (ROUTE.to.x - ROUTE.from.x) * t,
  z: ROUTE.from.z + (ROUTE.to.z - ROUTE.from.z) * t,
})
