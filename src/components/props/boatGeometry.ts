import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'

/**
 * Geometrías del barco: un bote corto y rechoncho hecho con el fuselaje de la
 * nave. Coordenadas locales: +Z = proa, +Y = arriba; la flotación queda en
 * y = BOAT.draft.
 */

export const HULL = { stern: -4.2, bow: 5.0, beam: 1.85, keel: -0.35, gunwale: 1.45 }

/** Media manga en z: popa ancha y redonda, barriga en el centro, afilada en la proa. */
export function hullHalfBeam(z: number) {
  const t = (z - HULL.stern) / (HULL.bow - HULL.stern)
  if (t > 0.45) return HULL.beam * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2.4))
  return HULL.beam * (0.8 + 0.2 * Math.sin((t / 0.45) * Math.PI * 0.5))
}

/** Altura de la borda: sube un poco en la proa (el morro de la nave sigue la curva) y en la popa. */
export function gunwaleAt(z: number) {
  const k = Math.max(0, (z - 1.5) / (HULL.bow - 1.5))
  const ks = Math.max(0, (-2.4 - z) / (-2.4 - HULL.stern))
  return HULL.gunwale + k * k * 0.5 + Math.pow(ks, 1.5) * 0.3
}

/** Quilla: sube en la proa, donde el casco corta el agua. */
function keelAt(z: number) {
  const k = Math.max(0, (z - 2) / (HULL.bow - 2))
  return HULL.keel + k * k * (gunwaleAt(HULL.bow) - HULL.keel - 0.25)
}

/**
 * Sección: de la borda (v 0) a la quilla (v 1), en fracción de la media manga
 * y de la altura. Costados abombados con algo de caída hacia dentro arriba,
 * para que el casco se vea gordito y no una barcaza.
 */
const PROFILE: [number, number][] = [
  [0.92, 1],
  [1.0, 0.8],
  [0.99, 0.56],
  [0.86, 0.3],
  [0.52, 0.09],
  [0, 0],
]

function sampleProfile(v: number): [number, number] {
  const f = Math.min(0.9999, Math.max(0, v)) * (PROFILE.length - 1)
  const i = Math.floor(f)
  const k = f - i
  // Interpolación suave entre puntos (curva, no polilínea dura).
  const s = k * k * (3 - 2 * k) * 0.35 + k * 0.65
  return [PROFILE[i][0] + (PROFILE[i + 1][0] - PROFILE[i][0]) * s, PROFILE[i][1] + (PROFILE[i + 1][1] - PROFILE[i][1]) * s]
}

/** Punto de la piel del casco en (z, v) por la banda `side` (+1 estribor). */
export function hullPoint(z: number, v: number, side: number, grow = 0): Vector3 {
  const p = sampleProfile(v)
  const hb = hullHalfBeam(z) + grow
  const top = gunwaleAt(z)
  const keel = keelAt(z)
  return new Vector3(side * p[0] * hb, keel + (top - keel) * p[1], z)
}

/** Normal hacia fuera de la piel en (z, v). */
export function hullNormal(z: number, v: number, side: number): Vector3 {
  const a = hullPoint(z - 0.05, v, side)
  const b = hullPoint(z + 0.05, v, side)
  const c = hullPoint(z, v - 0.03, side)
  const d = hullPoint(z, v + 0.03, side)
  const n = new Vector3().crossVectors(b.sub(a), d.sub(c)).normalize()
  return side > 0 ? n.negate() : n
}

const STATIONS = 28
const ROWS = 9

/**
 * Casco redondeado: secciones transversales a lo largo de z unidas por caras.
 * Con UV: u a lo largo (0 popa, 1 proa) y v de la borda (0) a la quilla (1).
 */
export function hullGeometry(): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const uOf = (z: number) => (z - HULL.stern) / (HULL.bow - HULL.stern)
  const zs = Array.from({ length: STATIONS + 1 }, (_, s) => {
    // Más estaciones hacia la proa, donde la curva es más cerrada.
    const t = s / STATIONS
    return HULL.stern + (HULL.bow - HULL.stern) * (t * 0.8 + 0.2 * t * t)
  })
  for (let s = 0; s < STATIONS; s++) {
    const z0 = zs[s]
    const z1 = zs[s + 1]
    for (let r = 0; r < ROWS; r++) {
      const v0 = r / ROWS
      const v1 = (r + 1) / ROWS
      for (const side of [-1, 1]) {
        const a = hullPoint(z0, v0, side).toArray()
        const b = hullPoint(z0, v1, side).toArray()
        const c = hullPoint(z1, v1, side).toArray()
        const d = hullPoint(z1, v0, side).toArray()
        const ua = [uOf(z0), v0]
        const ub = [uOf(z0), v1]
        const uc = [uOf(z1), v1]
        const ud = [uOf(z1), v0]
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
  // Espejo de popa.
  const z = HULL.stern
  for (let r = 0; r < ROWS; r++) {
    const a = hullPoint(z, r / ROWS, 1).toArray()
    const b = hullPoint(z, (r + 1) / ROWS, 1).toArray()
    const c = hullPoint(z, (r + 1) / ROWS, -1).toArray()
    const d = hullPoint(z, r / ROWS, -1).toArray()
    pos.push(...a, ...c, ...b, ...a, ...d, ...c)
    const v = 0.08 + (r / ROWS) * 0.4
    uv.push(0.01, v, 0.01, v, 0.01, v, 0.01, v, 0.01, v, 0.01, v)
  }
  // Las caras se generaron mirando hacia dentro: darles la vuelta para que la
  // normal salga hacia fuera (si no, el contorno negro tapa el casco).
  flipTriangles(pos, uv)
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Invierte el orden de los vértices de cada triángulo (y sus UV). */
function flipTriangles(pos: number[], uv: number[]) {
  for (let t = 0; t < pos.length / 9; t++) {
    for (let c = 0; c < 3; c++) {
      const a = t * 9 + 3 + c
      const b = t * 9 + 6 + c
      ;[pos[a], pos[b]] = [pos[b], pos[a]]
    }
    for (let c = 0; c < 2; c++) {
      const a = t * 6 + 2 + c
      const b = t * 6 + 4 + c
      ;[uv[a], uv[b]] = [uv[b], uv[a]]
    }
  }
}

/** Cubierta de tablones que sigue el contorno del casco, a la altura `y`. */
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
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

/** Tablones pintados en la cubierta (vetas y juntas), para que no sea un plano liso. */
export function deckPaint(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const tones = ['#a67a4c', '#9b6f43', '#b08455', '#a07447']
  for (let i = 0; i < 8; i++) {
    g.fillStyle = tones[i % tones.length]
    g.fillRect(i * 32, 0, 32, 256)
    g.fillStyle = 'rgba(60,35,20,0.55)'
    g.fillRect(i * 32, 0, 2, 256)
    // Juntas a tope escalonadas.
    const y = (i * 97) % 256
    g.fillRect(i * 32, y, 32, 2)
    g.fillStyle = 'rgba(60,35,20,0.8)'
    g.fillRect(i * 32 + 6, y + 6, 3, 3)
    g.fillRect(i * 32 + 23, y + 6, 3, 3)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = 1000 // RepeatWrapping
  return tex
}

/** Remolino tribal: espiral gruesa que acaba en punta de llama. */
function tribal(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number, sy = 0.8) {
  g.lineWidth = Math.max(5, r * 0.3)
  g.beginPath()
  for (let a = 0; a <= Math.PI * 2.6; a += 0.12) {
    const rr = r * (a / (Math.PI * 2.6))
    const x = cx + Math.cos(a * dir) * rr
    const y = cy + Math.sin(a * dir) * rr * sy
    if (a === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  // Cola en punta (triángulo relleno que se afila).
  const ex = cx + Math.cos(Math.PI * 2.6 * dir) * r
  const ey = cy + Math.sin(Math.PI * 2.6 * dir) * r * sy
  g.beginPath()
  g.moveTo(ex - r * 0.18, ey - r * 0.16)
  g.lineTo(ex + r * 0.18, ey + r * 0.16)
  g.lineTo(ex - dir * r * 1.7, ey + r * 0.55)
  g.closePath()
  g.fill()
}

/**
 * Pintura del casco (u: popa→proa, v: borda→quilla): metal gris claro de la
 * nave en placas remachadas a tresbolillo, parches de reparación, cinta
 * naranja que se convierte en remolinos tribales hacia la proa, y obra viva
 * gris azulada bajo la flotación.
 */
export function hullPaint(base: string, orange: string, dark: string): CanvasTexture {
  const W = 1024
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  // Placas: costuras horizontales y verticales a tresbolillo, con remaches.
  const seams = [0.07, 0.3, 0.52]
  g.strokeStyle = 'rgba(40,50,62,0.28)'
  g.lineWidth = 2
  seams.forEach((v) => {
    g.beginPath()
    g.moveTo(0, v * H)
    g.lineTo(W, v * H)
    g.stroke()
  })
  g.fillStyle = 'rgba(40,50,62,0.45)'
  for (let row = 0; row < seams.length - 1; row++) {
    const y0 = seams[row] * H
    const y1 = seams[row + 1] * H
    for (let x = (row % 2) * 45; x < W; x += 90) {
      g.fillRect(x, y0, 2, y1 - y0)
      for (let y = y0 + 6; y < y1 - 3; y += 10) g.fillRect(x + 5, y, 3, 3)
    }
    for (let x = 4; x < W; x += 12) g.fillRect(x, y0 + 4, 3, 3)
  }
  // Parches: chapas de otro tono con su borde y remaches.
  const patches: [number, number, number, number, string][] = [
    [0.12, 0.1, 0.07, 0.14, '#aeb8c3'],
    [0.31, 0.16, 0.05, 0.11, '#dfe4ea'],
    [0.46, 0.09, 0.08, 0.12, '#b9a691'],
    [0.6, 0.33, 0.06, 0.13, '#aeb8c3'],
    [0.22, 0.36, 0.09, 0.1, '#d6dce3'],
    [0.04, 0.2, 0.04, 0.2, '#b5bec8'],
  ]
  patches.forEach(([u, v, w, h, col]) => {
    const x = u * W
    const y = v * H
    g.fillStyle = col
    g.fillRect(x, y, w * W, h * H)
    g.strokeStyle = 'rgba(40,50,62,0.55)'
    g.lineWidth = 3
    g.strokeRect(x, y, w * W, h * H)
    g.fillStyle = 'rgba(40,50,62,0.6)'
    for (let k = 0; k <= 4; k++) {
      g.fillRect(x + (w * W * k) / 4 - 1, y + 3, 3, 3)
      g.fillRect(x + (w * W * k) / 4 - 1, y + h * H - 6, 3, 3)
    }
  })
  // Cinta oscura de la borda y cinta naranja debajo que sube a la proa.
  g.fillStyle = dark
  g.fillRect(0, 0, W, H * 0.06)
  g.strokeStyle = orange
  g.fillStyle = orange
  g.lineCap = 'round'
  g.lineWidth = 12
  g.beginPath()
  g.moveTo(0, H * 0.15)
  g.lineTo(W * 0.55, H * 0.15)
  g.quadraticCurveTo(W * 0.66, H * 0.15, W * 0.7, H * 0.3)
  g.stroke()
  // Tribales hacia la proa (en el casco y sobre la cinta).
  tribal(g, W * 0.76, H * 0.3, 40, 1)
  tribal(g, W * 0.87, H * 0.24, 34, -1)
  tribal(g, W * 0.95, H * 0.4, 24, 1)
  tribal(g, W * 0.64, H * 0.4, 20, -1)
  // Obra viva: gris azulado bajo la flotación, con una cinta naranja oscura.
  g.fillStyle = '#5d6977'
  g.fillRect(0, H * 0.6, W, H * 0.4)
  g.fillStyle = '#c4622f'
  g.fillRect(0, H * 0.57, W, H * 0.035)
  const tex = new CanvasTexture(c)
  // v = 0 es la fila de arriba del canvas (la borda), no la de abajo.
  tex.flipY = false
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/**
 * Morro de la nave como mascarón: tubo octogonal que se afila a lo largo de
 * una curva que sale de la proa, sube muy alto y se riza hacia atrás.
 * UV: u a lo largo (0 base, 1 punta), v alrededor (0 lomo, 0.25 babor, 0.75 estribor).
 */
export const FIGUREHEAD_CURVE = new CatmullRomCurve3([
  new Vector3(0, 1.25, 3.4),
  new Vector3(0, 1.6, 4.45),
  new Vector3(0, 2.2, 5.2),
  new Vector3(0, 2.95, 5.55),
  new Vector3(0, 3.55, 5.4),
  new Vector3(0, 3.8, 5.0),
])

export const figureheadRadius = (t: number) => 0.56 * Math.pow(1 - t, 0.8) + 0.05

export function figureheadGeometry(t0 = 0, t1 = 1, grow = 1, sides = 8, segs = 30): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const rings: Vector3[][] = []
  const n = segs
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const p = FIGUREHEAD_CURVE.getPointAt(t)
    const tan = FIGUREHEAD_CURVE.getTangentAt(t)
    // Marco: la curva está en el plano YZ, así que el lateral es siempre X.
    const side = new Vector3(1, 0, 0)
    const up = new Vector3().crossVectors(tan, side).normalize()
    const r = figureheadRadius(t) * grow
    const ring: Vector3[] = []
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2 + Math.PI / 2
      // Algo achatado de lado, como el fuselaje original.
      ring.push(p.clone().addScaledVector(side, Math.cos(a) * r * 0.82).addScaledVector(up, Math.sin(a) * r))
    }
    rings.push(ring)
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < sides; k++) {
      const a = rings[i][k].toArray()
      const b = rings[i + 1][k].toArray()
      const c = rings[i + 1][k + 1].toArray()
      const d = rings[i][k + 1].toArray()
      pos.push(...a, ...c, ...b, ...a, ...d, ...c)
      const u0 = t0 + ((t1 - t0) * i) / n
      const u1 = t0 + ((t1 - t0) * (i + 1)) / n
      const v0 = k / sides
      const v1 = (k + 1) / sides
      uv.push(u0, v0, u1, v1, u1, v0, u0, v0, u0, v1, u1, v1)
    }
  }
  // Tapas en los extremos.
  for (const [i, flip] of [[0, true], [n, false]] as const) {
    const ctr = rings[i].reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / (sides + 1))
    for (let k = 0; k < sides; k++) {
      const a = rings[i][k].toArray()
      const b = rings[i][k + 1].toArray()
      if (flip) pos.push(...ctr.toArray(), ...b, ...a)
      else pos.push(...ctr.toArray(), ...a, ...b)
      uv.push(0, 0, 0, 0, 0, 0)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Pintura del mascarón: gris claro con tribales naranjas y un ojo a cada lado. */
export function figureheadPaint(base: string, orange: string, dark: string): CanvasTexture {
  const W = 512
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, W, H)
  // Anillos de placas (costuras alrededor).
  g.fillStyle = 'rgba(40,50,62,0.35)'
  for (const u of [0.18, 0.36, 0.52, 0.66, 0.8]) g.fillRect(u * W, 0, 3, H)
  // Lomo (v = 0 / 1) con una cresta oscura.
  g.fillStyle = dark
  g.fillRect(0, 0, W, H * 0.06)
  g.fillRect(0, H * 0.94, W, H * 0.06)
  // Costados (v 0.25 babor, 0.75 estribor): tribales y un ojo cerca de la punta.
  g.strokeStyle = orange
  g.fillStyle = orange
  g.lineCap = 'round'
  for (const [vc, dir] of [[0.25, 1], [0.75, -1]] as const) {
    const cy = vc * H
    tribal(g, W * 0.22, cy, 30, dir, 0.75)
    tribal(g, W * 0.42, cy - dir * 6, 24, -dir, 0.75)
    g.lineWidth = 8
    g.beginPath()
    g.moveTo(0, cy + 22)
    g.bezierCurveTo(W * 0.1, cy + 22, W * 0.12, cy - 26, W * 0.2, cy - 26)
    g.stroke()
    // Ojo: anillo naranja con pupila oscura.
    g.beginPath()
    g.arc(W * 0.63, cy, 18, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = dark
    g.beginPath()
    g.arc(W * 0.635, cy, 9, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = orange
  }
  const tex = new CanvasTexture(c)
  // v = 0 es la fila de arriba del canvas (la borda), no la de abajo.
  tex.flipY = false
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/**
 * Rueda dentada extruida (eje en Z): `r` radio exterior, `teeth` dientes,
 * `hole` radio del agujero central (0 = maciza).
 */
export function gearGeometry(r: number, teeth: number, depth: number, hole = 0): BufferGeometry {
  const s = new Shape()
  const inner = r * 0.82
  const steps = teeth * 4
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const phase = i % 4
    const rr = phase === 1 || phase === 2 ? r : inner
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  if (hole > 0) {
    const h = new Shape()
    for (let i = 0; i <= 12; i++) {
      const a = -(i / 12) * Math.PI * 2
      if (i === 0) h.moveTo(Math.cos(a) * hole, Math.sin(a) * hole)
      else h.lineTo(Math.cos(a) * hole, Math.sin(a) * hole)
    }
    s.holes.push(h)
  }
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Ala corta en flecha (planta en XZ, espesor en Y) para los estabilizadores. */
export function stubWingGeometry(span: number, root: number, tip: number, sweep: number, thick: number): BufferGeometry {
  const s = new Shape()
  s.moveTo(0, root / 2)
  s.lineTo(span, root / 2 - sweep)
  s.lineTo(span, root / 2 - sweep - tip)
  s.lineTo(0, -root / 2)
  s.lineTo(0, root / 2)
  const g = new ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  // Shape (x envergadura, y cuerda hacia proa) → plano XZ con la cuerda en +z.
  g.rotateX(Math.PI / 2)
  g.translate(0, thick / 2, 0)
  return g
}

/** Deriva/timón: aleta en flecha (plano YZ, espesor X), borde de ataque en z = 0. */
export function finRudderGeometry(h: number, chord: number, thick: number): BufferGeometry {
  const s = new Shape()
  s.moveTo(0, 0)
  s.lineTo(0, h)
  s.lineTo(-chord * 0.7, h)
  s.lineTo(-chord, h * 0.25)
  s.lineTo(-chord * 0.8, 0)
  s.lineTo(0, 0)
  const g = new ExtrudeGeometry(s, { depth: thick, bevelEnabled: false })
  // Shape (x hacia popa negativa, y altura) → plano YZ con la cuerda hacia -z.
  g.rotateY(-Math.PI / 2)
  g.translate(thick / 2, 0, 0)
  return g
}
