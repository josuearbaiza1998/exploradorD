import { Vector3 } from 'three'
import { BOAT } from '@/config/boat'

/**
 * Medidas compartidas entre el generador del modelo (src/tools/boatBuilder.ts,
 * que exporta public/models/boat.glb) y el juego (BoatModel, la pose del robot
 * al timón, el dron y el humo). Coordenadas locales del barco: +Z = proa,
 * +Y = arriba, la flotación en y = BOAT.draft.
 */
export const DECK = BOAT.deck.y

/** Fuselaje: popa, base del morro (donde empieza la rejilla) y punta de la rejilla. */
export const FUSE = { stern: -4.3, dome: 0.4, nose: 5.55, tip: 6.45, beam: 1.85, half: 1.2, center: 0.85 }

/** Hueco de la cabina: borde de popa, y semicírculo delantero bajo el capó. */
export const OPENING = { aft: -3.7, front: 0.3, frontR: 0.95 }

/** Timón: la pose del robot pone las manos en este aro. */
export const WHEEL = { y: DECK + 1.2, z: 0.35, r: 0.52 }

/** Mástil: base, inclinación y alto. */
export const MAST = { x: -0.35, z: -1.75, h: 4.1, tiltX: -0.05, tiltZ: 0.04 }

/** Farol del mástil (donde cuelga el dron), en coordenadas del barco. */
export const LAMP_LOCAL = new Vector3(0, MAST.h - 0.7, 0.75)
  .applyAxisAngle(new Vector3(1, 0, 0), MAST.tiltX)
  .applyAxisAngle(new Vector3(0, 0, 1), MAST.tiltZ)
  .add(new Vector3(MAST.x, DECK, MAST.z))

/** Turbina alta, eje de la hélice abajo, hélice y aleta de dirección. */
export const TURBINE = { y: 2.05, z: -4.45, r: 0.55, len: 1.3 }
export const DRIVE = { y: 0.6, z: -4.75, r: 0.38, len: 0.8 }
export const PROP = { y: DRIVE.y, z: -5.38, r: 0.62 }
export const RUDDER = { z: -5.78 }

/** Boca de la chimenea (de aquí sale el humo). */
export const STACK_TOP = new Vector3(0.05, TURBINE.y + 1.3, -4.3)

/** Engranajes a estribor, entre la turbina y el eje de la hélice (giran sobre el eje X). */
export const GEAR_A = { x: 0.48, y: 1.36, z: -4.98, r: 0.36 }
export const GEAR_B = { x: 0.48, y: GEAR_A.y - 0.36 - 0.22 + 0.04, z: -4.98, r: 0.22 }
