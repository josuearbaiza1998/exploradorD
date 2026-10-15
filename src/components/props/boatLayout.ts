import { Vector3 } from 'three'
import { BOAT } from '@/config/boat'

/**
 * Puntos del modelo del barco (public/models/boat.glb, importado de Tripo con
 * scripts/import-tripo-boat.cjs) que usa el juego. Coordenadas locales del
 * barco: +Z = proa, +Y = arriba, la flotación en y = BOAT.draft. Salen de
 * tripoToBoat (src/tools/tripoBoat.ts); si se cambia la escala, recalcular.
 */
export const DECK = BOAT.deck.y

/** Timón (la rueda delante del robot). */
export const WHEEL = { y: 2.24, z: 0.35, r: 0.48 }

/** Donde estaba el farol del mástil: ahí cuelga el dron. */
export const LAMP_LOCAL = new Vector3(0, 4.5, -0.95)

/** Boca de la chimenea (de aquí sale el humo). */
export const STACK_TOP = new Vector3(0, 3.88, -3.02)
