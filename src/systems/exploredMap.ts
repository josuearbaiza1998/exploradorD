import { getGame } from '@/store/gameStore'

/**
 * Niebla del mapa: qué zonas de la isla ha visto ya el robot. Rejilla de
 * GRID×GRID celdas sobre ±EXTENT metros, guardada en la partida como texto.
 */
export const MAP_EXTENT = 240
export const MAP_GRID = 64
const CELL = (MAP_EXTENT * 2) / MAP_GRID
/** Radio (m) que el robot "ve" a su alrededor. */
const REVEAL = 34

export const explored = new Uint8Array(MAP_GRID * MAP_GRID)
let loaded = false
let dirty = false
/** Sube al cambiar algo (el minimapa redibuja la niebla). */
export const exploredVersion = { v: 0 }

function load() {
  loaded = true
  const s = getGame().explored
  if (!s) return
  try {
    const bin = atob(s)
    for (let i = 0; i < explored.length; i++) explored[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1
  } catch {
    // Guardado dañado: se empieza a explorar de nuevo.
  }
  exploredVersion.v++
}

/** Marca como vista la zona alrededor de (x, z). */
export function revealAround(x: number, z: number) {
  if (!loaded) load()
  const r = Math.ceil(REVEAL / CELL)
  const ci = Math.floor((x + MAP_EXTENT) / CELL)
  const cj = Math.floor((z + MAP_EXTENT) / CELL)
  for (let j = cj - r; j <= cj + r; j++) {
    for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= MAP_GRID || j >= MAP_GRID) continue
      const cx = -MAP_EXTENT + (i + 0.5) * CELL
      const cz = -MAP_EXTENT + (j + 0.5) * CELL
      if ((cx - x) ** 2 + (cz - z) ** 2 > REVEAL * REVEAL) continue
      const k = j * MAP_GRID + i
      if (!explored[k]) {
        explored[k] = 1
        dirty = true
      }
    }
  }
  if (dirty) exploredVersion.v++
}

/** Guarda la niebla en la partida (pocas veces: cada varios segundos). */
export function flushExplored() {
  if (!dirty) return
  dirty = false
  let bin = ''
  for (let b = 0; b < explored.length / 8; b++) {
    let byte = 0
    for (let k = 0; k < 8; k++) byte |= explored[b * 8 + k] << k
    bin += String.fromCharCode(byte)
  }
  getGame().setExplored(btoa(bin))
}

export const isExplored = (x: number, z: number) => {
  if (!loaded) load()
  const i = Math.floor((x + MAP_EXTENT) / CELL)
  const j = Math.floor((z + MAP_EXTENT) / CELL)
  return i >= 0 && j >= 0 && i < MAP_GRID && j < MAP_GRID && explored[j * MAP_GRID + i] === 1
}
