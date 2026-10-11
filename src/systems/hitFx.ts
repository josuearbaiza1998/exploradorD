/**
 * Eventos visuales de los golpes (sin React): performInteraction los emite y
 * <HitEffects/> los consume cada frame (partículas, textos flotantes) y la
 * cámara lee `shake` para temblar.
 */
export type HitMaterial = 'wood' | 'stone' | 'metal' | 'plant'

export type HitEvent = { material: HitMaterial; x: number; y: number; z: number; final: boolean }
export type FloatText = { text: string; x: number; y: number; z: number }

export const hitFx = {
  events: [] as HitEvent[],
  texts: [] as FloatText[],
  /** Intensidad del temblor de cámara (decae sola). */
  shake: 0,
}

export function emitHit(e: HitEvent) {
  hitFx.events.push(e)
  hitFx.shake = Math.min(1, hitFx.shake + (e.final ? 0.55 : 0.25))
}

export function emitFloatText(t: FloatText) {
  hitFx.texts.push(t)
}
