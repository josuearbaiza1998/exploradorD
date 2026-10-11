import { hash2 } from './random'
import { lerp } from './math'

/**
 * Value noise 2D suavizado + fBm. Implementación propia (sin dependencias)
 * y determinista: la altura en (x, z) es siempre la misma, por lo que los
 * chunks colindantes encajan sin costuras.
 */
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

export function valueNoise2D(x: number, z: number, seed: number): number {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const a = hash2(xi, zi, seed)
  const b = hash2(xi + 1, zi, seed)
  const c = hash2(xi, zi + 1, seed)
  const d = hash2(xi + 1, zi + 1, seed)
  const u = fade(xf)
  const v = fade(zf)
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1 // [-1, 1]
}

export function fbm2D(x: number, z: number, seed: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, z * freq, seed + i * 101) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

/** Ruido "ridged": crestas afiladas, ideal para dunas con filo. */
export function ridged2D(x: number, z: number, seed: number, octaves = 3): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2D(x * freq, z * freq, seed + i * 211))
    sum += n * n * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm // [0, 1]
}
