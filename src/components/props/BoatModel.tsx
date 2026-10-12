import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Group,
  type Material,
  type Mesh,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Outlined } from '@/components/common/Outlined'
import { BOAT } from '@/config/boat'
import { PALETTE } from '@/config/palette'
import { MATERIALS, sharedToon, createToonMaterial } from '@/materials/toonMaterials'
import { boat } from '@/systems/boat'
import type { RepairId } from '@/config/repairs'
import {
  deckGeometry,
  deckPaint,
  FIGUREHEAD_CURVE,
  figureheadGeometry,
  figureheadPaint,
  figureheadRadius,
  finRudderGeometry,
  gearGeometry,
  gunwaleAt,
  hullGeometry,
  hullHalfBeam,
  hullNormal,
  hullPaint,
  hullPoint,
  HULL,
  stubWingGeometry,
} from './boatGeometry'
import { Kit } from './boatKit'

type V3 = [number, number, number]
type Parts = Partial<Record<RepairId, true>>

const DECK = BOAT.deck.y
const WHEEL = { y: DECK + 1.2, z: 0.35, r: 0.52 }
/** Mástil algo torcido hacia popa y babor: se nota que lo plantó el robot. */
const MAST = { base: new Vector3(0, DECK, -1.45), tilt: new Euler(-0.07, 0, 0.05), h: 4.5 }
const MAST_TOP = new Vector3(0, MAST.h, 0).applyEuler(MAST.tilt).add(MAST.base)
/** Farol del mástil (donde cuelga el dron), en coordenadas del barco. */
export const LAMP_LOCAL = new Vector3(0, MAST.h - 0.55, 0.9).applyEuler(MAST.tilt).add(MAST.base)
const ENGINE = { y: DECK + 0.95, z: -3.35 }
/** Engranajes en el espejo de popa: corona en la tobera → piñón en el eje de la hélice. */
const GEAR_Z = HULL.stern - 0.15
const RING = { r: 0.86, y: ENGINE.y }
const DRIVE = { r: 0.42, y: ENGINE.y - 0.86 - 0.42 + 0.06 }
const PROP = { y: DRIVE.y, z: HULL.stern - 0.55, r: 0.72 }
const RUDDER = { z: HULL.stern - 1.05 }
const STACK_TOP = new Vector3(-1.3, DECK + 2.3, -2.05)

const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453
  return x - Math.floor(x)
}

/** Posición y orientación sobre la piel del casco (z local = normal hacia fuera). */
function onHull(z: number, v: number, side: number, lift = 0) {
  const n = hullNormal(z, v, side)
  const t = new Vector3(0, 0, 1).addScaledVector(n, -n.z).normalize()
  const y = new Vector3().crossVectors(n, t)
  const m = new Matrix4().makeBasis(t, y, n)
  const pos = hullPoint(z, v, side).addScaledVector(n, lift)
  return { pos, quat: new Quaternion().setFromRotationMatrix(m), n }
}

/** Mallas fundidas de un Kit (una por material). */
function KitMeshes({ kit, shadow = true }: { kit: { material: Material; geometry: BufferGeometry }[]; shadow?: boolean }) {
  return (
    <>
      {kit.map((k, i) => (
        <mesh key={i} geometry={k.geometry} material={k.material} castShadow={shadow} receiveShadow />
      ))}
    </>
  )
}

function useMaterials() {
  return useMemo(() => {
    const paint = hullPaint(PALETTE.shipHull, PALETTE.shipAccent, PALETTE.shipDark)
    const fhPaint = figureheadPaint(PALETTE.shipHull, PALETTE.shipAccent, PALETTE.shipDark)
    const planks = deckPaint()
    planks.repeat.set(0.5, 0.5)
    return {
      hull: createToonMaterial({ map: paint, side: DoubleSide }),
      figurehead: createToonMaterial({ map: fhPaint, flatShading: true }),
      deck: createToonMaterial({ map: planks }),
      light: MATERIALS.shipHull,
      orange: MATERIALS.shipAccent,
      dark: MATERIALS.shipDark,
      shell: sharedToon(PALETTE.shipHull, { side: DoubleSide, flatShading: true }),
      wood: sharedToon('#7c5130', { flatShading: true }),
      plank: sharedToon('#a67a4c', { flatShading: true }),
      metal: sharedToon('#b9c0c8', { flatShading: true }),
      steel: sharedToon('#6f7780', { flatShading: true }),
      brass: sharedToon('#d1a54a', { flatShading: true }),
      rubber: sharedToon('#2f3338', { flatShading: true }),
      rope: sharedToon('#d8c28e'),
      tarp: sharedToon('#7f8c5e', { flatShading: true }),
      canvas: sharedToon('#cdb58a', { flatShading: true }),
      red: sharedToon('#d8452f', { flatShading: true }),
      cableA: sharedToon('#ff7a3d'),
      cableB: sharedToon('#3fa9d6'),
      cableC: sharedToon('#2f3338'),
      glass: sharedToon('#3fb6e8', { emissive: '#3ad0ff', emissiveIntensity: 0.35, side: DoubleSide }),
      gauge: sharedToon('#e9f4f7', { emissive: '#bfe9ff', emissiveIntensity: 0.25 }),
      solar: sharedToon(PALETTE.solarCell, { emissive: '#3b6fd6', emissiveIntensity: 0.15 }),
      pennant: sharedToon('#d9ad8f', { side: DoubleSide }),
    }
  }, [])
}
type Mats = ReturnType<typeof useMaterials>

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d)
const cyl = (rt: number, rb: number, h: number, s = 8) => new CylinderGeometry(rt, rb, h, s)
const X90: V3 = [Math.PI / 2, 0, 0]
const Z90: V3 = [0, 0, Math.PI / 2]

/** Casco, mascarón, alas estabilizadoras, defensas, parches y barandilla de vigas. */
function buildHull(m: Mats) {
  const k = new Kit()
  // Mascarón: el morro cónico de la nave, con collares de placas superpuestas.
  const fh = figureheadGeometry()
  const out = [{ material: m.figurehead as Material, geometry: fh }]
  for (const t of [0.2, 0.38, 0.55, 0.7, 0.82]) k.addMatrix(m.dark, figureheadGeometry(t, t + 0.035, 1.12, 8, 2), new Matrix4())
  // Punta: espiga apuntada.
  const tip = FIGUREHEAD_CURVE.getPointAt(1)
  const tan = FIGUREHEAD_CURVE.getTangentAt(1)
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), tan)
  k.addQuat(m.light, new ConeGeometry(0.1, 0.45, 6), tip.clone().addScaledVector(tan, 0.2), q)
  // Placas de cresta naranjas sobre el lomo.
  for (const t of [0.6, 0.78, 0.93]) {
    const p = FIGUREHEAD_CURVE.getPointAt(t)
    const tn = FIGUREHEAD_CURVE.getTangentAt(t)
    const up = new Vector3().crossVectors(tn, new Vector3(1, 0, 0)).normalize()
    const r = figureheadRadius(t)
    const qq = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tn)
    k.addQuat(m.orange, new ConeGeometry(r * 0.55, r * 1.3, 4), p.clone().addScaledVector(up, r * 1.05), qq.clone().multiply(new Quaternion().setFromEuler(new Euler(-0.9, 0, 0))), [0.35, 1, 1])
  }
  // Remaches en los collares.
  for (const t of [0.2, 0.38, 0.55]) {
    const p = FIGUREHEAD_CURVE.getPointAt(t + 0.017)
    const tn = FIGUREHEAD_CURVE.getTangentAt(t)
    const up = new Vector3().crossVectors(tn, new Vector3(1, 0, 0)).normalize()
    const r = figureheadRadius(t) * 1.12
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const pos = p.clone().addScaledVector(new Vector3(1, 0, 0), Math.cos(a) * r * 0.82).addScaledVector(up, Math.sin(a) * r)
      k.add(m.metal, box(0.05, 0.05, 0.05), pos.toArray() as V3)
    }
  }

  // Defensa de goma a lo largo de la borda (le da grosor al canto).
  for (const side of [-1, 1]) {
    let prev: V3 | null = null
    for (let z = HULL.stern; z <= 4.6; z += 0.4) {
      const p = hullPoint(z, 0.04, side, 0.05).toArray() as V3
      if (prev) k.rod(m.dark, prev, p, 0.075, 6)
      prev = p
    }
  }
  // Parches de chapa remachada sobre el casco.
  const patches: [number, number, number, number, number, Material][] = [
    [-3.4, 0.2, 1, 0.55, 0.36, m.metal],
    [-1.2, 0.33, 1, 0.42, 0.3, m.orange],
    [2.2, 0.18, 1, 0.5, 0.32, m.metal],
    [-2.6, 0.3, -1, 0.5, 0.34, m.metal],
    [0.4, 0.17, -1, 0.46, 0.3, m.steel],
    [2.9, 0.3, -1, 0.36, 0.26, m.orange],
    [-3.9, 0.36, -1, 0.3, 0.3, m.steel],
  ]
  for (const [z, v, side, w, h, mat] of patches) {
    const { pos, quat } = onHull(z, v, side, 0.012)
    k.addQuat(mat, box(w, h, 0.03), pos, quat)
    const mm = new Matrix4().compose(pos, quat, new Vector3(1, 1, 1))
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1]]) {
      const r = new Vector3(sx * (w / 2 - 0.05), sy * (h / 2 - 0.05), 0.025).applyMatrix4(mm)
      k.add(m.steel, box(0.045, 0.045, 0.03), r.toArray() as V3)
    }
  }
  // Alas cortas de la nave como estabilizadores, algo caídas, con punta naranja.
  for (const side of [-1, 1]) {
    const z = -0.55
    const rootX = side * (hullHalfBeam(z) - 0.08)
    const y = BOAT.draft + 0.32
    const rot: V3 = [0, 0, -side * 0.16]
    const span = 1.15
    k.add(m.light, stubWingGeometry(side * span, 1.5, 0.55, 0.75, 0.13), [rootX, y, z], rot)
    // Punta naranja a lo largo del borde exterior.
    const tipX = rootX + side * span * Math.cos(0.16)
    const tipY = y - span * Math.sin(0.16)
    k.add(m.orange, box(0.16, 0.17, 0.62), [tipX, tipY, z - 0.27], rot)
    // Herraje: placa atornillada al casco y tornapuntas hasta la borda.
    k.add(m.steel, box(0.12, 0.34, 0.9), [side * (hullHalfBeam(z) - 0.02), y + 0.05, z], rot)
    for (const dz of [-0.35, 0, 0.35]) k.add(m.metal, box(0.06, 0.06, 0.06), [side * (hullHalfBeam(z) + 0.05), y + 0.12, z + dz])
    k.rod(m.steel, [rootX + side * 0.7, y - 0.02, z - 0.15], [side * (hullHalfBeam(z) * 0.98), gunwaleAt(z) - 0.25, z - 0.15], 0.04, 5)
  }
  // Neumáticos colgados como defensas, con su cabo hasta la borda.
  for (const [z, side] of [[1.1, 1], [-1.9, 1], [0.9, -1], [-2.1, -1]] as const) {
    const { pos, quat } = onHull(z, 0.34, side, 0.09)
    k.addQuat(m.rubber, new TorusGeometry(0.2, 0.08, 6, 10), pos, quat)
    const top = hullPoint(z, 0.0, side, 0.04)
    k.rod(m.rope, [pos.x, pos.y + 0.22, pos.z], top.toArray() as V3, 0.02, 4)
  }
  // Barandilla de vigas recuperadas: grosores y materiales distintos, algo torcidas.
  const railMats = [m.wood, m.steel, m.wood, m.orange, m.metal]
  for (const side of [-1, 1]) {
    const tops: V3[] = []
    let i = 0
    for (let z = -3.85; z <= 1.7; z += 0.93, i++) {
      const s = rnd(i * 7 + side)
      const th = 0.06 + s * 0.05
      const h = 0.56 + rnd(i * 3 + side) * 0.12
      const x = side * (hullHalfBeam(z) * 0.92 - 0.06)
      const y0 = gunwaleAt(z)
      const lean = (rnd(i + side * 11) - 0.5) * 0.14
      k.add(s > 0.5 ? m.wood : m.steel, box(th, h, th), [x + Math.sin(lean) * h * 0.5, y0 + h / 2, z], [0, 0, -lean])
      tops.push([x + Math.sin(lean) * h, y0 + h - 0.03, z])
    }
    for (let j = 0; j < tops.length - 1; j++) {
      const r = 0.035 + rnd(j * 5 + side * 3) * 0.03
      const mat = railMats[(j + (side > 0 ? 0 : 2)) % railMats.length]
      const a = tops[j]
      const b: V3 = [tops[j + 1][0], tops[j + 1][1] + (rnd(j + 40) - 0.5) * 0.06, tops[j + 1][2]]
      k.rod(mat, a, b, r, 4)
      // Algunos tramos llevan un larguero medio más fino.
      if (j % 2 === 0) k.rod(m.wood, [a[0], a[1] - 0.28, a[2]], [b[0], b[1] - 0.3, b[2]], 0.028, 4)
    }
  }
  // Pasamanos de popa, de banda a banda, de tubo naranja.
  const zs = -3.85
  const hb = hullHalfBeam(zs) * 0.92 - 0.06
  k.rod(m.orange, [-hb, gunwaleAt(zs) + 0.6, zs], [hb, gunwaleAt(zs) + 0.62, zs], 0.05, 6)
  // Cabina de la nave (la bañera gris) con su franja naranja.
  k.add(m.shell, new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 1.12, Math.PI / 2 - 1.12), [0, DECK, 1.85], [0, 0, 0], [1.12, 0.95, 1.2])
  k.add(m.orange, new SphereGeometry(1, 14, 2, 0, Math.PI * 2, 1.3, 0.09), [0, DECK, 1.85], [0, 0, 0], [1.14, 0.97, 1.22])
  // Popa reforzada: defensa a lo ancho del espejo y bitas en las esquinas.
  k.add(m.dark, box(hullHalfBeam(HULL.stern) * 1.9, 0.3, 0.2), [0, 1.2, HULL.stern - 0.06])
  k.add(m.orange, box(hullHalfBeam(HULL.stern) * 1.85, 0.1, 0.14), [0, 1.48, HULL.stern - 0.04])
  for (const sx of [-1, 1]) {
    const z = HULL.stern + 0.3
    const p: V3 = [sx * (hullHalfBeam(z) * 0.9 - 0.2), gunwaleAt(z), z]
    k.add(m.steel, cyl(0.1, 0.12, 0.44), [p[0], p[1] + 0.22, p[2]])
    k.add(m.steel, cyl(0.15, 0.15, 0.06), [p[0], p[1] + 0.46, p[2]])
  }
  return [...out, ...k.build()]
}

/** Parabrisas azul recortado, consola con relojes, palancas, engranajes y cableado. */
function buildNavigation(m: Mats) {
  const k = new Kit()
  const C: V3 = [0, DECK, 1.85]
  const S: V3 = [1.13, 0.96, 1.21]
  // Cristal solo delante, cortado arriba para que el robot se asome por encima.
  k.add(m.glass, new SphereGeometry(1, 16, 4, Math.PI / 2 - 1.35, 2.7, 0.74, 0.4), C, [0, 0, 0], S)
  // Marco oscuro sobre el borde del cristal y montantes a los lados.
  k.add(m.dark, new SphereGeometry(1, 16, 1, Math.PI / 2 - 1.38, 2.76, 0.7, 0.06), C, [0, 0, 0], [S[0] * 1.02, S[1] * 1.02, S[2] * 1.02])
  for (const sx of [-1, 1]) {
    const a = Math.PI / 2 + sx * 1.35
    const p0 = new Vector3(-Math.cos(a) * Math.sin(0.72) * S[0], Math.cos(0.72) * S[1], Math.sin(a) * Math.sin(0.72) * S[2]).add(new Vector3(...C))
    const p1 = new Vector3(-Math.cos(a) * Math.sin(1.16) * S[0], Math.cos(1.16) * S[1], Math.sin(a) * Math.sin(1.16) * S[2]).add(new Vector3(...C))
    k.rod(m.dark, p0.toArray() as V3, p1.toArray() as V3, 0.045, 5)
  }
  // Consola: bloque con tapa inclinada, relojes y cableado expuesto.
  const cz = 0.78
  k.add(m.steel, box(0.82, 1.2, 0.42), [0, DECK + 0.6, cz])
  k.add(m.metal, box(0.9, 0.08, 0.5), [0, DECK + 1.22, cz], [0.25, 0, 0])
  k.add(m.orange, box(0.84, 0.1, 0.44), [0, DECK + 0.15, cz])
  // Esferas de medición (domos de cristal) en la cara que mira al robot.
  for (const [x, y, r] of [[-0.25, 0.95, 0.11], [0.26, 0.98, 0.09], [0.27, 0.68, 0.07], [-0.27, 0.66, 0.08]] as const) {
    k.add(m.brass, cyl(r + 0.025, r + 0.025, 0.04, 10), [x, DECK + y, cz - 0.22], X90)
    k.add(m.gauge, new SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), [x, DECK + y, cz - 0.23], [-Math.PI / 2, 0, 0])
    k.add(m.red, box(0.012, r * 0.8, 0.012), [x, DECK + y + r * 0.25, cz - 0.24 - r * 0.6], [0, 0, 0.6 - x])
  }
  // Palancas con pomo a estribor.
  for (const [x, lean, col] of [[0.5, 0.35, m.red], [0.6, -0.2, m.orange], [0.7, 0.1, m.brass]] as const) {
    const base: V3 = [x, DECK + 0.62, cz - 0.05]
    k.add(m.steel, box(0.12, 0.08, 0.16), base)
    const tip: V3 = [x, DECK + 1.08, cz - 0.05 - Math.sin(lean) * 0.45]
    k.rod(m.metal, base, tip, 0.022, 5)
    k.add(col, new IcosahedronGeometry(0.06, 0), tip)
  }
  k.add(m.steel, box(0.36, 0.5, 0.3), [0.6, DECK + 0.32, cz - 0.05])
  // Engranajes a la vista en el costado de babor de la consola.
  k.add(m.brass, gearGeometry(0.2, 10, 0.05, 0.05), [-0.44, DECK + 0.78, cz - 0.02], [0, Math.PI / 2, 0])
  k.add(m.steel, gearGeometry(0.13, 8, 0.05, 0.03), [-0.44, DECK + 0.5, cz + 0.11], [0, Math.PI / 2, 0.2])
  // Eje del timón.
  k.add(m.steel, cyl(0.05, 0.05, cz - 0.21 - WHEEL.z + 0.05, 6), [0, WHEEL.y, (WHEEL.z + cz - 0.21) / 2], X90)
  // Mazo de cables: de la consola, por la cubierta, hasta el motor a popa.
  const cables: [Material, number][] = [[m.cableA, 0], [m.cableB, 0.07], [m.cableC, -0.07]]
  for (const [mat, dx] of cables) {
    const curve = new CatmullRomCurve3([
      new Vector3(-0.3 + dx, DECK + 0.35, cz - 0.2),
      new Vector3(-0.42 + dx, DECK + 0.05, cz - 0.55),
      new Vector3(-0.55 + dx, DECK + 0.04, -0.6),
      new Vector3(-0.5 + dx, DECK + 0.04, -1.9),
      new Vector3(-0.45 + dx, DECK + 0.12, -2.3),
      new Vector3(-0.42 + dx, ENGINE.y - 0.3, ENGINE.z + 0.85),
    ])
    k.add(mat, new TubeGeometry(curve, 24, 0.028, 5, false))
  }
  // Grapas que sujetan el mazo a la cubierta.
  for (const z of [-0.2, -1.2, -1.95]) k.add(m.steel, box(0.3, 0.05, 0.06), [-0.52, DECK + 0.05, z])
  return k.build()
}

/** Timón grande de madera con cabillas de agarre y cubo de latón (gira entero). */
function buildWheel(m: Mats) {
  const k = new Kit()
  k.add(m.wood, new TorusGeometry(WHEEL.r, 0.055, 6, 18))
  k.add(m.brass, new TorusGeometry(WHEEL.r - 0.07, 0.025, 4, 18))
  k.add(m.brass, cyl(0.12, 0.12, 0.14, 10), [0, 0, 0], X90)
  k.add(m.orange, cyl(0.06, 0.06, 0.18, 8), [0, 0, 0], X90)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    k.add(m.wood, box(WHEEL.r, 0.05, 0.05), [Math.cos(a) * WHEEL.r * 0.5, Math.sin(a) * WHEEL.r * 0.5, 0], [0, 0, a])
    // Cabilla que sobresale del aro.
    k.add(m.wood, cyl(0.035, 0.05, 0.2, 6), [Math.cos(a) * (WHEEL.r + 0.1), Math.sin(a) * (WHEEL.r + 0.1), 0], [0, 0, a - Math.PI / 2])
  }
  return k.build()
}

/** Vientos del mástil al casco y antenas de la nave junto a la cabina. */
function buildComms(m: Mats) {
  const k = new Kit()
  const top = MAST_TOP.toArray() as V3
  for (const [z, side] of [[2.0, -1], [2.0, 1], [-3.7, -1], [-3.7, 1]] as const) {
    const p: V3 = [side * hullHalfBeam(z) * 0.9, gunwaleAt(z) + 0.05, z]
    k.rod(m.cableC, [top[0], top[1] - 0.25, top[2]], p, 0.014, 3)
    k.add(m.steel, box(0.08, 0.1, 0.12), p)
  }
  for (const [x, h] of [[0.98, 1.7], [-0.92, 1.35]] as const) {
    k.add(m.steel, cyl(0.018, 0.03, h, 4), [x, DECK + 0.4 + h / 2, 0.7])
    k.add(m.steel, box(0.12, 0.12, 0.12), [x, DECK + 0.42, 0.7])
  }
  return k.build()
}

/** Mástil (dentro del grupo inclinado): palo remendado, brazo del farol y base. */
function buildMast(m: Mats) {
  const k = new Kit()
  k.add(m.wood, cyl(0.07, 0.11, MAST.h, 6), [0, MAST.h / 2, 0])
  for (const y of [0.6, 1.9, 3.3]) k.add(m.steel, cyl(0.12, 0.12, 0.1, 6), [0, y, 0])
  k.add(m.plank, box(0.08, 0.9, 0.06), [0.1, 2.5, 0])
  k.add(m.rope, cyl(0.12, 0.12, 0.05, 6), [0, 2.25, 0])
  k.add(m.rope, cyl(0.12, 0.12, 0.05, 6), [0, 2.75, 0])
  k.add(m.wood, cyl(0.045, 0.045, 1.0, 5), [0, MAST.h - 0.15, 0.45], X90)
  k.add(m.steel, cyl(0.015, 0.015, 0.3, 4), [0, MAST.h - 0.3, 0.9])
  k.add(m.steel, box(0.4, 0.12, 0.4), [0, 0.06, 0])
  return k.build()
}

/** Carga de exploración: fardo con lona, caja de herramientas, barriles y toldo solar sobre el motor. */
function buildCargo(m: Mats) {
  const k = new Kit()
  const bx = -0.95
  const bz = -1.05
  k.add(m.canvas, box(0.6, 0.5, 0.9), [bx, DECK + 0.25, bz])
  k.add(m.tarp, box(0.72, 0.18, 1.0), [bx, DECK + 0.55, bz], [0, 0.05, 0.04])
  k.add(m.tarp, box(0.7, 0.4, 0.06), [bx, DECK + 0.36, bz + 0.5], [0.12, 0.05, 0])
  for (const dz of [-0.3, 0.25]) k.add(m.rope, box(0.76, 0.7, 0.04), [bx, DECK + 0.33, bz + dz])
  // Caja de herramientas roja y una caja de la nave con cuerda a estribor.
  k.add(m.red, box(0.5, 0.3, 0.3), [0.95, DECK + 0.15, -0.85])
  k.add(m.steel, box(0.36, 0.05, 0.05), [0.95, DECK + 0.38, -0.85])
  k.add(m.steel, box(0.04, 0.1, 0.04), [0.79, DECK + 0.33, -0.85])
  k.add(m.steel, box(0.04, 0.1, 0.04), [1.11, DECK + 0.33, -0.85])
  k.add(m.metal, box(0.62, 0.55, 0.6), [0.95, DECK + 0.28, -1.65], [0, 0.15, 0])
  k.add(m.orange, box(0.64, 0.08, 0.62), [0.95, DECK + 0.45, -1.65], [0, 0.15, 0])
  k.add(m.rope, box(0.05, 0.6, 0.66), [0.95, DECK + 0.3, -1.65], [0, 0.15, 0])
  // Barril en cubierta.
  k.add(m.wood, cyl(0.24, 0.27, 0.6, 8), [-0.95, DECK + 0.3, -1.95])
  for (const y of [0.12, 0.48]) k.add(m.steel, cyl(0.275, 0.275, 0.04, 8), [-0.95, DECK + y, -1.95])
  // Barriles atados por fuera del casco, con aros y cabos.
  for (const side of [-1, 1]) {
    const z = -2.75
    const { pos } = onHull(z, 0.22, side, 0.27)
    k.add(m.wood, cyl(0.25, 0.25, 0.72, 8), pos.toArray() as V3, X90)
    for (const dz of [-0.24, 0.24]) {
      k.add(m.steel, cyl(0.265, 0.265, 0.04, 8), [pos.x, pos.y, pos.z + dz], X90)
      const top = hullPoint(z + dz, 0.0, side, 0.04)
      k.rod(m.rope, [pos.x, pos.y + 0.25, pos.z + dz], top.toArray() as V3, 0.022, 4)
      k.rod(m.rope, [pos.x + side * 0.25, pos.y, pos.z + dz], [pos.x, pos.y + 0.26, pos.z + dz], 0.022, 4)
    }
  }
  // Toldo solar: estructura de vigas sobre el motor con el panel como techo.
  const roofY = DECK + 2.1
  const posts: V3[] = [[-0.95, 0, -2.55], [0.95, 0, -2.55], [-0.95, 0, -3.95], [0.95, 0, -3.95]]
  posts.forEach(([x, , z], i) => {
    const yTop = roofY + (z > -3 ? 0.18 : 0) - 0.04
    k.rod(i % 2 ? m.steel : m.wood, [x, DECK, z], [x, yTop, z], 0.05, 5)
  })
  for (const x of [-0.95, 0.95]) k.rod(m.steel, [x, DECK + 0.3, -2.55], [x, roofY - 0.1, -3.95], 0.025, 4)
  const tilt = Math.atan2(0.18, 1.4)
  k.add(m.steel, box(2.05, 0.08, 1.55), [0, roofY + 0.09, -3.25], [-tilt, 0, 0])
  k.add(m.solar, box(1.9, 0.05, 1.4), [0, roofY + 0.15, -3.25], [-tilt, 0, 0])
  for (const x of [-0.32, 0.32]) k.add(m.metal, box(0.03, 0.06, 1.42), [x, roofY + 0.17, -3.25], [-tilt, 0, 0])
  return k.build()
}

/** Motor híbrido: turbina de la nave sobre bancada, chimenea remendada y soportes del timón. */
function buildEngine(m: Mats) {
  const k = new Kit()
  const E: V3 = [0, ENGINE.y, ENGINE.z]
  const at = (x: number, y: number, z: number): V3 => [E[0] + x, E[1] + y, E[2] + z]
  // Bancada y calzos.
  k.add(m.steel, box(1.5, 0.26, 1.6), [0, DECK + 0.13, ENGINE.z])
  for (const dz of [-0.45, 0.45]) k.add(m.wood, box(1.2, 0.3, 0.26), at(0, -0.62, dz))
  // Turbina: toma de aire con rejilla, cuerpo con costillas y tobera.
  k.add(m.metal, cyl(0.6, 0.72, 0.36, 12), at(0, 0, 0.82), X90)
  k.add(m.dark, cyl(0.46, 0.46, 0.04, 12), at(0, 0, 1.01), X90)
  for (let i = 0; i < 4; i++) k.add(m.steel, box(0.9, 0.05, 0.04), at(0, 0, 1.02), [0, 0, (i * Math.PI) / 4])
  k.add(m.light, cyl(0.74, 0.74, 1.3, 12), E, X90)
  for (const dz of [-0.45, 0.45]) k.add(m.orange, cyl(0.78, 0.78, 0.1, 12), at(0, 0, dz), X90)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.add(m.steel, box(0.08, 0.08, 0.8), at(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0), [0, 0, a])
  }
  // Parches remachados en el cuerpo.
  for (const [a, dz] of [[0.6, 0.15], [2.4, -0.2], [-0.9, 0.05]] as const) {
    const pos = at(Math.cos(a) * 0.76, Math.sin(a) * 0.76, dz)
    k.add(m.metal, box(0.04, 0.32, 0.3), pos, [0, 0, a])
    for (const dd of [-0.11, 0.11]) k.add(m.dark, box(0.05, 0.05, 0.05), [pos[0] + Math.cos(a) * 0.03, pos[1] + Math.sin(a) * 0.03 + dd, pos[2] + dd * 0.8])
  }
  k.add(m.dark, cyl(0.74, 0.56, 0.5, 12), at(0, 0, -0.9), X90)
  // Tuberías del refrigerante a los lados.
  for (const side of [-1, 1]) {
    k.add(m.cableB, new TorusGeometry(0.45, 0.05, 5, 10, Math.PI), at(side * 0.8, 0.1, 0), [0, Math.PI / 2, 0])
  }
  // Chimenea doblada y remendada: tramos con codos, abrazaderas y un parche.
  const pts: V3[] = [
    [-1.05, DECK, -2.15],
    [-1.05, DECK + 1.0, -2.15],
    [-1.25, DECK + 1.55, -2.0],
    [-1.3, DECK + 2.05, -2.05],
  ]
  for (let i = 0; i < pts.length - 1; i++) {
    k.rod(m.metal, pts[i], pts[i + 1], 0.13 - i * 0.01, 8)
    if (i > 0) k.add(m.steel, new SphereGeometry(0.14, 8, 5), pts[i])
    k.add(m.steel, cyl(0.17, 0.17, 0.08, 8), pts[i + 1])
  }
  k.add(m.orange, box(0.06, 0.34, 0.24), [-0.93, DECK + 0.55, -2.15])
  k.add(m.dark, cyl(0.19, 0.15, 0.26, 8), STACK_TOP.toArray() as V3)
  k.add(m.steel, cyl(0.24, 0.24, 0.03, 8), [STACK_TOP.x, STACK_TOP.y + 0.24, STACK_TOP.z - 0.06], [-0.35, 0, 0])
  k.rod(m.steel, [STACK_TOP.x, STACK_TOP.y + 0.12, STACK_TOP.z + 0.15], [STACK_TOP.x, STACK_TOP.y + 0.3, STACK_TOP.z + 0.1], 0.015, 3)
  // Placa de los engranajes atornillada al espejo y ejes.
  k.add(m.steel, box(0.5, 1.1, 0.06), [0, DRIVE.y + 0.25, HULL.stern - 0.06])
  k.add(m.metal, cyl(0.08, 0.08, 0.3, 6), [0, DRIVE.y, GEAR_Z], X90)
  for (const y of [DRIVE.y + 0.7, DRIVE.y - 0.2]) for (const x of [-0.19, 0.19]) k.add(m.dark, box(0.06, 0.06, 0.06), [x, y, HULL.stern - 0.1])
  // Eje de la hélice.
  k.add(m.steel, cyl(0.06, 0.06, Math.abs(PROP.z - GEAR_Z), 6), [0, PROP.y, (PROP.z + GEAR_Z) / 2], X90)
  // Soportes del timón: dos pletinas desde el espejo hasta la caña, y un talón bajo el agua.
  for (const sx of [-1, 1]) {
    k.rod(m.steel, [sx * 0.95, 1.6, HULL.stern], [sx * 0.09, 1.6, RUDDER.z], 0.05, 5)
    k.add(m.dark, box(0.12, 0.12, 0.08), [sx * 0.95, 1.6, HULL.stern - 0.02])
  }
  k.add(m.steel, box(0.1, 0.08, Math.abs(RUDDER.z - (HULL.stern + 0.2))), [0, -0.32, (RUDDER.z + HULL.stern + 0.2) / 2])
  return k.build()
}

/** Hélice de aspas anchas de tablón con puntas de chapa (gira entera). */
function buildProp(m: Mats) {
  const k = new Kit()
  k.add(m.steel, cyl(0.12, 0.14, 0.22, 8), [0, 0, 0], X90)
  k.add(m.orange, new ConeGeometry(0.12, 0.22, 8), [0, 0, -0.22], [-Math.PI / 2, 0, 0])
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3
    const r = PROP.r
    const dir = a + Math.PI / 2
    k.add(m.wood, box(0.36, r - 0.1, 0.06), [Math.cos(dir) * (r / 2), Math.sin(dir) * (r / 2), 0], [0, 0.45, a])
    k.add(m.metal, box(0.38, 0.12, 0.07), [Math.cos(dir) * (r - 0.06), Math.sin(dir) * (r - 0.06), 0], [0, 0.45, a])
  }
  return k.build()
}

/** Timón de popa: una deriva de la nave en un eje con pernos y cordones de soldadura. */
function buildRudder(m: Mats) {
  const k = new Kit()
  k.add(m.steel, cyl(0.065, 0.065, 1.95, 6), [0, 0.65, 0])
  k.add(m.orange, finRudderGeometry(1.45, 0.75, 0.12), [0, -0.25, -0.06])
  k.add(m.metal, box(0.14, 1.45, 0.14), [0, 0.475, -0.08])
  for (const y of [-0.05, 0.55, 1.05]) {
    k.add(m.steel, box(0.16, 0.18, 0.4), [0, y, -0.18])
    for (const dz of [-0.06, -0.3]) for (const sx of [-1, 1]) k.add(m.dark, cyl(0.03, 0.03, 0.04, 6), [sx * 0.09, y, dz], Z90)
    k.add(m.dark, box(0.18, 0.03, 0.42), [0, y + 0.1, -0.18])
  }
  k.add(m.steel, cyl(0.1, 0.1, 0.14, 8), [0, 1.6, 0])
  k.add(m.wood, box(0.07, 0.07, 0.55), [0, 1.7, 0.25])
  return k.build()
}

/**
 * El barco: la nave convertida en un barquito de aventura. Casco gordito de
 * chapa gris y naranja con parches; el morro de la nave como mascarón alto y
 * rizado con tribales; alas cortas de estabilizadores; cabina con parabrisas
 * recortado, timón grande y cacharros; turbina con engranajes que mueven una
 * hélice ancha; mástil torcido con el dron de farol; carga y toldo solar.
 * En el astillero (`parts`) solo se ve lo ya reparado.
 */
export function BoatModel({ afloat = false, parts }: { afloat?: boolean; parts?: Parts }) {
  const has = (afloat ? { hull: true, comms: true, navigation: true, cooling: true, engine: true } : parts ?? {}) as Parts
  const m = useMaterials()
  const kits = useMemo(() => {
    const raw = hullGeometry()
    raw.deleteAttribute('normal')
    const smooth = mergeVertices(raw)
    smooth.computeVertexNormals()
    return {
      hull: smooth,
      deck: deckGeometry(DECK, 0.1, 4.0),
      shell: buildHull(m),
      navigation: buildNavigation(m),
      wheel: buildWheel(m),
      comms: buildComms(m),
      mast: buildMast(m),
      cargo: buildCargo(m),
      engine: buildEngine(m),
      prop: buildProp(m),
      rudder: buildRudder(m),
      ring: gearGeometry(RING.r, 20, 0.12, 0.66),
      drive: gearGeometry(DRIVE.r, 12, 0.12, 0.05),
      flag: new BoxGeometry(0.62, 0.3, 0.01),
      pennant: pennantGeometry(),
    }
  }, [m])
  const glow = useMemo(() => sharedToon('#7fe3ff', { emissive: '#3ad0ff', emissiveIntensity: 1.3 }), [])
  const ledOn = useMemo(() => [sharedToon('#ff5a4a', { emissive: '#ff3a2a', emissiveIntensity: 2 }), sharedToon('#7dff8a', { emissive: '#3dff5a', emissiveIntensity: 2 })], [])

  const wheel = useRef<Group>(null)
  const rudder = useRef<Group>(null)
  const prop = useRef<Group>(null)
  const gears = useRef<(Mesh | null)[]>([])
  const flags = useRef<(Group | null)[]>([])
  const pennant = useRef<Group>(null)
  const leds = useRef<(Mesh | null)[]>([])
  const glowRef = useRef<Mesh>(null)
  const spin = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    if (wheel.current) wheel.current.rotation.z = -boat.rudder * 2.2
    if (rudder.current) rudder.current.rotation.y = -boat.rudder * 0.55
    // La turbina gira al ralentí; con marcha, más rápido. Los engranajes engranan.
    spin.current += dt * (0.8 + boat.speed * 0.45)
    const s = spin.current
    if (prop.current) prop.current.rotation.z = -s * (RING.r / DRIVE.r)
    const g = gears.current
    if (g[0]) g[0].rotation.z = s
    if (g[1]) g[1].rotation.z = -s * (RING.r / DRIVE.r) + 0.3
    flags.current.forEach((f, i) => {
      if (f) f.rotation.y = Math.sin(t * (6 + i) + i) * 0.25 + Math.min(0.5, boat.speed * 0.03)
    })
    if (pennant.current) {
      pennant.current.rotation.y = Math.sin(t * 4.3) * 0.35 + Math.min(0.6, boat.speed * 0.04)
      pennant.current.rotation.x = Math.sin(t * 7.1) * 0.08
    }
    leds.current.forEach((l, i) => {
      if (l) l.visible = Math.sin(t * 3 + i * 2.2) > 0
    })
    if (glowRef.current) glowRef.current.scale.setScalar(0.9 + Math.sin(t * 3) * 0.08 + Math.min(0.2, boat.speed * 0.02))
  })

  return (
    <group>
      <Outlined thickness={0.035}>
        <group>
          <mesh geometry={kits.hull} material={m.hull} castShadow receiveShadow />
          <mesh geometry={kits.deck} material={m.deck} receiveShadow />
          <KitMeshes kit={kits.shell} />
          {has.navigation && (
            <>
              <KitMeshes kit={kits.navigation} />
              <group ref={wheel} position={[0, WHEEL.y, WHEEL.z]}>
                <KitMeshes kit={kits.wheel} />
              </group>
            </>
          )}
          {has.comms && (
            <>
              <KitMeshes kit={kits.comms} shadow={false} />
              <group position={MAST.base} rotation={MAST.tilt}>
                <KitMeshes kit={kits.mast} />
                {[
                  { y: MAST.h - 0.8, c: PALETTE.shipAccent },
                  { y: MAST.h - 1.3, c: '#f2a23a' },
                  { y: MAST.h - 1.8, c: '#2f5fb3' },
                ].map((f, i) => (
                  <group key={i} position={[0, f.y, -0.06]} ref={(gr) => { flags.current[i] = gr }}>
                    <mesh geometry={kits.flag} material={sharedToon(f.c, { side: DoubleSide })} position-z={-0.32} rotation-y={Math.PI / 2} />
                  </group>
                ))}
                {/* Banderín desgastado en la punta */}
                <group ref={pennant} position={[0, MAST.h + 0.02, 0]}>
                  <mesh geometry={kits.pennant} material={m.pennant} />
                </group>
                <mesh material={m.steel} position-y={MAST.h + 0.08}>
                  <sphereGeometry args={[0.09, 6, 4]} />
                </mesh>
              </group>
              {/* LED de las antenas */}
              {([[0.98, 1.7], [-0.92, 1.35]] as const).map(([x, h], i) => (
                <mesh key={i} ref={(me) => { leds.current[i] = me }} material={ledOn[i]} position={[x, DECK + 0.4 + h + 0.04, 0.7]} userData={{ noOutline: true }}>
                  <icosahedronGeometry args={[0.07, 0]} />
                </mesh>
              ))}
            </>
          )}
          {has.cooling && <KitMeshes kit={kits.cargo} />}
          {has.engine && (
            <>
              <KitMeshes kit={kits.engine} />
              <mesh ref={(me) => { gears.current[0] = me }} geometry={kits.ring} material={m.brass} position={[0, RING.y, GEAR_Z]} />
              <mesh ref={(me) => { gears.current[1] = me }} geometry={kits.drive} material={m.steel} position={[0, DRIVE.y, GEAR_Z]} />
              <group ref={prop} position={[0, PROP.y, PROP.z]}>
                <KitMeshes kit={kits.prop} />
              </group>
              <group ref={rudder} position={[0, 0, RUDDER.z]}>
                <KitMeshes kit={kits.rudder} />
              </group>
            </>
          )}
        </group>
      </Outlined>
      {has.engine && (
        <>
          <mesh ref={glowRef} material={glow} position={[0, ENGINE.y, ENGINE.z - 1.16]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 12]} />
          </mesh>
          <StackSmoke />
        </>
      )}
    </group>
  )
}

/** Banderín largo y triangular: sale del tope del mástil hacia popa. */
function pennantGeometry(): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = 0.5 - z // 0 en el mástil, 1 en la punta
    pos.setXYZ(i, x * 0.01, y * 0.26 * (1 - k) - 0.13 * k, -k * 1.2)
  }
  g.computeVertexNormals()
  return g
}

const PUFFS = 14

/** Humo de la chimenea en ráfagas: tres bocanadas seguidas y una pausa. */
function StackSmoke() {
  const ref = useRef<InstancedMesh>(null)
  const { mat, puffs, dummy } = useMemo(
    () => ({
      mat: new MeshBasicMaterial({ color: '#d9dde2', transparent: true, opacity: 0.4, depthWrite: false }),
      puffs: Array.from({ length: PUFFS }, () => ({ age: 99, x: 0, z: 0 })),
      dummy: new Object3D(),
    }),
    [],
  )
  const timer = useRef({ next: 0, burst: 0 })
  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const tm = timer.current
    tm.next -= dt
    if (tm.next <= 0) {
      const free = puffs.reduce((a, b) => (b.age > a.age ? b : a))
      free.age = 0
      free.x = 0
      free.z = 0
      tm.burst++
      // Ráfaga de 3, luego pausa (más corta con marcha).
      tm.next = tm.burst % 3 === 0 ? Math.max(0.6, 1.8 - boat.speed * 0.1) : 0.14
    }
    puffs.forEach((p, i) => {
      p.age += dt
      const k = p.age / 2.2
      if (k < 1) {
        p.z -= dt * (0.25 + boat.speed * 0.7)
        p.x += dt * 0.12
        dummy.position.set(STACK_TOP.x + p.x, STACK_TOP.y + 0.3 + k * 1.4, STACK_TOP.z + p.z)
        dummy.scale.setScalar((0.1 + k * 0.3) * (k < 0.15 ? k / 0.15 : 1))
      } else dummy.scale.setScalar(0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, mat, PUFFS]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}
