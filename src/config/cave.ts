import { POIS, poiLocalToWorld } from './pois'

/**
 * Interior de la Cueva de cristal. Está en un lugar apartado del mundo (lejos
 * de la isla, donde no hay terreno): al cruzar la boca de la cueva el robot
 * pasa aquí con un fundido, y al volver a la entrada sale de nuevo.
 * El suelo y las paredes los define un camino: el robot no puede salirse de él.
 */
export const CAVE_ORIGIN = { x: 700, y: 20, z: 700 }

/** Camino local de la cueva: [x, z, medio ancho, altura del suelo]. Baja serpenteando hasta la cámara del fondo. */
export const CAVE_PATH: [number, number, number, number][] = [
  [0, 0, 3, 0],
  [0, -12, 3.2, -1.5],
  [8, -22, 3.6, -3],
  [6, -33, 2.6, -4.5],
  [-6, -42, 4, -6],
  [-8, -55, 3, -7.5],
  [0, -64, 5, -8],
  [0, -72, 9, -8],
]

/** Estado mutable: ¿el robot está dentro? (no se guarda: al cargar se aparece en la entrada). */
export const cave = { active: false }

export const inCave = (_x?: number, _z?: number) => cave.active

export type CaveSample = { d: number; width: number; floor: number; t: number }

/** Punto del camino más cercano a (x, z) en coordenadas de mundo. */
export function caveNearest(x: number, z: number): CaveSample {
  const lx = x - CAVE_ORIGIN.x
  const lz = z - CAVE_ORIGIN.z
  let best: CaveSample = { d: Infinity, width: 0, floor: 0, t: 0 }
  for (let i = 0; i < CAVE_PATH.length - 1; i++) {
    const [ax, az, aw, ay] = CAVE_PATH[i]
    const [bx, bz, bw, by] = CAVE_PATH[i + 1]
    const sx = bx - ax
    const sz = bz - az
    const len2 = sx * sx + sz * sz
    const k = Math.max(0, Math.min(1, ((lx - ax) * sx + (lz - az) * sz) / len2))
    const d = Math.hypot(lx - (ax + sx * k), lz - (az + sz * k))
    if (d < best.d) best = { d, width: aw + (bw - aw) * k, floor: ay + (by - ay) * k, t: i + k }
  }
  return best
}

/** Altura del suelo de la cueva con pequeños desniveles de roca. */
export function caveFloor(x: number, z: number): number {
  const s = caveNearest(x, z)
  const bumps = Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.12
  return CAVE_ORIGIN.y + s.floor + bumps
}

/** Altura del techo sobre el suelo según el ancho del túnel. */
export const caveHeadroom = (width: number) => 3.4 + width * 0.45

/** ¿Un punto (por ejemplo la cámara) está dentro del hueco de la cueva? */
export function caveContains(x: number, y: number, z: number, margin: number): boolean {
  const s = caveNearest(x, z)
  const floor = CAVE_ORIGIN.y + s.floor
  return s.d < s.width - margin && y > floor + margin && y < floor + caveHeadroom(s.width) - margin && z - CAVE_ORIGIN.z < 0.3
}

/** ¿Cabe el robot (radio r) en ese punto de la cueva? */
export function caveCanEnter(x: number, z: number, r: number): boolean {
  const s = caveNearest(x, z)
  // El extremo inicial queda abierto hacia la salida: no se puede ir más atrás.
  const lz = z - CAVE_ORIGIN.z
  return s.d <= s.width - r - 0.15 && lz < 1.5
}

/** Punto de llegada al entrar (un poco dentro, mirando hacia el fondo). */
export const CAVE_ARRIVAL = { x: CAVE_ORIGIN.x, z: CAVE_ORIGIN.z - 3, heading: Math.PI }
/** Volver a pisar esta zona (z local > -0.8) saca al robot fuera. */
export const CAVE_EXIT_Z = -0.6

/** Contenedor con la pieza, al fondo de la cámara final. */
export const CAVE_CACHE = { x: CAVE_ORIGIN.x, z: CAVE_ORIGIN.z - 76 }

// --- Boca de la cueva en el mundo (ver Cave en components/props/Pois.tsx) ---
const cavePoi = POIS.find((p) => p.id === 'cave')!
/** Centro de la boca: al llegar aquí el robot entra. */
export const CAVE_MOUTH = poiLocalToWorld(cavePoi, 0, -0.3)
/** Dónde aparece al salir: delante de la boca, mirando hacia fuera. */
export const CAVE_OUTSIDE = { ...poiLocalToWorld(cavePoi, 0, 2.6), heading: cavePoi.rotation }
