import { DataTexture, NearestFilter, RedFormat, UnsignedByteType } from 'three'

/**
 * Mapa de gradiente de cortes duros para MeshToonMaterial.
 * Cada valor es una "banda" de luz; NearestFilter evita cualquier
 * interpolación => transiciones de sombra nítidas tipo BotW.
 */
function createGradientMap(steps: number[]): DataTexture {
  const data = new Uint8Array(steps.map((s) => Math.round(s * 255)))
  const tex = new DataTexture(data, data.length, 1, RedFormat, UnsignedByteType)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** 3 bandas: sombra, medio tono, luz plena. Estándar para casi todo. */
export const toonGradient3 = createGradientMap([0.35, 0.7, 1])

/** 2 bandas: más gráfico, ideal para el terreno lejano y follaje. */
export const toonGradient2 = createGradientMap([0.45, 1])
