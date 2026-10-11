import { BufferAttribute, BufferGeometry, Color } from 'three'
import { getHeight } from './heightfield'
import { terrainColor } from './terrainColor'

/**
 * Construye la malla de un chunk en coordenadas de mundo.
 * Geometría NO indexada para un look lowpoly facetado limpio (cada
 * triángulo con su color sólido), que además es barato de sombrear.
 *
 * La función es pura y no depende de React: en el futuro puede moverse
 * a un Web Worker sin cambios para generar chunks fuera del hilo principal.
 */
export function buildChunkGeometry(cx: number, cz: number, size: number, resolution: number): BufferGeometry {
  const step = size / resolution
  const originX = cx * size
  const originZ = cz * size
  const verts = resolution + 1

  // Muestreo de alturas una sola vez por vértice de la rejilla.
  const heights = new Float32Array(verts * verts)
  for (let j = 0; j < verts; j++) {
    for (let i = 0; i < verts; i++) {
      heights[j * verts + i] = getHeight(originX + i * step, originZ + j * step)
    }
  }

  const triCount = resolution * resolution * 2
  const positions = new Float32Array(triCount * 9)
  const colors = new Float32Array(triCount * 9)
  const color = new Color()
  let p = 0

  const pushTri = (ax: number, az: number, ay: number, bx: number, bz: number, by: number, qx: number, qz: number, qy: number) => {
    // Color por cara: centroide + pendiente aproximada de la cara.
    const mx = (ax + bx + qx) / 3
    const mz = (az + bz + qz) / 3
    const my = (ay + by + qy) / 3
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = qx - ax, vy = qy - ay, vz = qz - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const slope = Math.hypot(nx, nz) / Math.max(Math.abs(ny), 1e-6)
    terrainColor(mx, my, mz, slope, color)
    const tri = [ax, ay, az, bx, by, bz, qx, qy, qz]
    for (let k = 0; k < 9; k++) positions[p + k] = tri[k]
    for (let k = 0; k < 3; k++) {
      colors[p + k * 3] = color.r
      colors[p + k * 3 + 1] = color.g
      colors[p + k * 3 + 2] = color.b
    }
    p += 9
  }

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const x0 = originX + i * step
      const z0 = originZ + j * step
      const x1 = x0 + step
      const z1 = z0 + step
      const h00 = heights[j * verts + i]
      const h10 = heights[j * verts + i + 1]
      const h01 = heights[(j + 1) * verts + i]
      const h11 = heights[(j + 1) * verts + i + 1]
      // Alternamos la diagonal para evitar un patrón de "dientes" muy visible.
      if ((i + j) % 2 === 0) {
        pushTri(x0, z0, h00, x0, z1, h01, x1, z0, h10)
        pushTri(x1, z0, h10, x0, z1, h01, x1, z1, h11)
      } else {
        pushTri(x0, z0, h00, x1, z1, h11, x1, z0, h10)
        pushTri(x0, z0, h00, x0, z1, h01, x1, z1, h11)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.computeVertexNormals() // no indexada => normales planas por cara
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return geometry
}

export const chunkKey = (cx: number, cz: number) => `${cx}:${cz}`
