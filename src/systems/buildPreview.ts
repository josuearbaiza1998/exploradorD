import type { PlacementCheck } from './building'

/** Última validación de la vista previa (la escribe BuildGhost, la lee la UI). */
export const buildPreview: { check: PlacementCheck | null } = { check: null }
