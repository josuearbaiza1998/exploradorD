import type { ItemId, ToolId } from './items'

/**
 * Qué se puede recolectar, con qué herramienta y qué da.
 * Progresión escalonada: manos → hacha → martillo. El metal NO sale de las
 * rocas: solo de la nave (scavenging).
 */
export type HarvestKind = 'smallTree' | 'shrub' | 'palm' | 'rock' | 'debris' | 'hullPanel' | 'structure' | 'cache' | 'buried' | 'bloom' | 'note' | 'crystal' | 'fulgurite' | 'scavenger'

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
  /** Material para el sonido y las partículas del golpe. */
  material: 'wood' | 'stone' | 'metal' | 'plant'
}

export const HARVEST: Record<HarvestKind, HarvestDef> = {
  smallTree: {
    material: 'wood',
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
    material: 'plant',
    label: 'Arbusto',
    verb: 'Arrancar',
    icon: '✊',
    hits: 1,
    yields: [{ item: 'fiber', min: 1, max: 2 }],
    regrowHours: 24,
  },
  palm: {
    material: 'wood',
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
    material: 'stone',
    label: 'Roca',
    verb: 'Picar',
    icon: '🔨',
    tool: 'hammer',
    hits: 6,
    yields: [{ item: 'stone', min: 2, max: 4 }],
    regrowHours: null,
  },
  debris: {
    material: 'metal',
    label: 'Escombro de la nave',
    verb: 'Desmontar',
    icon: '✊',
    hits: 2,
    yields: [{ item: 'scrapMetal', min: 1, max: 2 }],
    regrowHours: null,
    uses: 3,
  },
  hullPanel: {
    material: 'metal',
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
  // Contenedor de un lugar por descubrir: se abre una sola vez (botín en config/pois.ts).
  // Restos que deja al descubierto una tormenta de arena.
  buried: {
    material: 'stone',
    label: 'Restos desenterrados',
    verb: 'Excavar',
    icon: '⛏️',
    hits: 2,
    yields: [
      { item: 'scrapMetal', min: 1, max: 2 },
      { item: 'techParts', min: 0, max: 1 },
      { item: 'cell', min: 0, max: 1 },
    ],
    regrowHours: null,
  },
  // Flor del desierto: brota alrededor del oasis tras la lluvia.
  bloom: {
    material: 'plant',
    label: 'Flor del desierto',
    verb: 'Recoger',
    icon: '🌸',
    hits: 1,
    yields: [
      { item: 'fiber', min: 2, max: 3 },
      { item: 'cloth', min: 0, max: 1 },
    ],
    regrowHours: null,
  },
  // Racimos de cristal de la cueva: vuelven a crecer.
  crystal: {
    material: 'stone',
    label: 'Racimo de cristal',
    verb: 'Arrancar',
    icon: '🔨',
    tool: 'hammer',
    hits: 3,
    yields: [{ item: 'crystal', min: 1, max: 3 }],
    regrowHours: 72,
  },
  // Robots carroñeros: dos golpes los apagan y sueltan lo que llevan.
  scavenger: {
    material: 'metal',
    label: 'Carroñero',
    verb: 'Golpear',
    icon: '✊',
    hits: 2,
    yields: [
      { item: 'scrapMetal', min: 1, max: 2 },
      { item: 'techParts', min: 0, max: 1 },
    ],
    regrowHours: null,
  },
  // Lo que deja un rayo al caer en la arena.
  fulgurite: {
    material: 'stone',
    label: 'Fulgurita',
    verb: 'Recoger',
    icon: '✊',
    hits: 1,
    yields: [{ item: 'fulgurite', min: 1, max: 2 }],
    regrowHours: null,
  },
  // Registro de la expedición anterior: se lee (se puede releer).
  note: {
    material: 'metal',
    label: 'Registro',
    verb: 'Leer',
    icon: '📜',
    hits: 1,
    yields: [],
    regrowHours: null,
  },
  cache: {
    material: 'metal',
    label: 'Contenedor',
    verb: 'Abrir',
    icon: '🔓',
    hits: 3,
    yields: [],
    regrowHours: null,
  },
  // Estructuras propias: desmontarlas devuelve la mitad de los materiales.
  structure: {
    material: 'metal',
    label: 'Estructura',
    verb: 'Desmontar',
    icon: '🔧',
    hits: 3,
    yields: [],
    regrowHours: null,
  },
}
