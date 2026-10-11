import { Color } from 'three'

/**
 * Fotogramas clave del ciclo día/noche. Colores saturados y "pintados"
 * (no físicamente correctos) para reforzar el estilo toon.
 */
type Keyframe = {
  hour: number
  skyTop: string
  skyHorizon: string
  sunColor: string
  sunIntensity: number
  ambient: number
  hemiSky: string
  hemiGround: string
}

const KEYFRAMES: Keyframe[] = [
  { hour: 0, skyTop: '#060a24', skyHorizon: '#1b2552', sunColor: '#8fa8ff', sunIntensity: 0.55, ambient: 0.14, hemiSky: '#2a3a7a', hemiGround: '#1a1420' },
  { hour: 4.8, skyTop: '#0b1033', skyHorizon: '#2d2a5e', sunColor: '#8fa8ff', sunIntensity: 0.45, ambient: 0.13, hemiSky: '#2a3a7a', hemiGround: '#1a1420' },
  { hour: 6, skyTop: '#3a4a9a', skyHorizon: '#ff8a5c', sunColor: '#ff9a5a', sunIntensity: 1.1, ambient: 0.18, hemiSky: '#7a7ad0', hemiGround: '#5a3020' },
  { hour: 8, skyTop: '#2a6fd6', skyHorizon: '#ffc98a', sunColor: '#ffe2b8', sunIntensity: 2.2, ambient: 0.22, hemiSky: '#8fc6ff', hemiGround: '#a0603a' },
  { hour: 13, skyTop: '#1858c8', skyHorizon: '#ffd8a0', sunColor: '#fff6e0', sunIntensity: 2.8, ambient: 0.25, hemiSky: '#9fd2ff', hemiGround: '#c27a45' },
  { hour: 17, skyTop: '#2256bd', skyHorizon: '#ffb466', sunColor: '#ffd59a', sunIntensity: 2.3, ambient: 0.22, hemiSky: '#8fb8ff', hemiGround: '#b0603a' },
  { hour: 19, skyTop: '#4a3a9a', skyHorizon: '#ff6a3d', sunColor: '#ff7a3d', sunIntensity: 1.2, ambient: 0.18, hemiSky: '#8a6ad0', hemiGround: '#6a2a20' },
  { hour: 20.6, skyTop: '#141a4a', skyHorizon: '#5a2d6a', sunColor: '#9aa8ff', sunIntensity: 0.5, ambient: 0.14, hemiSky: '#3a3a8a', hemiGround: '#1a1420' },
  { hour: 24, skyTop: '#060a24', skyHorizon: '#1b2552', sunColor: '#8fa8ff', sunIntensity: 0.55, ambient: 0.14, hemiSky: '#2a3a7a', hemiGround: '#1a1420' },
]

const parsed = KEYFRAMES.map((k) => ({
  ...k,
  cSkyTop: new Color(k.skyTop),
  cSkyHorizon: new Color(k.skyHorizon),
  cSun: new Color(k.sunColor),
  cHemiSky: new Color(k.hemiSky),
  cHemiGround: new Color(k.hemiGround),
}))

export type DayNightSample = {
  skyTop: Color
  skyHorizon: Color
  sunColor: Color
  sunIntensity: number
  ambient: number
  hemiSky: Color
  hemiGround: Color
  /** 1 = pleno día, 0 = noche cerrada. */
  daylight: number
}

export function createSample(): DayNightSample {
  return {
    skyTop: new Color(),
    skyHorizon: new Color(),
    sunColor: new Color(),
    sunIntensity: 0,
    ambient: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    daylight: 1,
  }
}

/** Interpola la paleta para una hora dada, escribiendo en `out` (sin asignaciones por frame). */
export function sampleDayNight(hour: number, out: DayNightSample): DayNightSample {
  let i = 0
  while (i < parsed.length - 2 && hour >= parsed[i + 1].hour) i++
  const a = parsed[i]
  const b = parsed[i + 1]
  const t = (hour - a.hour) / (b.hour - a.hour)
  out.skyTop.copy(a.cSkyTop).lerp(b.cSkyTop, t)
  out.skyHorizon.copy(a.cSkyHorizon).lerp(b.cSkyHorizon, t)
  out.sunColor.copy(a.cSun).lerp(b.cSun, t)
  out.hemiSky.copy(a.cHemiSky).lerp(b.cHemiSky, t)
  out.hemiGround.copy(a.cHemiGround).lerp(b.cHemiGround, t)
  out.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t
  out.ambient = a.ambient + (b.ambient - a.ambient) * t
  out.daylight = Math.min(1, Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI) * 1.6 + 0.2))
  if (hour < 5.5 || hour > 20.5) out.daylight = 0
  return out
}

/**
 * Dirección del astro principal. De 5:00 a 20:00 es el sol; fuera de ese
 * rango la misma luz direccional pasa a ser la luna (en el lado opuesto),
 * así nunca hay dos luces con sombra a la vez (clave para el rendimiento móvil).
 */
export const SUNRISE_HOUR = 5
export const SUNSET_HOUR = 20

export function celestialDirection(hour: number, out: { x: number; y: number; z: number }) {
  const isDay = hour >= SUNRISE_HOUR && hour < SUNSET_HOUR
  // 0..1 a través del cielo: el sol cubre 5:00-20:00, la luna 20:00-5:00.
  const local = isDay
    ? (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR)
    : ((hour - SUNSET_HOUR + 24) % 24) / (24 - SUNSET_HOUR + SUNRISE_HOUR)
  const angle = local * Math.PI
  // Elevación mínima para que las sombras nunca se estiren al infinito.
  const elevation = Math.max(Math.sin(angle), 0.18)
  out.x = Math.cos(angle)
  out.y = elevation
  out.z = -0.35
  const len = Math.hypot(out.x, out.y, out.z)
  out.x /= len
  out.y /= len
  out.z /= len
  return isDay
}

/**
 * Atenuación de la luz direccional alrededor del relevo sol/luna, para que
 * el salto de dirección de las sombras ocurra con la luz casi apagada.
 */
export function handoverFade(hour: number): number {
  const d = Math.min(Math.abs(hour - SUNRISE_HOUR), Math.abs(hour - SUNSET_HOUR))
  return Math.min(1, 0.15 + d / 0.6)
}
