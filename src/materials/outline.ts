import { BackSide, BufferAttribute, Color, MeshBasicMaterial, type BufferGeometry } from 'three'

/**
 * Contorno tipo cómic con la técnica "inverted hull": se dibuja la malla otra
 * vez por dentro (BackSide), inflada a lo largo de la normal y en un color
 * oscuro. Barato en móvil (sin post-proceso) y compatible con instancias y
 * mallas con esqueleto.
 */

/**
 * Normales promediadas por posición. Con geometría facetada (lowpoly) las
 * normales de cada cara son distintas y el contorno se "abriría" en las
 * aristas; con normales suavizadas queda continuo.
 */
export function ensureOutlineNormals(geometry: BufferGeometry): BufferGeometry {
  if (geometry.getAttribute('outlineNormal')) return geometry
  const pos = geometry.getAttribute('position')
  const nor = geometry.getAttribute('normal')
  if (!pos || !nor) return geometry
  const sums = new Map<string, [number, number, number]>()
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
  for (let i = 0; i < pos.count; i++) {
    const k = key(i)
    const s = sums.get(k) ?? [0, 0, 0]
    s[0] += nor.getX(i)
    s[1] += nor.getY(i)
    s[2] += nor.getZ(i)
    sums.set(k, s)
  }
  const out = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const s = sums.get(key(i))!
    const len = Math.hypot(s[0], s[1], s[2]) || 1
    out[i * 3] = s[0] / len
    out[i * 3 + 1] = s[1] / len
    out[i * 3 + 2] = s[2] / len
  }
  geometry.setAttribute('outlineNormal', new BufferAttribute(out, 3))
  return geometry
}

const cache = new Map<string, MeshBasicMaterial>()

/** Material de contorno (compartido por grosor/color). `thickness` en unidades locales del modelo. */
export function outlineMaterial(thickness = 0.03, color = '#2a1a12'): MeshBasicMaterial {
  const key = `${thickness}|${color}`
  let mat = cache.get(key)
  if (mat) return mat
  mat = new MeshBasicMaterial({ color: new Color(color), side: BackSide })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 outlineNormal;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed += normalize(outlineNormal) * ${thickness.toFixed(4)};`,
      )
  }
  mat.customProgramCacheKey = () => `outline-${key}`
  cache.set(key, mat)
  return mat
}
