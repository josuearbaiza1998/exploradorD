import { BoxGeometry, CylinderGeometry, DodecahedronGeometry, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createRng } from './random'

/**
 * Geometrías del desierto inspiradas en el concept: ramas secas retorcidas y
 * rocas de arenisca en capas. Pivote en la base (y = 0), deterministas.
 */

const UP = new Vector3(0, 1, 0)
const flat = (g: BufferGeometry) => (g.index ? g.toNonIndexed() : g)

/** Rama cónica de `a` a `b` (5 lados: lowpoly y barata). */
function branch(a: Vector3, b: Vector3, r0: number, r1: number): BufferGeometry {
  const dir = new Vector3().subVectors(b, a)
  const len = dir.length()
  const g = new CylinderGeometry(r1, r0, len, 5, 1).translate(0, len / 2, 0)
  g.applyMatrix4(new Matrix4().compose(a, new Quaternion().setFromUnitVectors(UP, dir.normalize()), new Vector3(1, 1, 1)))
  return flat(g)
}

/** Dirección inclinada `tilt` rad respecto a `base`, girada `yaw`. */
function bend(base: Vector3, tilt: number, yaw: number): Vector3 {
  const side = new Vector3(Math.cos(yaw), 0, Math.sin(yaw))
  return base.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(side, Math.sin(tilt)).normalize()
}

/** Ramifica recursivamente: cada rama abre 2-3 hijas más cortas y finas. */
function grow(out: BufferGeometry[], rng: () => number, from: Vector3, dir: Vector3, len: number, r: number, depth: number) {
  const to = from.clone().addScaledVector(dir, len)
  out.push(branch(from, to, r, r * 0.62))
  if (depth === 0) return
  const kids = 2 + (rng() < 0.4 ? 1 : 0)
  for (let k = 0; k < kids; k++) {
    const d = bend(dir, 0.45 + rng() * 0.5, rng() * Math.PI * 2)
    // Las ramas secas tienden a abrirse y "caer" un poco.
    d.y = Math.max(0.05, d.y - 0.1)
    grow(out, rng, to, d.normalize(), len * (0.55 + rng() * 0.2), r * 0.62, depth - 1)
  }
}

/** Arbusto seco: varas que salen del suelo en abanico y se ramifican. */
export function deadBushGeometry(seed = 11): BufferGeometry {
  const rng = createRng(seed)
  const parts: BufferGeometry[] = []
  const stems = 7
  for (let i = 0; i < stems; i++) {
    const yaw = (i / stems) * Math.PI * 2 + rng() * 0.5
    const dir = bend(UP, 0.35 + rng() * 0.55, yaw)
    const start = new Vector3(Math.cos(yaw) * 0.08, 0, Math.sin(yaw) * 0.08)
    grow(parts, rng, start, dir, 0.45 + rng() * 0.25, 0.05, 2)
  }
  return mergeGeometries(parts)
}

/** Árbol seco: tronco nudoso que se bifurca en ramas retorcidas. */
export function deadTreeGeometry(seed = 23): { trunk: BufferGeometry; branches: BufferGeometry } {
  const rng = createRng(seed)
  // Tronco en tres tramos con ligera curva.
  const trunk: BufferGeometry[] = []
  const pts = [new Vector3(0, 0, 0), new Vector3(0.08, 0.7, 0.02), new Vector3(-0.05, 1.3, 0.06), new Vector3(0.1, 1.75, 0)]
  const radii = [0.19, 0.15, 0.12, 0.1]
  for (let i = 0; i < pts.length - 1; i++) trunk.push(branch(pts[i], pts[i + 1], radii[i], radii[i + 1]))
  const branches: BufferGeometry[] = []
  const top = pts[pts.length - 1]
  const limbs = 4
  for (let i = 0; i < limbs; i++) {
    const dir = bend(UP, 0.5 + rng() * 0.45, (i / limbs) * Math.PI * 2 + rng() * 0.6)
    // Algunas ramas salen más abajo del tronco.
    const from = i === 0 ? pts[2].clone() : top.clone()
    grow(branches, rng, from, dir, 0.75 + rng() * 0.3, 0.09, 2)
  }
  return { trunk: mergeGeometries(trunk), branches: mergeGeometries(branches) }
}

/**
 * Roca de arenisca en capas: losas apiladas algo desplazadas. Devuelve las
 * capas pares e impares por separado para pintarlas con dos tonos (bandas).
 */
export function slabRockGeometry(seed: number, layers: number, width: number, height: number, taper = 0.45): [BufferGeometry, BufferGeometry] {
  const rng = createRng(seed)
  const even: BufferGeometry[] = []
  const odd: BufferGeometry[] = []
  const h = height / layers
  let y = 0
  for (let i = 0; i < layers; i++) {
    const t = i / layers
    // Se estrecha hacia arriba y cada losa se gira/desplaza un poco.
    const w = width * (1 - t * taper) * (0.9 + rng() * 0.2)
    const d = width * 0.8 * (1 - t * taper * 0.9) * (0.85 + rng() * 0.25)
    const thick = h * (0.75 + rng() * 0.5)
    const slab = rng() < 0.5 ? new BoxGeometry(w, thick, d) : new DodecahedronGeometry(0.5, 0).scale(w, thick, d)
    slab.rotateY((rng() - 0.5) * 0.6)
    slab.translate((rng() - 0.5) * width * 0.12, y + thick / 2, (rng() - 0.5) * width * 0.12)
    ;(i % 2 === 0 ? even : odd).push(flat(slab))
    y += thick * 0.92
  }
  if (odd.length === 0) odd.push(flat(new BoxGeometry(0.001, 0.001, 0.001)))
  return [mergeGeometries(even), mergeGeometries(odd)]
}

/** Mesa: columna ancha de arenisca con cima plana y repisas (hito lejano). */
export function mesaGeometry(): [BufferGeometry, BufferGeometry] {
  const [a, b] = slabRockGeometry(77, 6, 9, 7, 0.22)
  // Repisas sueltas al pie, como en el concept.
  const [c, d] = slabRockGeometry(91, 3, 3.2, 1.6)
  c.translate(5, 0, 2)
  d.translate(5, 0, 2)
  const [e, f] = slabRockGeometry(53, 2, 2.4, 0.9)
  e.translate(-4.4, 0, -3)
  f.translate(-4.4, 0, -3)
  return [mergeGeometries([a, c, e]), mergeGeometries([b, d, f])]
}
