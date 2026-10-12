import { BufferGeometry, Float32BufferAttribute, Shape, ShapeGeometry } from 'three'

/**
 * Geometrías del barco (la nave adaptada). Coordenadas locales de la nave:
 * +Z = proa, +Y = arriba; la línea de flotación queda en y = 1.
 */

export const HULL = { stern: -11.2, bow: 12.6, beam: 3.6, keel: -0.5, gunwale: 2.3 }

/** Media manga en z: popa algo estrecha, máxima en el centro, afilada en la proa. */
export function hullHalfBeam(z: number) {
  const t = (z - HULL.stern) / (HULL.bow - HULL.stern)
  if (t > 0.55) return HULL.beam * Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2))
  return HULL.beam * (0.86 + 0.14 * Math.sin((t / 0.55) * Math.PI * 0.5))
}

/** Altura de la borda: sube hacia la proa (arrufo). */
export function gunwaleAt(z: number) {
  const k = Math.max(0, (z - 3) / (HULL.bow - 3))
  return HULL.gunwale + k * k * 1.1
}

/** Quilla: sube en la proa, donde el casco corta el agua. */
function keelAt(z: number) {
  const k = Math.max(0, (z - 5) / (HULL.bow - 5))
  return HULL.keel + k * k * (gunwaleAt(HULL.bow) - HULL.keel - 0.3)
}

const STATIONS = 16

/**
 * Casco en V con pantoque redondeado: secciones transversales a lo largo de z
 * unidas por caras. `from`..`to` (0 borda, 1 quilla) permite sacar solo una
 * franja (la cinta de color de la borda) con un pequeño engorde.
 */
export function hullGeometry(from = 0, to = 1, grow = 0): BufferGeometry {
  // Perfil de una banda: (fracción de manga, fracción de altura entre quilla y borda).
  const profile: [number, number][] = [
    [1, 1],
    [0.97, 0.62],
    [0.82, 0.3],
    [0.45, 0.07],
    [0, 0],
  ]
  // Recorta el perfil al tramo pedido (interpolando por altura).
  const sample = (u: number): [number, number] => {
    const f = u * (profile.length - 1)
    const i = Math.min(profile.length - 2, Math.floor(f))
    const k = f - i
    return [profile[i][0] + (profile[i + 1][0] - profile[i][0]) * k, profile[i][1] + (profile[i + 1][1] - profile[i][1]) * k]
  }
  const rows = 4
  const prof = Array.from({ length: rows + 1 }, (_, r) => sample(from + ((to - from) * r) / rows))
  const pos: number[] = []
  const point = (z: number, p: [number, number], side: number) => {
    const hb = hullHalfBeam(z) + grow
    const top = gunwaleAt(z)
    const keel = keelAt(z)
    return [side * p[0] * hb, keel + (top - keel) * p[1], z]
  }
  for (let s = 0; s < STATIONS; s++) {
    const z0 = HULL.stern + ((HULL.bow - HULL.stern) * s) / STATIONS
    const z1 = HULL.stern + ((HULL.bow - HULL.stern) * (s + 1)) / STATIONS
    for (let r = 0; r < rows; r++) {
      for (const side of [-1, 1]) {
        const a = point(z0, prof[r], side)
        const b = point(z0, prof[r + 1], side)
        const c = point(z1, prof[r + 1], side)
        const d = point(z1, prof[r], side)
        // Caras hacia fuera en ambos costados.
        if (side > 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d)
        else pos.push(...a, ...c, ...b, ...a, ...d, ...c)
      }
    }
  }
  // Espejo de popa (solo el casco completo).
  if (from === 0 && to === 1) {
    const z = HULL.stern
    for (let r = 0; r < rows; r++) {
      const a = point(z, prof[r], 1)
      const b = point(z, prof[r + 1], 1)
      const c = point(z, prof[r + 1], -1)
      const d = point(z, prof[r], -1)
      pos.push(...a, ...c, ...b, ...a, ...d, ...c)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

/** Cubierta plana de tablones que sigue el contorno del casco, a la altura `y`. */
export function deckGeometry(y: number, inset = 0.25): BufferGeometry {
  const s = new Shape()
  const n = 24
  const zs = Array.from({ length: n + 1 }, (_, i) => HULL.stern + 0.1 + ((HULL.bow - 0.6 - HULL.stern - 0.1) * i) / n)
  zs.forEach((z, i) => {
    const x = Math.max(0.05, hullHalfBeam(z) * 0.97 - inset)
    if (i === 0) s.moveTo(x, -z)
    else s.lineTo(x, -z)
  })
  for (let i = n; i >= 0; i--) s.lineTo(-Math.max(0.05, hullHalfBeam(zs[i]) * 0.97 - inset), -zs[i])
  const g = new ShapeGeometry(s)
  // La forma está en (x, -z): tumbarla mirando hacia arriba y colocarla.
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/** Vela triangular (cuchillo) en el plano x = 0: grátil en el mástil y pujamen en la botavara. */
export function sailGeometry(height: number, foot: number, belly = 0.6): BufferGeometry {
  const pos: number[] = []
  const rows = 6
  const cols = 4
  const at = (u: number, v: number) => {
    // u: 0 mástil → 1 baluma; v: 0 abajo → 1 arriba. Triángulo: ancho (1 - v).
    const w = foot * (1 - v) * u
    const bulge = Math.sin(u * Math.PI) * Math.sin((1 - v) * Math.PI * 0.9) * belly
    return [bulge, v * height, -w]
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = at(c / cols, r / rows)
      const b = at((c + 1) / cols, r / rows)
      const cc = at((c + 1) / cols, (r + 1) / rows)
      const d = at(c / cols, (r + 1) / rows)
      pos.push(...a, ...b, ...cc, ...a, ...cc, ...d)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}
