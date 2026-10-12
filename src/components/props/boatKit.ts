import { BufferGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3, type Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type V3 = [number, number, number]

/**
 * Juntador de piezas estáticas: cada pieza se coloca con su transformación y
 * al final se funden en una sola malla por material. Así el barco puede tener
 * remaches, parches, cuerdas y engranajes sin cientos de mallas (y de
 * contornos) que pesen en el móvil.
 */
export class Kit {
  private parts = new Map<Material, BufferGeometry[]>()
  private m = new Matrix4()
  private q = new Quaternion()
  private e = new Euler()
  private s = new Vector3()
  private p = new Vector3()

  add(mat: Material, geo: BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: number | V3 = 1, order: 'XYZ' | 'YXZ' = 'XYZ') {
    this.e.set(rot[0], rot[1], rot[2], order)
    this.q.setFromEuler(this.e)
    if (typeof scale === 'number') this.s.setScalar(scale)
    else this.s.set(scale[0], scale[1], scale[2])
    this.m.compose(this.p.set(pos[0], pos[1], pos[2]), this.q, this.s)
    return this.addMatrix(mat, geo, this.m)
  }

  /** Pieza con la orientación dada por un cuaternión (p. ej. alineada a una normal). */
  addQuat(mat: Material, geo: BufferGeometry, pos: Vector3, quat: Quaternion, scale: number | V3 = 1) {
    if (typeof scale === 'number') this.s.setScalar(scale)
    else this.s.set(scale[0], scale[1], scale[2])
    this.m.compose(pos, quat, this.s)
    return this.addMatrix(mat, geo, this.m)
  }

  addMatrix(mat: Material, geo: BufferGeometry, matrix: Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    geo.dispose()
    g.clearGroups()
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
    if (!g.attributes.normal) g.computeVertexNormals()
    if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    g.applyMatrix4(matrix)
    let list = this.parts.get(mat)
    if (!list) this.parts.set(mat, (list = []))
    list.push(g)
    return this
  }

  /** Cilindro entre dos puntos (cables, vigas, puntales). */
  rod(mat: Material, a: V3, b: V3, r: number, sides = 5, geoFn?: (len: number) => BufferGeometry) {
    const va = new Vector3(...a)
    const vb = new Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize())
    const geo = geoFn ? geoFn(len) : cylinder(r, len, sides)
    return this.addQuat(mat, geo, va.add(vb).multiplyScalar(0.5), quat)
  }

  build(): { material: Material; geometry: BufferGeometry }[] {
    const out: { material: Material; geometry: BufferGeometry }[] = []
    this.parts.forEach((list, material) => {
      const geometry = mergeGeometries(list, false)
      list.forEach((g) => g.dispose())
      if (geometry) {
        geometry.computeBoundingSphere()
        out.push({ material, geometry })
      }
    })
    return out
  }
}

const cylinder = (r: number, len: number, sides: number) => new CylinderGeometry(r, r, len, sides)
