/**
 * Generador del modelo del barco (public/models/boat.glb). No forma parte del
 * juego: se ejecuta en el navegador de desarrollo y exporta con GLTFExporter
 * (ver scripts/export-boat.cjs). Construye la nave-barco de las referencias:
 * fuselaje en forma de bala con morro de rejilla, capó blanco con parabrisas
 * azul, cabina abierta con timón y cacharros, mástil con farol y banderines,
 * carga, barriles atados, alas cortas, turbina con chimenea, engranajes,
 * hélice y aleta de dirección vertical.
 *
 * Nodos con nombre que el juego anima o enciende: wheel, rudder, prop, gearA,
 * gearB, flag0, flag1, lamp, smoke, glow y los grupos part_navigation,
 * part_comms, part_cooling y part_engine (se ven según las reparaciones).
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  ShapeGeometry,
  ExtrudeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three'
import { BOAT } from '@/config/boat'
import { Kit } from './boatKit'
import {
  DECK,
  DRIVE,
  FUSE,
  GEAR_A,
  GEAR_B,
  LAMP_LOCAL,
  MAST,
  OPENING,
  PROP,
  RUDDER,
  STACK_TOP,
  TURBINE,
  WHEEL,
} from '@/components/props/boatLayout'

type V3 = [number, number, number]

// ---------------------------------------------------------------- materiales

function mat(name: string, color: string, opts: { flat?: boolean; double?: boolean; emissive?: string; ei?: number; map?: CanvasTexture } = {}) {
  const m = new MeshStandardMaterial({ name, color, roughness: 1, metalness: 0 })
  if (opts.map) m.map = opts.map
  if (opts.double) m.side = DoubleSide
  if (opts.emissive) {
    m.emissive.set(opts.emissive)
    m.emissiveIntensity = opts.ei ?? 1
  }
  m.userData = { flat: !!opts.flat }
  return m
}

// ------------------------------------------------------------------ fuselaje

const TG = 2.094 // ángulo de la borda (desde la quilla) en la sección

/** Sección del fuselaje en z: media manga, media altura y altura del centro. */
export function prof(z: number) {
  const { beam, half, center } = FUSE
  if (z > 0.8) {
    const t = Math.min(1, (z - 0.8) / (FUSE.nose - 0.8))
    const f = Math.sqrt(Math.max(0, 1 - t * t))
    return { w: 0.3 + (beam - 0.3) * Math.pow(f, 0.85), h: 0.28 + (half - 0.28) * f, yc: center + 0.35 * Math.pow(t, 1.5) }
  }
  if (z < -2.2) {
    const t = Math.min(1, (-2.2 - z) / (-2.2 - FUSE.stern))
    return { w: beam * (1 - 0.25 * t * t), h: half * (1 - 0.22 * t * t), yc: center + 0.12 * t * t }
  }
  return { w: beam, h: half, yc: center }
}

type Station = { z: number; w: number; h: number; yc: number }

/** Estaciones de popa a proa: cúpula trasera + cuerpo (más densas en el morro). */
function stations(zFrom = -99, zTo = 99): Station[] {
  const out: Station[] = []
  const s0 = prof(FUSE.stern)
  for (let i = 8; i >= 1; i--) {
    const a = (i / 8) * (Math.PI / 2)
    const k = Math.cos(a)
    out.push({ z: FUSE.stern - FUSE.dome * Math.sin(a), w: s0.w * Math.max(0.001, k), h: s0.h * Math.max(0.001, k), yc: s0.yc })
  }
  const N = 46
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const z = FUSE.stern + (FUSE.nose - FUSE.stern) * (t * 0.7 + 0.3 * t * t)
    out.push({ z, ...prof(z) })
  }
  return out.filter((s) => s.z >= zFrom - 1e-6 && s.z <= zTo + 1e-6)
}

const ringPoint = (s: Station, th: number, grow = 0) =>
  new Vector3((s.w + grow) * Math.sin(th), s.yc - (s.h + grow) * Math.cos(th), s.z)

/** Altura de la piel superior del fuselaje en (x, z). */
export function topY(x: number, z: number) {
  const p = prof(z)
  const k = Math.min(1, Math.abs(x) / p.w)
  return p.yc + p.h * Math.sqrt(1 - k * k)
}

/** Malla indexada de una rejilla de puntos (filas a lo largo, columnas alrededor). */
function grid(rows: Vector3[][], uvs: [number, number][][], outward: boolean, axisY: (z: number) => number): BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  rows.forEach((r, i) => r.forEach((p, j) => {
    pos.push(p.x, p.y, p.z)
    uv.push(uvs[i][j][0], uvs[i][j][1])
  }))
  const cols = rows[0].length
  const idx: number[] = []
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j
      const b = (i + 1) * cols + j
      idx.push(a, b, b + 1, a, b + 1, a + 1)
    }
  }
  // Orientar las caras: comprobar una del medio contra el eje del fuselaje.
  const pa = rows[Math.floor(rows.length / 2)][Math.floor(cols / 2)]
  const pb = rows[Math.floor(rows.length / 2) + 1][Math.floor(cols / 2)]
  const pc = rows[Math.floor(rows.length / 2) + 1][Math.floor(cols / 2) + 1]
  const n = new Vector3().crossVectors(pb.clone().sub(pa), pc.clone().sub(pa))
  const out = pa.clone().sub(new Vector3(0, axisY(pa.z), pa.z))
  if ((n.dot(out) > 0) !== outward) for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]]
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const ycAt = (z: number) => (z < FUSE.stern ? prof(FUSE.stern).yc : prof(z).yc)
const Z_MIN = FUSE.stern - FUSE.dome
const uOf = (z: number) => (z - Z_MIN) / (FUSE.nose - Z_MIN)

/** Casco bajo la borda (de borda a borda por la quilla). */
function lowerHull(): BufferGeometry {
  const st = stations()
  const nT = 22
  const rows = st.map((s) => Array.from({ length: nT + 1 }, (_, j) => ringPoint(s, -TG + (2 * TG * j) / nT)))
  const uvs = st.map((s) => Array.from({ length: nT + 1 }, (_, j) => [uOf(s.z), j / nT] as [number, number]))
  return grid(rows, uvs, true, ycAt)
}

/** Borde delantero del hueco de la cabina (semicírculo bajo el capó). */
const frontEdge = (phi: number) => OPENING.front + OPENING.frontR * Math.sqrt(Math.max(0, 1 - phi * phi))
const thetaOfPhi = (phi: number) => Math.PI - phi * (Math.PI - TG)

/** Capó delantero: tapa la parte de arriba del fuselaje desde el hueco hasta el morro. */
function frontCowl(): BufferGeometry {
  const nP = 22
  const nS = 30
  const rows: Vector3[][] = []
  const uvs: [number, number][][] = []
  for (let i = 0; i <= nS; i++) {
    const s = i / nS
    const row: Vector3[] = []
    const ur: [number, number][] = []
    for (let j = 0; j <= nP; j++) {
      const phi = -1.03 + (2.06 * j) / nP
      const z0 = frontEdge(Math.min(1, Math.abs(phi)))
      const z = z0 + (FUSE.nose - z0) * s
      const p = prof(z)
      row.push(ringPoint({ z, ...p }, thetaOfPhi(phi)))
      ur.push([(z - OPENING.front) / (FUSE.nose - OPENING.front), (phi + 1.03) / 2.06])
    }
    rows.push(row)
    uvs.push(ur)
  }
  return grid(rows, uvs, true, ycAt)
}

/** Cubierta de popa: tapa el fuselaje detrás del hueco (sobre ella va el motor). */
function aftCowl(): BufferGeometry {
  const st = stations(-99, OPENING.aft)
  const nT = 16
  const rows = st.map((s) => Array.from({ length: nT + 1 }, (_, j) => ringPoint(s, TG - 0.03 + ((2 * Math.PI - 2 * TG + 0.06) * j) / nT)))
  const uvs = st.map((s) => Array.from({ length: nT + 1 }, (_, j) => [uOf(s.z), j / nT] as [number, number]))
  return grid(rows, uvs, true, ycAt)
}

/** Forro interior de madera en los costados del hueco, por encima de la cubierta. */
function lining(side: number): BufferGeometry {
  const st = stations(OPENING.aft - 0.05, OPENING.front + OPENING.frontR + 0.1)
  const thDeck = Math.acos((FUSE.center - DECK) / FUSE.half) - 0.05
  const nT = 5
  const rows = st.map((s) => Array.from({ length: nT + 1 }, (_, j) => ringPoint(s, side * (thDeck + ((TG - thDeck) * j) / nT), -0.035)))
  const uvs = st.map((s) => Array.from({ length: nT + 1 }, (_, j) => [uOf(s.z), j / nT] as [number, number]))
  return grid(rows, uvs, false, ycAt)
}

/** Cubierta de tablones dentro del hueco. */
function deck(): BufferGeometry {
  const s = new Shape()
  const n = 24
  const z0 = OPENING.aft - 0.05
  const z1 = OPENING.front + OPENING.frontR
  const hw = (z: number) => prof(z).w * 0.95 - 0.06
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n
    if (i === 0) s.moveTo(hw(z), -z)
    else s.lineTo(hw(z), -z)
  }
  for (let i = n; i >= 0; i--) {
    const z = z0 + ((z1 - z0) * i) / n
    s.lineTo(-hw(z), -z)
  }
  const g = new ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  g.translate(0, DECK, 0)
  // UV en metros/2 (los tablones se repiten).
  const p = g.attributes.position
  const uv: number[] = []
  for (let i = 0; i < p.count; i++) uv.push(p.getX(i) * 0.5, p.getZ(i) * 0.5)
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return g
}

// ----------------------------------------------------------------- texturas

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}
function tex(c: HTMLCanvasElement, repeat = false) {
  const t = new CanvasTexture(c)
  t.flipY = false
  t.colorSpace = SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = 1000
  return t
}

/** Remolino tribal: espiral gruesa con cola en punta de llama. */
function tribal(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, dir: number, sy = 1) {
  g.lineCap = 'round'
  g.lineWidth = Math.max(4, r * 0.32)
  g.beginPath()
  for (let a = 0; a <= Math.PI * 2.4; a += 0.1) {
    const rr = r * (a / (Math.PI * 2.4))
    const x = cx + Math.cos(a * dir) * rr
    const y = cy + Math.sin(a * dir) * rr * sy
    if (a === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
  const ex = cx + Math.cos(Math.PI * 2.4 * dir) * r
  const ey = cy + Math.sin(Math.PI * 2.4 * dir) * r * sy
  g.beginPath()
  g.moveTo(ex - r * 0.2, ey - r * 0.12 * sy)
  g.quadraticCurveTo(ex - dir * r * 0.9, ey + r * 0.55 * sy, ex - dir * r * 1.9, ey + r * 0.25 * sy)
  g.quadraticCurveTo(ex - dir * r * 0.8, ey + r * 0.2 * sy, ex + r * 0.2, ey + r * 0.15 * sy)
  g.closePath()
  g.fill()
}

/** Gotas de óxido: manchas pardas suaves, sin buscar realismo. */
function rust(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = 'rgba(150,92,52,0.32)'
  g.beginPath()
  g.ellipse(x, y, w, h, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(150,92,52,0.22)'
  g.fillRect(x - w * 0.15, y, w * 0.3, h * 2.2)
}

/** Casco: chapa gris con costuras remachadas, tribales naranjas a proa y algo de óxido. */
function hullTexture() {
  const W = 1024
  const H = 512
  const { c, g } = canvas(W, H)
  g.fillStyle = '#c3cad3'
  g.fillRect(0, 0, W, H)
  // Costuras: anillos a lo largo y dos líneas horizontales, con remaches.
  g.fillStyle = 'rgba(55,64,76,0.35)'
  for (let k = 1; k < 10; k++) {
    const x = (k / 10) * W
    g.fillRect(x, 0, 2, H)
    for (let y = 8; y < H; y += 16) g.fillRect(x + 5, y, 3, 3)
  }
  for (const v of [0.2, 0.8]) {
    g.fillRect(0, v * H, W, 2)
    for (let x = 6; x < W; x += 14) g.fillRect(x, v * H + 5, 3, 3)
  }
  // Óxido a media altura y junto a las costuras.
  const rnd = (i: number) => {
    const x = Math.sin(i * 91.3 + 7.1) * 43758.5453
    return x - Math.floor(x)
  }
  for (let i = 0; i < 26; i++) {
    const v = i % 2 ? 0.3 + rnd(i) * 0.14 : 0.56 + rnd(i) * 0.14
    rust(g, rnd(i + 50) * W, v * H, 14 + rnd(i + 9) * 22, 5 + rnd(i + 3) * 6)
  }
  // Tribales en la franja visible sobre el agua de cada costado (v 0..0.18
  // es babor de la borda a la flotación; 0.82..1, estribor), del centro a la proa.
  g.fillStyle = '#ff7a3d'
  g.strokeStyle = '#ff7a3d'
  for (const [vc, sy] of [[0.095, 1], [0.905, -1]] as const) {
    const cy = vc * H
    const row: [number, number, number, number][] = [
      [0.5, 0, 34, 1],
      [0.6, -10, 40, -1],
      [0.7, 6, 40, 1],
      [0.79, -8, 36, -1],
      [0.87, 4, 30, 1],
      [0.94, -4, 22, -1],
    ]
    for (const [u, dy, r, dir] of row) tribal(g, u * W, cy + sy * dy, r, dir, sy)
    // Ola que las une por debajo y otra por encima.
    g.lineWidth = 9
    g.beginPath()
    g.moveTo(W * 0.44, cy + sy * 30)
    for (let k = 0; k < 6; k++) {
      const x0 = W * (0.44 + k * 0.09)
      g.bezierCurveTo(x0 + W * 0.03, cy + sy * 48, x0 + W * 0.06, cy + sy * 20, x0 + W * 0.09, cy + sy * 34)
    }
    g.stroke()
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(W * 0.55, cy - sy * 40)
    g.bezierCurveTo(W * 0.65, cy - sy * 30, W * 0.75, cy - sy * 46, W * 0.98, cy - sy * 36)
    g.stroke()
  }
  // En la panza del morro (se ve porque sube hacia la punta).
  for (const [vc, sy] of [[0.27, 1], [0.73, -1]] as const) {
    tribal(g, W * 0.9, vc * H, 26, 1, sy)
    tribal(g, W * 0.97, vc * H + sy * 10, 16, -1, sy)
  }
  return tex(c)
}

/** Capó: blanco hueso detrás y gris con tribales en el morro. */
function cowlTexture() {
  const W = 1024
  const H = 256
  const { c, g } = canvas(W, H)
  g.fillStyle = '#e7e3da'
  g.fillRect(0, 0, W, H)
  const split = 0.4 * W
  g.fillStyle = '#c3cad3'
  g.fillRect(split, 0, W - split, H)
  g.fillStyle = 'rgba(55,64,76,0.4)'
  g.fillRect(split, 0, 3, H)
  for (let y = 6; y < H; y += 12) g.fillRect(split + 7, y, 3, 3)
  for (const u of [0.62, 0.82]) {
    g.fillRect(u * W, 0, 2, H)
    for (let y = 6; y < H; y += 14) g.fillRect(u * W + 5, y, 3, 3)
  }
  g.fillStyle = '#ff7a3d'
  g.strokeStyle = '#ff7a3d'
  // Tribales alrededor del morro: grandes a los lados (v ≈ 0.12 / 0.88) y arriba.
  for (const [vc, sy] of [[0.13, 1], [0.87, -1]] as const) {
    const cy = vc * H
    tribal(g, W * 0.5, cy, 26, 1, sy)
    tribal(g, W * 0.62, cy + sy * 8, 24, -1, sy)
    tribal(g, W * 0.74, cy - sy * 4, 22, 1, sy)
    tribal(g, W * 0.85, cy + sy * 6, 18, -1, sy)
    tribal(g, W * 0.94, cy, 12, 1, sy)
  }
  tribal(g, W * 0.56, H * 0.5, 24, 1)
  tribal(g, W * 0.72, H * 0.42, 20, -1)
  tribal(g, W * 0.86, H * 0.55, 15, 1)
  return tex(c)
}

/** Tablones de la cubierta. */
function deckTexture() {
  const { c, g } = canvas(256, 256)
  const tones = ['#8a6340', '#7f5a39', '#93694a', '#86603d']
  for (let i = 0; i < 8; i++) {
    g.fillStyle = tones[i % 4]
    g.fillRect(i * 32, 0, 32, 256)
    g.fillStyle = 'rgba(45,28,16,0.6)'
    g.fillRect(i * 32, 0, 2, 256)
    const y = (i * 97) % 256
    g.fillRect(i * 32, y, 32, 2)
  }
  return tex(c, true)
}

// ---------------------------------------------------------------- utilidades

/**
 * Rueda dentada extruida (eje en Z): `r` radio exterior, `teeth` dientes,
 * `hole` radio del agujero central (0 = maciza).
 */
function gearGeometry(r: number, teeth: number, depth: number, hole = 0): BufferGeometry {
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
function stubWingGeometry(span: number, root: number, tip: number, sweep: number, thick: number): BufferGeometry {
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


const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, s = 10) => new CylinderGeometry(rt, rb, h, s)
const X90: V3 = [Math.PI / 2, 0, 0]
const Z90: V3 = [0, 0, Math.PI / 2]
const tube = (pts: Vector3[], r: number, seg = 60, closed = false, radial = 6) =>
  new TubeGeometry(new CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, radial, closed)

/** Normal de la piel superior en (x, z) (para pegar placas al capó). */
function topNormal(x: number, z: number) {
  const p = prof(z)
  const y = topY(x, z) - p.yc
  return new Vector3(x / (p.w * p.w), y / (p.h * p.h), 0).normalize()
}

function meshesOf(kit: Kit, parent: Object3D) {
  for (const { material, geometry } of kit.build()) {
    const m = new Mesh(geometry, material)
    parent.add(m)
  }
}

// ------------------------------------------------------------------- modelo

export function buildBoat(): Group {
  const M = {
    hull: mat('hull', '#ffffff', { map: hullTexture() }),
    cowl: mat('cowl', '#ffffff', { map: cowlTexture(), double: true }),
    aft: mat('aft', '#c3cad3', { double: true }),
    lining: mat('lining', '#6e4c30', { flat: true }),
    deck: mat('deck', '#ffffff', { map: deckTexture() }),
    wood: mat('wood', '#7c5130', { flat: true }),
    rim: mat('rim', '#8f6238', { flat: true }),
    light: mat('light', '#e7e3da', { flat: true }),
    gray: mat('gray', '#c3cad3', { flat: true }),
    metal: mat('metal', '#a9b1ba', { flat: true }),
    steel: mat('steel', '#6f7780', { flat: true }),
    dark: mat('dark', '#3f4752', { flat: true }),
    orange: mat('orange', '#ff7a3d', { flat: true }),
    rust: mat('rustOrange', '#e2682e', { flat: true }),
    brass: mat('brass', '#d1a54a', { flat: true }),
    glass: mat('glass', '#41b8ea', { emissive: '#3ad0ff', ei: 0.35, double: true }),
    gauge: mat('gauge', '#e9f4f7', { emissive: '#bfe9ff', ei: 0.25 }),
    screen: mat('screen', '#2bd6a0', { emissive: '#2bd6a0', ei: 0.8 }),
    red: mat('red', '#d8452f', { flat: true }),
    cable: mat('cable', '#2a2d31'),
    cableRed: mat('cableRed', '#c8382a'),
    rope: mat('rope', '#d8c28e'),
    sack: mat('sack', '#cdb58a', { flat: true }),
    crate: mat('crate', '#b58a55', { flat: true }),
    solar: mat('solar', '#26467f', { emissive: '#3b6fd6', ei: 0.15 }),
    flagA: mat('flagA', '#e0602e', { double: true }),
    flagB: mat('flagB', '#f2b23a', { double: true }),
    glow: mat('glow', '#7fe3ff', { emissive: '#3ad0ff', ei: 1.3 }),
  }
  const root = new Group()
  root.name = 'boat'

  // ---- Casco base (siempre visible)
  const base = new Group()
  base.name = 'part_hull'
  root.add(base)
  base.add(new Mesh(lowerHull(), M.hull), new Mesh(frontCowl(), M.cowl), new Mesh(aftCowl(), M.aft))
  base.add(new Mesh(lining(1), M.lining), new Mesh(lining(-1), M.lining), new Mesh(deck(), M.deck))
  const k = new Kit()
  // Tapa del morro bajo la rejilla.
  const pn = prof(FUSE.nose)
  k.add(M.dark, new CircleGeometry(1, 12), [0, pn.yc, FUSE.nose - 0.01], [0, 0, 0], [pn.w, pn.h, 1])
  k.add(M.dark, new TorusGeometry(1, 0.06, 6, 16), [0, pn.yc, FUSE.nose], [0, 0, 0], [pn.w, pn.h, 1])
  // Morro de rejilla: cono de anillos y varillas en espiral cruzadas.
  const cageR = (t: number) => (1 - t) * 0.32 + 0.015
  const cageP = (t: number, a: number) => new Vector3(Math.cos(a) * cageR(t) * (pn.w / 0.3) * 0.9, pn.yc + Math.sin(a) * cageR(t) * (pn.h / 0.28) * 0.9, FUSE.nose + (FUSE.tip - FUSE.nose) * t)
  for (const t of [0.0, 0.25, 0.5, 0.75]) {
    const pts = Array.from({ length: 17 }, (_, i) => cageP(t, (i / 16) * Math.PI * 2))
    k.add(M.dark, tube(pts, 0.02, 32, true, 4))
  }
  for (let i = 0; i < 8; i++) {
    for (const dir of [1, -1]) {
      const pts = Array.from({ length: 9 }, (_, j) => cageP(j / 8, (i / 8) * Math.PI * 2 + dir * (j / 8) * 1.6))
      k.add(M.dark, tube(pts, 0.016, 16, false, 4))
    }
  }
  k.add(M.dark, new ConeGeometry(0.04, 0.14, 6), [0, pn.yc, FUSE.tip + 0.05], X90)
  // Brocal de madera alrededor del hueco de la cabina.
  const rimPts: Vector3[] = []
  const gx = (z: number) => {
    const p = prof(z)
    return new Vector3(p.w * Math.sin(TG), p.yc - p.h * Math.cos(TG), z)
  }
  for (let z = OPENING.aft; z <= OPENING.front; z += 0.35) rimPts.push(gx(z))
  for (let i = 0; i <= 14; i++) {
    const phi = 1 - (2 * i) / 14
    const z = frontEdge(Math.abs(phi))
    rimPts.push(ringPoint({ z, ...prof(z) }, thetaOfPhi(phi)))
  }
  for (let z = OPENING.front; z >= OPENING.aft; z -= 0.35) rimPts.push(gx(z).multiply(new Vector3(-1, 1, 1)))
  for (let i = 1; i < 8; i++) {
    const phi = -1 + (2 * i) / 8
    rimPts.push(ringPoint({ z: OPENING.aft, ...prof(OPENING.aft) }, thetaOfPhi(phi)))
  }
  k.add(M.rim, tube(rimPts, 0.07, 140, true, 6))
  // Barandilla de tubo: por los costados y rodeando el parabrisas por delante.
  const railPts: Vector3[] = []
  const railY = (x: number, z: number) => (z <= OPENING.front ? gx(z).y : Math.max(gx(z).y, topY(x, z))) + 0.45
  for (let z = -3.35; z <= OPENING.front; z += 0.5) {
    const x = gx(z).x - 0.04
    railPts.push(new Vector3(x, railY(x, z), z))
  }
  const ux = gx(OPENING.front).x - 0.04
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI
    const x = ux * Math.cos(a)
    const z = OPENING.front + 2.3 * Math.sin(a)
    railPts.push(new Vector3(x, railY(x, z), z))
  }
  for (let z = OPENING.front; z >= -3.35; z -= 0.5) {
    const x = -(gx(z).x - 0.04)
    railPts.push(new Vector3(x, railY(x, z), z))
  }
  k.add(M.metal, tube(railPts, 0.045, 110, false, 6))
  // Postes de la barandilla.
  const railCurve = new CatmullRomCurve3(railPts, false, 'centripetal')
  for (let i = 0; i <= 16; i++) {
    const p = railCurve.getPointAt(i / 16)
    const foot = p.z <= OPENING.front + 0.05 ? gx(p.z).y : topY(p.x, p.z)
    k.rod(M.metal, [p.x, foot - 0.03, p.z], [p.x, p.y, p.z], 0.035, 6)
  }
  // Placas naranjas del capó a los lados del hueco.
  for (const sx of [-1, 1]) {
    const x = sx * 1.12
    const z = 0.95
    const n = topNormal(x, z)
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n)
    const pos = new Vector3(x, topY(x, z), z).addScaledVector(n, 0.01)
    k.addQuat(M.orange, box(0.32, 0.3, 0.03), pos, q)
  }
  // Alas cortas (estabilizadores), con franja y punta naranjas.
  for (const side of [-1, 1]) {
    const z = 0.15
    const p = prof(z)
    const rootX = side * (p.w - 0.12)
    const y = BOAT.draft + 0.45
    const span = 1.05
    k.add(M.light, stubWingGeometry(side * span, 1.5, 0.95, 0.35, 0.15), [rootX, y, z])
    k.add(M.orange, box(0.24, 0.17, 1.48), [rootX + side * 0.3, y, z - 0.0])
    k.add(M.orange, box(0.32, 0.17, 0.36), [rootX + side * (span - 0.18), y, z + 0.75 - 0.35 - 0.95 + 0.2])
    k.add(M.steel, box(0.1, 0.3, 1.2), [side * (p.w - 0.03), y + 0.04, z])
  }
  meshesOf(k, base)

  // ---- Navegación: parabrisas, consola, columna y timón
  const nav = new Group()
  nav.name = 'part_navigation'
  root.add(nav)
  const kn = new Kit()
  const cz = 1.72
  const cy = topY(0, cz) - 0.08
  kn.add(M.glass, new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, cy, cz], [0, 0, 0], [0.52, 0.42, 0.66])
  kn.add(M.gray, new TorusGeometry(1, 0.05, 6, 24), [0, cy + 0.02, cz], [Math.PI / 2, 0, 0], [0.54, 0.68, 1])
  // Visera gris tras el cristal (como en la nave).
  kn.add(M.gray, new SphereGeometry(1, 14, 6, Math.PI * 1.15, Math.PI * 0.7, 0, Math.PI / 2), [0, cy, cz - 0.05], [0, 0, 0], [0.58, 0.5, 0.74])
  // Consola de relojes bajo el borde del capó.
  kn.add(M.steel, box(1.2, 0.82, 0.34), [0, DECK + 0.41, 1.12])
  kn.add(M.dark, box(1.24, 0.08, 0.38), [0, DECK + 0.84, 1.12])
  for (const [x, y, r] of [[-0.38, 0.6, 0.11], [-0.12, 0.64, 0.08], [0.36, 0.6, 0.1], [0.36, 0.3, 0.07], [-0.38, 0.3, 0.07]] as const) {
    kn.add(M.brass, cyl(r + 0.025, r + 0.025, 0.04, 12), [x, DECK + y, 0.95], X90)
    kn.add(M.gauge, new SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), [x, DECK + y, 0.94], [-Math.PI / 2, 0, 0])
  }
  kn.add(M.screen, box(0.3, 0.18, 0.02), [0.06, DECK + 0.34, 0.95])
  // Palancas con pomo.
  for (const [x, lean, col] of [[0.12, 0.4, M.red], [0.22, -0.3, M.orange], [-0.24, 0.2, M.brass]] as const) {
    const b: V3 = [x, DECK + 0.84, 1.05]
    const tip: V3 = [x + lean * 0.1, DECK + 1.2, 1.05 - lean * 0.3]
    kn.rod(M.metal, b, tip, 0.02, 5)
    kn.add(col, new IcosahedronGeometry(0.055, 0), tip)
  }
  // Columna del timón y eje.
  kn.add(M.steel, box(0.22, WHEEL.y - DECK, 0.22), [0, (DECK + WHEEL.y) / 2, 0.64])
  kn.add(M.brass, box(0.26, 0.08, 0.26), [0, DECK + 0.04, 0.64])
  kn.add(M.steel, cyl(0.05, 0.05, 0.32, 8), [0, WHEEL.y, 0.5], X90)
  meshesOf(kn, nav)
  const wheel = new Group()
  wheel.name = 'wheel'
  wheel.position.set(0, WHEEL.y, WHEEL.z)
  nav.add(wheel)
  const kw = new Kit()
  kw.add(M.wood, new TorusGeometry(WHEEL.r, 0.055, 6, 20))
  kw.add(M.brass, cyl(0.12, 0.12, 0.14, 10), [0, 0, 0], X90)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    kw.add(M.wood, box(WHEEL.r, 0.05, 0.05), [Math.cos(a) * WHEEL.r * 0.5, Math.sin(a) * WHEEL.r * 0.5, 0], [0, 0, a])
    kw.add(M.wood, cyl(0.035, 0.05, 0.2, 6), [Math.cos(a) * (WHEEL.r + 0.1), Math.sin(a) * (WHEEL.r + 0.1), 0], [0, 0, a - Math.PI / 2])
  }
  meshesOf(kw, wheel)

  // ---- Comunicaciones: mástil con farol (el dron) y banderines
  const comms = new Group()
  comms.name = 'part_comms'
  root.add(comms)
  const mast = new Group()
  mast.position.set(MAST.x, DECK, MAST.z)
  mast.rotation.set(MAST.tiltX, 0, MAST.tiltZ)
  comms.add(mast)
  const km = new Kit()
  km.add(M.wood, cyl(0.07, 0.1, MAST.h, 7), [0, MAST.h / 2, 0])
  km.add(M.steel, box(0.36, 0.12, 0.36), [0, 0.06, 0])
  for (const y of [1.2, 2.4, 3.3]) km.add(M.rope, cyl(0.1, 0.1, 0.14, 7), [0, y, 0])
  km.add(M.wood, cyl(0.04, 0.04, 0.85, 5), [0, MAST.h - 0.42, 0.38], X90)
  km.add(M.wood, cyl(0.03, 0.03, 0.4, 5), [0, MAST.h - 0.6, 0.2], [0.8, 0, 0])
  km.add(M.steel, cyl(0.012, 0.012, 0.22, 4), [0, MAST.h - 0.53, 0.75])
  km.add(M.wood, new SphereGeometry(0.09, 6, 4), [0, MAST.h + 0.03, 0])
  meshesOf(km, mast)
  const lamp = new Object3D()
  lamp.name = 'lamp'
  lamp.position.copy(LAMP_LOCAL)
  comms.add(lamp)
  // Banderines de cola de golondrina hacia popa.
  const swallow = () => {
    const s = new Shape()
    s.moveTo(0, 0.14)
    s.lineTo(-0.62, 0.12)
    s.lineTo(-0.42, 0.0)
    s.lineTo(-0.66, -0.13)
    s.lineTo(0, -0.12)
    s.lineTo(0, 0.14)
    const g = new ShapeGeometry(s)
    g.rotateY(-Math.PI / 2) // x de la forma → -z (hacia popa)
    return g
  }
  ;[[MAST.h - 0.28, M.flagA], [MAST.h - 0.72, M.flagB]].forEach(([y, m], i) => {
    const f = new Group()
    f.name = `flag${i}`
    f.position.set(0, y as number, -0.07)
    f.add(new Mesh(swallow(), m as Material))
    mast.add(f)
  })

  // ---- Refrigeración/carga: fardos, panel solar, caja y barriles atados
  const cargo = new Group()
  cargo.name = 'part_cooling'
  root.add(cargo)
  const kc = new Kit()
  kc.add(M.sack, box(0.7, 0.5, 0.62), [0.48, DECK + 0.25, -2.55], [0, 0.1, 0])
  kc.add(M.sack, box(0.64, 0.42, 0.58), [0.45, DECK + 0.68, -2.62], [0, -0.15, 0.05])
  kc.add(M.sack, box(0.6, 0.44, 0.56), [0.5, DECK + 0.22, -3.15], [0, 0.2, 0])
  for (const [z, w] of [[-2.55, 0.74], [-2.62, 0.68]] as const) kc.add(M.rope, box(w, 0.06, 0.66), [0.47, DECK + (z === -2.55 ? 0.5 : 0.9), z])
  kc.add(M.rope, box(0.06, 1.0, 0.66), [0.47, DECK + 0.45, -2.58])
  kc.add(M.crate, box(0.62, 0.42, 0.62), [-0.52, DECK + 0.21, -2.75])
  kc.add(M.wood, box(0.64, 0.05, 0.64), [-0.52, DECK + 0.44, -2.75])
  // Panel solar inclinado sobre su caja, con marco y rejilla.
  kc.add(M.crate, box(0.6, 0.35, 0.55), [-0.5, DECK + 0.17, -3.3])
  kc.add(M.steel, box(0.72, 0.05, 0.66), [-0.5, DECK + 0.42, -3.3], [-0.35, 0, 0])
  kc.add(M.solar, box(0.66, 0.03, 0.6), [-0.5, DECK + 0.45, -3.3], [-0.35, 0, 0])
  for (const x of [-0.17, 0, 0.17]) kc.add(M.metal, box(0.015, 0.04, 0.6), [-0.5 + x, DECK + 0.465, -3.29], [-0.35, 0, 0])
  // Barriles a pares por fuera de los costados, atados con cabos.
  for (const side of [-1, 1]) {
    for (const z of [-2.35, -2.98]) {
      const x = side * (prof(z).w + 0.2)
      kc.add(M.wood, cyl(0.24, 0.27, 0.64, 10), [x, 1.12, z])
      for (const y of [0.9, 1.34]) kc.add(M.steel, cyl(0.272, 0.272, 0.04, 10), [x, y, z])
      kc.add(M.rope, cyl(0.272, 0.272, 0.05, 10), [x, 1.12, z])
      const top = gx(z)
      kc.rod(M.rope, [x - side * 0.15, 1.32, z], [side * top.x, top.y + 0.02, z], 0.022, 4)
    }
    const zm = -2.665
    kc.rod(M.rope, [side * (prof(zm).w + 0.45), 1.12, -2.35], [side * (prof(zm).w + 0.45), 1.12, -2.98], 0.025, 4)
  }
  meshesOf(kc, cargo)

  // ---- Motor: turbina, chimenea, engranajes, eje, hélice y aleta
  const eng = new Group()
  eng.name = 'part_engine'
  root.add(eng)
  const ke = new Kit()
  const T = TURBINE
  ke.add(M.gray, cyl(T.r, T.r, T.len, 16), [0, T.y, T.z], X90)
  ke.add(M.metal, cyl(T.r * 0.92, T.r + 0.04, 0.3, 16), [0, T.y, T.z + T.len / 2 + 0.1], X90)
  ke.add(M.dark, cyl(T.r * 0.7, T.r * 0.7, 0.04, 16), [0, T.y, T.z + T.len / 2 + 0.26], X90)
  for (const dz of [-0.4, 0.15]) ke.add(M.steel, cyl(T.r + 0.04, T.r + 0.04, 0.1, 16), [0, T.y, T.z + dz], X90)
  ke.add(M.metal, cyl(T.r, T.r * 0.62, 0.45, 16), [0, T.y, T.z - T.len / 2 - 0.2], X90)
  ke.add(M.dark, cyl(T.r * 0.5, T.r * 0.5, 0.04, 14), [0, T.y, T.z - T.len / 2 - 0.42], X90)
  // Patas de la turbina sobre la cubierta de popa.
  for (const dz of [-0.35, 0.35]) ke.add(M.steel, box(0.9, 0.36, 0.2), [0, topY(0, T.z + dz) + 0.08, T.z + dz])
  // Chimenea: tubo con abrazadera y boca cortada en bisel hacia popa.
  const sx = STACK_TOP.x
  ke.add(M.metal, cyl(0.13, 0.13, 0.75, 10), [sx, T.y + T.r + 0.3, T.z + 0.2])
  ke.add(M.steel, cyl(0.16, 0.16, 0.08, 10), [sx, T.y + T.r + 0.15, T.z + 0.2])
  ke.add(M.metal, cyl(0.16, 0.13, 0.42, 10), [sx, STACK_TOP.y - 0.12, STACK_TOP.z + 0.03], [-0.5, 0, 0])
  ke.add(M.dark, cyl(0.15, 0.15, 0.02, 10), [sx, STACK_TOP.y + 0.08, STACK_TOP.z - 0.06], [-0.5, 0, 0])
  // Eje bajo: góndola con la transmisión y soporte al casco.
  const D = DRIVE
  ke.add(M.gray, cyl(D.r, D.r, D.len, 14), [0, D.y, D.z], X90)
  ke.add(M.metal, cyl(D.r, D.r * 0.45, 0.25, 14), [0, D.y, D.z - D.len / 2 - 0.12], X90)
  ke.add(M.steel, cyl(D.r + 0.03, D.r + 0.03, 0.08, 14), [0, D.y, D.z + 0.1], X90)
  ke.add(M.steel, cyl(0.06, 0.06, 0.5, 8), [0, D.y, PROP.z + 0.2], X90)
  // Puntal entre la turbina y la góndola, y placa de los engranajes.
  ke.add(M.steel, box(0.24, T.y - D.y - 0.4, 0.3), [0, (T.y + D.y) / 2, -5.0])
  ke.add(M.steel, box(0.06, 1.2, 0.62), [GEAR_A.x - 0.08, (GEAR_A.y + GEAR_B.y) / 2, GEAR_A.z])
  for (const [y, z] of [[1.75, -4.75], [1.75, -5.22], [0.7, -4.75], [0.7, -5.22]]) ke.add(M.dark, cyl(0.03, 0.03, 0.06, 6), [GEAR_A.x - 0.04, y, z], Z90)
  // Soportes de la aleta: arriba desde la turbina y abajo desde el eje.
  ke.add(M.steel, box(0.1, 0.12, RUDDER.z - (T.z - T.len / 2 - 0.4) < 0 ? Math.abs(RUDDER.z - (T.z - T.len / 2 - 0.4)) : 0.4), [0, T.y, (RUDDER.z + T.z - T.len / 2 - 0.4) / 2])
  ke.add(M.steel, box(0.1, 0.12, Math.abs(RUDDER.z - (PROP.z - 0.12))), [0, D.y, (RUDDER.z + PROP.z - 0.12) / 2])
  // Cables de la consola al motor (rojo y negro), por el suelo.
  for (const [m, dx] of [[M.cableRed, 0.32], [M.cable, 0.4], [M.cableRed, -0.38]] as const) {
    ke.add(m, tube([
      new Vector3(dx * 0.6, DECK + 0.3, 0.95),
      new Vector3(dx, DECK + 0.03, 0.6),
      new Vector3(dx * 1.3, DECK + 0.03, -0.9),
      new Vector3(dx * 1.1, DECK + 0.03, -2.0),
      new Vector3(dx * 0.4, DECK + 0.05, -3.55),
      new Vector3(dx * 0.3, DECK + 0.55, -3.72),
    ], 0.03, 40, false, 5))
  }
  meshesOf(ke, eng)
  // Engranajes (giran).
  for (const [name, G, teeth] of [['gearA', GEAR_A, 14], ['gearB', GEAR_B, 9]] as const) {
    const gm = new Mesh(gearGeometry(G.r, teeth, 0.1, 0.06), name === 'gearA' ? M.brass : M.steel)
    gm.geometry.rotateY(Math.PI / 2)
    gm.name = name
    gm.position.set(G.x, G.y, G.z)
    eng.add(gm)
  }
  // Brillo de la tobera.
  const glow = new Mesh(cyl(T.r * 0.5, T.r * 0.5, 0.03, 14), M.glow)
  glow.geometry.rotateX(Math.PI / 2)
  glow.name = 'glow'
  glow.position.set(0, T.y, T.z - T.len / 2 - 0.45)
  glow.userData.noOutline = true
  eng.add(glow)
  // Hélice de cuatro aspas anchas.
  const prop = new Group()
  prop.name = 'prop'
  prop.position.set(0, PROP.y, PROP.z)
  eng.add(prop)
  const kp = new Kit()
  kp.add(M.steel, cyl(0.12, 0.14, 0.22, 10), [0, 0, 0], X90)
  kp.add(M.metal, new ConeGeometry(0.12, 0.2, 10), [0, 0, -0.2], [-Math.PI / 2, 0, 0])
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    const dir = a + Math.PI / 2
    const r = PROP.r
    kp.add(M.wood, box(0.3, r - 0.08, 0.05), [Math.cos(dir) * (r / 2 + 0.02), Math.sin(dir) * (r / 2 + 0.02), 0], [0, 0.5, a])
  }
  meshesOf(kp, prop)
  // Aleta de dirección: plancha naranja vertical con muesca y remaches.
  const rudder = new Group()
  rudder.name = 'rudder'
  rudder.position.set(0, 0, RUDDER.z)
  eng.add(rudder)
  const kr = new Kit()
  const fin = new Shape()
  const P: [number, number][] = [[0, -0.25], [0, 2.6], [-0.98, 2.45], [-0.98, 1.2], [-0.6, 1.02], [-0.6, 0.18], [-0.78, -0.02], [-0.72, -0.25]]
  P.forEach(([zz, yy], i) => (i ? fin.lineTo(-zz, yy) : fin.moveTo(-zz, yy)))
  fin.lineTo(-P[0][0], P[0][1])
  const finGeo = new ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false })
  // Forma en (x = hacia popa, y) → plano YZ, con la cuerda hacia -z y vertical.
  finGeo.rotateY(Math.PI / 2)
  finGeo.translate(-0.05, 0, 0)
  kr.add(M.rust, finGeo)
  kr.add(M.steel, cyl(0.07, 0.07, 2.95, 8), [0, 1.17, 0])
  for (const y of [D.y, T.y]) kr.add(M.steel, box(0.2, 0.2, 0.26), [0, y, 0.02])
  for (const [zz, yy] of [[-0.12, 2.45], [-0.85, 2.32], [-0.85, 1.32], [-0.48, 0.9], [-0.48, 0.3], [-0.12, 0.0], [-0.12, 1.3]]) {
    for (const sxx of [-1, 1]) kr.add(M.dark, cyl(0.03, 0.03, 0.03, 6), [sxx * 0.06, yy, zz], Z90)
  }
  meshesOf(kr, rudder)
  // Punto del humo.
  const smoke = new Object3D()
  smoke.name = 'smoke'
  smoke.position.copy(STACK_TOP)
  eng.add(smoke)

  return root
}
