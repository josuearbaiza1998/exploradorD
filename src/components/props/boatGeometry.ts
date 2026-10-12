import { BufferGeometry, CanvasTexture, Float32BufferAttribute, Shape, ShapeGeometry, SRGBColorSpace } from 'three'

/**
 * Geometrías del barco: un bote corto hecho con el fuselaje de la nave.
 * Coordenadas locales: +Z = proa, +Y = arriba; la flotación queda en y = BOAT.draft.
 */

export const HULL = { stern: -4.2, bow: 5.3, beam: 1.75, keel: -0.3, gunwale: 1.35 }

/** Media manga en z: popa ancha (espejo), máxima en el centro, afilada en la proa. */
export function hullHalfBeam(z: number) {
  const t = (z - HULL.stern) / (HULL.bow - HULL.stern)
  if (t > 0.5) return HULL.beam * Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2.2))
  return HULL.beam * (0.96 + 0.04 * Math.sin((t / 0.5) * Math.PI * 0.5))
}

/** Altura de la borda: la proa se levanta en cuerno, como en la imagen de referencia. */
export function gunwaleAt(z: number) {
  const k = Math.max(0, (z - 1.2) / (HULL.bow - 1.2))
  // La popa también se alza un poco: borda alta y robusta sobre el motor.
  const ks = Math.max(0, (-2.4 - z) / (-2.4 - HULL.stern))
  return HULL.gunwale + Math.pow(k, 2.2) * 1.9 + Math.pow(ks, 1.5) * 0.3
}

/** Quilla: sube en la proa, donde el casco corta el agua. */
function keelAt(z: number) {
  const k = Math.max(0, (z - 2) / (HULL.bow - 2))
  return HULL.keel + k * k * (gunwaleAt(HULL.bow) - HULL.keel - 0.25)
}

const STATIONS = 18

/**
 * Casco en V con pantoque redondeado: secciones transversales a lo largo de z
 * unidas por caras. `from`..`to` (0 borda, 1 quilla) saca solo una franja
 * (la cinta de la borda o el fondo) con un pequeño engorde. Con UV: u a lo
 * largo (0 popa, 1 proa) y v de la borda (0) a la quilla (1).
 */
export function hullGeometry(from = 0, to = 1, grow = 0): BufferGeometry {
  const profile: [number, number][] = [
    [1, 1],
    [0.98, 0.66],
    [0.84, 0.32],
    [0.46, 0.08],
    [0, 0],
  ]
  const sample = (u: number): [number, number] => {
    const f = u * (profile.length - 1)
    const i = Math.min(profile.length - 2, Math.floor(f))
    const k = f - i
    return [profile[i][0] + (profile[i + 1][0] - profile[i][0]) * k, profile[i][1] + (profile[i + 1][1] - profile[i][1]) * k]
  }
  const rows = 5
  const vs = Array.from({ length: rows + 1 }, (_, r) => from + ((to - from) * r) / rows)
  const prof = vs.map(sample)
  const pos: number[] = []
  const uv: number[] = []
  const point = (z: number, p: [number, number], side: number) => {
    const hb = hullHalfBeam(z) + grow
    const top = gunwaleAt(z)
    const keel = keelAt(z)
    return [side * p[0] * hb, keel + (top - keel) * p[1], z]
  }
  const uOf = (z: number) => (z - HULL.stern) / (HULL.bow - HULL.stern)
  for (let s = 0; s < STATIONS; s++) {
    const z0 = HULL.stern + ((HULL.bow - HULL.stern) * s) / STATIONS
    const z1 = HULL.stern + ((HULL.bow - HULL.stern) * (s + 1)) / STATIONS
    for (let r = 0; r < rows; r++) {
      for (const side of [-1, 1]) {
        const a = point(z0, prof[r], side)
        const b = point(z0, prof[r + 1], side)
        const c = point(z1, prof[r + 1], side)
        const d = point(z1, prof[r], side)
        const ua = [uOf(z0), vs[r]]
        const ub = [uOf(z0), vs[r + 1]]
        const uc = [uOf(z1), vs[r + 1]]
        const ud = [uOf(z1), vs[r]]
        if (side > 0) {
          pos.push(...a, ...b, ...c, ...a, ...c, ...d)
          uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud)
        } else {
          pos.push(...a, ...c, ...b, ...a, ...d, ...c)
          uv.push(...ua, ...uc, ...ub, ...ua, ...ud, ...uc)
        }
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
      uv.push(0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0.5)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Cubierta plana de tablones que sigue el contorno del casco, a la altura `y`. */
export function deckGeometry(y: number, inset = 0.12, zMax = HULL.bow - 1.6): BufferGeometry {
  const s = new Shape()
  const n = 20
  const zs = Array.from({ length: n + 1 }, (_, i) => HULL.stern + 0.05 + ((zMax - HULL.stern - 0.05) * i) / n)
  zs.forEach((z, i) => {
    const x = Math.max(0.05, hullHalfBeam(z) * 0.98 - inset)
    if (i === 0) s.moveTo(x, -z)
    else s.lineTo(x, -z)
  })
  for (let i = n; i >= 0; i--) s.lineTo(-Math.max(0.05, hullHalfBeam(zs[i]) * 0.98 - inset), -zs[i])
  const g = new ShapeGeometry(s)
  // La forma está en (x, -z): tumbarla mirando hacia arriba y colocarla.
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/**
 * Pintura del casco: metal gris de la nave con remolinos naranjas en la proa
 * (como en la imagen de referencia) y una cinta bajo la borda. Se dibuja una
 * vez en un canvas (u: popa→proa, v: borda→quilla).
 */
export function hullPaint(base: string, orange: string): CanvasTexture {
  const W = 512
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  // Placas remachadas: líneas verticales tenues.
  g.strokeStyle = 'rgba(0,0,0,0.12)'
  g.lineWidth = 2
  for (let x = 40; x < W; x += 52) {
    g.beginPath()
    g.moveTo(x, 10)
    g.lineTo(x, H)
    g.stroke()
  }
  g.strokeStyle = orange
  g.lineCap = 'round'
  // Cinta bajo la borda.
  g.lineWidth = 7
  g.beginPath()
  g.moveTo(0, 14)
  g.lineTo(W, 14)
  g.stroke()
  // Remolinos: espirales de Arquímedes con cola, repetidos hacia la proa.
  const swirl = (cx: number, cy: number, r: number, dir: number) => {
    g.lineWidth = Math.max(6, r * 0.26)
    g.beginPath()
    for (let a = 0; a <= Math.PI * 3.2; a += 0.15) {
      const rr = (r * a) / (Math.PI * 3.2)
      const x = cx + Math.cos(a * dir) * rr
      const y = cy + Math.sin(a * dir) * rr * 0.8
      if (a === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.lineTo(cx + r * 1.6 * -dir, cy + r * 0.5)
    g.stroke()
  }
  swirl(W * 0.86, H * 0.38, 34, 1)
  swirl(W * 0.7, H * 0.42, 28, -1)
  swirl(W * 0.55, H * 0.34, 22, 1)
  swirl(W * 0.95, H * 0.62, 18, -1)
  // Fondo bajo la flotación algo más oscuro.
  g.fillStyle = 'rgba(30,35,45,0.55)'
  g.fillRect(0, H * 0.52, W, H * 0.48)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
