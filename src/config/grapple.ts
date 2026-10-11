import type { Vec2 } from './world'

/**
 * Postes de anclaje para el gancho: el robot se lanza hasta ellos si los
 * tiene a tiro y delante. Uno en el islote y otro en el borde del pico para volver.
 */
export type Anchor = Vec2 & { id: string; label: string }

export const ANCHORS: Anchor[] = [
  { id: 'islet', label: 'Islote', x: 121, z: -183 },
  { id: 'peak', label: 'Pico de la baliza', x: 106.5, z: -161.8 },
]

/** Alcance del gancho (m). */
export const GRAPPLE_RANGE = 38
/** Altura del aro del poste sobre el suelo. */
export const ANCHOR_RING = 2.3
