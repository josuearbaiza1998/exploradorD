import {
  BoxGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix4,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { deadBushGeometry, deadTreeGeometry, mesaGeometry, slabRockGeometry } from './desertGeometry'

/**
 * Geometrías lowpoly temporales. Todas con el pivote en la base (y = 0)
 * para que se apoyen sobre el terreno igual que lo hará un .glb bien exportado.
 */

const baseAligned = (g: BufferGeometry, height: number) => g.translate(0, height / 2, 0)

function nonIndexed(g: BufferGeometry) {
  return g.index ? g.toNonIndexed() : g
}

export const palmTrunkGeometry = (() => {
  // Tronco ligeramente curvado: 3 segmentos que se inclinan.
  const parts: BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const seg = baseAligned(new CylinderGeometry(0.28 - i * 0.05, 0.34 - i * 0.05, 2.6, 6), 2.6)
    seg.applyMatrix4(new Matrix4().makeRotationZ(0.08 * i))
    seg.translate(i * 0.25, i * 2.45, 0)
    parts.push(nonIndexed(seg))
  }
  return mergeGeometries(parts)
})()

export const palmCrownGeometry = (() => {
  const parts: BufferGeometry[] = []
  const leaves = 7
  for (let i = 0; i < leaves; i++) {
    const leaf = new BoxGeometry(0.9, 0.08, 3.4)
    leaf.translate(0, 0, 1.7)
    leaf.applyMatrix4(new Matrix4().makeRotationX(0.45))
    leaf.applyMatrix4(new Matrix4().makeRotationY((i / leaves) * Math.PI * 2))
    parts.push(nonIndexed(leaf))
  }
  const crown = mergeGeometries(parts)
  return crown.translate(0.65, 7.4, 0)
})()

export const cactusGeometry = (() => {
  const body = baseAligned(new CylinderGeometry(0.32, 0.38, 2.6, 6), 2.6)
  const armA = baseAligned(new CylinderGeometry(0.18, 0.2, 1.0, 5), 1.0).translate(0.55, 1.2, 0)
  const armB = baseAligned(new CylinderGeometry(0.16, 0.18, 0.8, 5), 0.8).translate(-0.5, 1.5, 0)
  const joinA = new BoxGeometry(0.5, 0.25, 0.25).translate(0.3, 1.25, 0)
  const joinB = new BoxGeometry(0.45, 0.22, 0.22).translate(-0.27, 1.55, 0)
  return mergeGeometries([body, armA, armB, joinA, joinB].map(nonIndexed))
})()

/** Roca de arenisca en capas (dos tonos alternos). Huella ~2 × 1.6 m, alto ~1.3 m. */
export const rockGeometry = slabRockGeometry(5, 3, 2.1, 1.3)

/** Mesa de arenisca: hito grande, no recolectable. */
export const mesaRockGeometry = mesaGeometry()

/** Arbusto seco de varas (recolectable a mano). */
export const shrubGeometry = deadBushGeometry()

/** Matojo verde y redondo del oasis. */
export const oasisShrubGeometry = (() => {
  const g = nonIndexed(new IcosahedronGeometry(0.7, 0))
  g.scale(1.2, 0.7, 1.2)
  return g.translate(0, 0.35, 0)
})()

/** Árbol seco pequeño: el robot lo puede romper sin herramientas. */
const deadTree = deadTreeGeometry()
export const smallTreeGeometry = { trunk: deadTree.trunk, crown: deadTree.branches }
