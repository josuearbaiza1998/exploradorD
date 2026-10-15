/**
 * Convierte el barco hecho en Tripo (modelos-fuente/barco-tripo.glb, ya
 * simplificado por scripts/import-tripo-boat.cjs) al barco del juego. No forma
 * parte del juego: se ejecuta en el navegador de desarrollo.
 *
 * - Lo orienta y escala a las coordenadas del barco (+Z proa, timón delante
 *   del robot).
 * - Recorta de las mallas lo que se anima: la hélice, la aleta y los dos
 *   banderines; quita el farol (ahí cuelga el dron).
 * - Reparte el resto en los grupos del astillero (casco, navegación,
 *   comunicaciones, carga y motor) por zonas del modelo.
 * - Deja un solo material con la textura de color (el juego lo pasa a toon).
 */
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Object3D, Vector3, type Texture } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Escala y anclaje: el modelo mide ~0.98 de proa a popa con la proa en -X; el
 * suelo de la cabina (y = floor) queda a floorY y el timón (x ≈ 0.012) en z = 0.35.
 * El robot va un poco más alto (BOAT.deck.y) para que asome por la borda.
 */
export const TRIPO = { scale: 12, x0: 0.0412, floor: 0.1, floorY: 1.1 }

/** Coordenadas del modelo de Tripo → coordenadas del barco. */
export const tripoToBoat = new Matrix4()
  .makeTranslation(0, TRIPO.floorY, 0)
  .multiply(new Matrix4().makeScale(TRIPO.scale, TRIPO.scale, TRIPO.scale))
  .multiply(new Matrix4().makeRotationY(Math.PI / 2))
  .multiply(new Matrix4().makeTranslation(-TRIPO.x0, -TRIPO.floor, 0))

type Bucket = 'hull' | 'nav' | 'cargo' | 'engine' | 'mast' | 'flag0' | 'flag1' | 'prop' | 'rudder' | 'drop'

/** A qué pieza va cada triángulo, según la parte de Tripo y su centro (coordenadas del modelo). */
function classify(part: string, x: number, y: number, z: number): Bucket {
  if (part === 'tripo_part_2') return x < 0.378 && y < 0.175 ? 'prop' : 'rudder'
  if (part === 'tripo_part_3') {
    if (x < 0.137 && y > 0.335 && y < 0.43) return 'drop' // el farol
    if (x > 0.158 && y > 0.395) return 'flag0'
    if (x > 0.158 && y >= 0.35) return 'flag1'
    return 'mast'
  }
  if (part !== 'tripo_part_0') return 'hull'
  if (x > 0.285 || (x > 0.255 && y > 0.155)) return 'engine'
  if (x > 0.14 && x <= 0.255 && y > 0.15 && Math.abs(z) < 0.1) return 'cargo'
  if (x > -0.01 && x < 0.035 && y > 0.15 && y < 0.25 && Math.abs(z) < 0.06) return 'nav'
  return 'hull'
}

/** Ejes de lo que gira (coordenadas del modelo). */
const PIVOTS: Partial<Record<Bucket, Vector3>> = {
  prop: new Vector3(0.36, 0.087, 0),
  rudder: new Vector3(0.391, 0.15, 0),
  flag0: new Vector3(0.15, 0.41, 0),
  flag1: new Vector3(0.15, 0.37, 0),
}

/** Farol (donde cuelga el dron) y boca de la chimenea, en coordenadas del modelo. */
export const TRIPO_POINTS = { lamp: new Vector3(0.12, 0.383, 0), stack: new Vector3(0.293, 0.332, 0) }

export function buildTripoBoat(src: Object3D): Group {
  src.updateMatrixWorld(true)
  const tris = new Map<Bucket, { p: number[]; n: number[]; uv: number[] }>()
  let map: Texture | null = null
  const v = [new Vector3(), new Vector3(), new Vector3()]
  const nrm = [new Vector3(), new Vector3(), new Vector3()]
  src.traverse((o) => {
    if (!(o instanceof Mesh)) return
    const g = o.geometry as BufferGeometry
    const pos = g.attributes.position
    if (pos.count < 10) return // restos de 1 triángulo que deja Tripo
    map ??= (o.material as MeshStandardMaterial).map
    const part = o.parent && o.parent.name.startsWith('tripo_part') ? o.parent.name : o.name
    const nm = new Matrix4().copy(o.matrixWorld).invert().transpose()
    const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i)
    const nor = g.attributes.normal
    const uv = g.attributes.uv
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        v[k].fromBufferAttribute(pos, idx[t + k]).applyMatrix4(o.matrixWorld)
        nrm[k].fromBufferAttribute(nor, idx[t + k]).applyMatrix4(nm).normalize()
      }
      const b = classify(part, (v[0].x + v[1].x + v[2].x) / 3, (v[0].y + v[1].y + v[2].y) / 3, (v[0].z + v[1].z + v[2].z) / 3)
      if (b === 'drop') continue
      let d = tris.get(b)
      if (!d) tris.set(b, (d = { p: [], n: [], uv: [] }))
      for (let k = 0; k < 3; k++) {
        d.p.push(v[k].x, v[k].y, v[k].z)
        d.n.push(nrm[k].x, nrm[k].y, nrm[k].z)
        d.uv.push(uv.getX(idx[t + k]), uv.getY(idx[t + k]))
      }
    }
  })

  const mat = new MeshStandardMaterial({ name: 'tripo', map, roughness: 0.8 })
  const mesh = (b: Bucket) => {
    const d = tris.get(b)
    if (!d) return null
    let g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(d.p), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(d.n), 3))
    g.setAttribute('uv', new BufferAttribute(new Float32Array(d.uv), 2))
    g.applyMatrix4(tripoToBoat)
    g = mergeVertices(g, 1e-5)
    const pivot = PIVOTS[b]
    const m = new Mesh(g, mat)
    m.name = `${b}_mesh`
    if (!pivot) return m
    const at = pivot.clone().applyMatrix4(tripoToBoat)
    g.translate(-at.x, -at.y, -at.z)
    const grp = new Group()
    grp.name = b
    grp.position.copy(at)
    grp.add(m)
    return grp
  }

  const root = new Group()
  root.name = 'boat'
  const group = (name: string, parts: Bucket[]) => {
    const g = new Group()
    g.name = name
    parts.forEach((b) => {
      const m = mesh(b)
      if (m) g.add(m)
    })
    root.add(g)
    return g
  }
  group('part_hull', ['hull'])
  group('part_navigation', ['nav'])
  const comms = group('part_comms', ['mast', 'flag0', 'flag1'])
  const lamp = new Object3D()
  lamp.name = 'lamp'
  lamp.position.copy(TRIPO_POINTS.lamp).applyMatrix4(tripoToBoat)
  comms.add(lamp)
  group('part_cooling', ['cargo'])
  const eng = group('part_engine', ['engine', 'prop', 'rudder'])
  const smoke = new Object3D()
  smoke.name = 'smoke'
  smoke.position.copy(TRIPO_POINTS.stack).applyMatrix4(tripoToBoat)
  eng.add(smoke)
  return root
}
