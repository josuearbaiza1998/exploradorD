import { BufferAttribute, BufferGeometry, Color } from 'three'
import { getHeight } from './heightfield'
import { terrainColor, terrainSand } from './terrainColor'

/**
 * Construye la malla de un chunk en coordenadas de mundo.
 * Rejilla indexada con normales suaves (sacadas del propio campo de alturas,
 * así no hay costuras entre chunks) y color por vértice: el sombreado toon
 * dibuja dunas redondeadas en bandas limpias en vez de facetas. El atributo
 * `sand` (0..1) dice cuánto es arena, para que el shader pinte sus ondas.
 *
 * La función es pura y no depende de React: en el futuro puede moverse
 * a un Web Worker sin cambios para generar chunks fuera del hilo principal.
 */
export function buildChunkGeometry(cx: number, cz: number, size: number, resolution: number): BufferGeometry {
  const step = size / resolution
  const originX = cx * size
  const originZ = cz * size
  const verts = resolution + 1
  // Alturas con un borde extra de una celda para las normales.
  const pad = verts + 2
  const heights = new Float32Array(pad * pad)
  for (let j = 0; j < pad; j++) {
    for (let i = 0; i < pad; i++) {
      heights[j * pad + i] = getHeight(originX + (i - 1) * step, originZ + (j - 1) * step)
    }
  }
  const H = (i: number, j: number) => heights[(j + 1) * pad + (i + 1)]

  const count = verts * verts
  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sand = new Float32Array(count)
  const color = new Color()
  for (let j = 0; j < verts; j++) {
    for (let i = 0; i < verts; i++) {
      const k = j * verts + i
      const x = originX + i * step
      const z = originZ + j * step
      const y = H(i, j)
      const dx = (H(i + 1, j) - H(i - 1, j)) / (2 * step)
      const dz = (H(i, j + 1) - H(i, j - 1)) / (2 * step)
      const inv = 1 / Math.hypot(dx, 1, dz)
      positions[k * 3] = x
      positions[k * 3 + 1] = y
      positions[k * 3 + 2] = z
      normals[k * 3] = -dx * inv
      normals[k * 3 + 1] = inv
      normals[k * 3 + 2] = -dz * inv
      terrainColor(x, y, z, Math.hypot(dx, dz), color)
      colors[k * 3] = color.r
      colors[k * 3 + 1] = color.g
      colors[k * 3 + 2] = color.b
      sand[k] = terrainSand
    }
  }

  const index: number[] = []
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const a = j * verts + i
      const b = a + 1
      const c = a + verts
      const d = c + 1
      // Diagonal alterna para que no se vea un patrón de "dientes".
      if ((i + j) % 2 === 0) index.push(a, c, b, b, c, d)
      else index.push(a, d, b, a, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('sand', new BufferAttribute(sand, 1))
  geometry.setIndex(index)
  geometry.computeBoundingSphere()
  geometry.computeBoundingBox()
  return geometry
}

export const chunkKey = (cx: number, cz: number) => `${cx}:${cz}`
