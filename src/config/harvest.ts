import type { ItemId, ToolId } from './items'

/**
 * Qué se puede recolectar, con qué herramienta y qué da.
 * Progresión escalonada: manos → hacha → martillo. El metal NO sale de las
 * rocas: solo de la nave (scavenging).
 */
export type HarvestKind = 'smallTree' | 'shrub' | 'palm' | 'rock' | 'debris' | 'hullPanel' | 'structure'

export type HarvestDef = {
  label: string
  /** Verbo del botón de acción. */
  verb: string
  icon: string
  /** Herramienta necesaria (sin valor = a mano). */
  tool?: ToolId
  /** Golpes necesarios para completar. */
  hits: number
  yields: { item: ItemId; min: number; max: number }[]
  /** Horas in-game hasta que vuelve a aparecer (null = no vuelve). */
  regrowHours: number | null
  /** Usos antes de agotarse (escombros/paneles de la nave). */
  uses?: number
}

export const HARVEST: Record<HarvestKind, HarvestDef> = {
  smallTree: {
    label: 'Árbol pequeño',
    verb: 'Romper',
    icon: '✊',
    hits: 3,
    yields: [
      { item: 'wood', min: 1, max: 2 },
      { item: 'fiber', min: 0, max: 1 },
    ],
    regrowHours: 48,
  },
  shrub: {
    label: 'Arbusto',
    verb: 'Arrancar',
    icon: '✊',
    hits: 1,
    yields: [{ item: 'fiber', min: 1, max: 2 }],
    regrowHours: 24,
  },
  palm: {
    label: 'Tronco grueso',
    verb: 'Talar',
    icon: '🪓',
    tool: 'axe',
    hits: 5,
    yields: [
      { item: 'wood', min: 3, max: 5 },
      { item: 'fiber', min: 1, max: 2 },
    ],
    regrowHours: 96,
  },
  rock: {
    label: 'Roca',
    verb: 'Picar',
    icon: '🔨',
    tool: 'hammer',
    hits: 6,
    yields: [{ item: 'stone', min: 2, max: 4 }],
    regrowHours: null,
  },
  debris: {
    label: 'Escombro de la nave',
    verb: 'Desmontar',
    icon: '✊',
    hits: 2,
    yields: [{ item: 'scrapMetal', min: 1, max: 2 }],
    regrowHours: null,
    uses: 3,
  },
  hullPanel: {
    label: 'Panel del casco',
    verb: 'Forzar',
    icon: '🪓',
    tool: 'axe',
    hits: 4,
    yields: [
      { item: 'techParts', min: 1, max: 2 },
      { item: 'scrapMetal', min: 1, max: 1 },
    ],
    regrowHours: null,
    uses: 4,
  },
  // Estructuras propias: desmontarlas devuelve la mitad de los materiales.
  structure: {
    label: 'Estructura',
    verb: 'Desmontar',
    icon: '🔧',
    hits: 3,
    yields: [],
    regrowHours: null,
  },
}
