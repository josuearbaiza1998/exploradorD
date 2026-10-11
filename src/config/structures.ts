import type { Inventory } from './items'

/**
 * Estructuras construibles. La supervivencia depende de la energía y de
 * refugiarse del clima, no de comer: estas son las piezas para ello.
 */
export type StructureType = 'solarPanel' | 'batteryBank' | 'shelter' | 'lightningRod'

export type StructureDef = {
  name: string
  icon: string
  description: string
  cost: Inventory
  /** Radio que ocupa en el suelo (para validar la colocación). */
  footprint: number
  /** Colisionadores (círculos en coordenadas locales: x, z, radio, altura). */
  colliders: [number, number, number, number][]
  /** Radio dentro del cual el robot está a cubierto del clima y del frío. */
  shelterRadius?: number
  /** Carga solar que da al robot (%/h a pleno sol) dentro de `chargeRadius`. */
  solarRate?: number
  /** Capacidad de almacenamiento (%) de un banco de baterías. */
  bankCapacity?: number
  /** Distancia a la que carga al robot o se conecta a otras estructuras. */
  chargeRadius?: number
}

export const STRUCTURES: Record<StructureType, StructureDef> = {
  solarPanel: {
    name: 'Panel solar',
    icon: '🔆',
    description: 'De día carga al robot cerca y llena los bancos de baterías próximos.',
    cost: { scrapMetal: 3, techParts: 2, wood: 2 },
    footprint: 1.4,
    colliders: [[0, 0, 0.5, 2]],
    solarRate: 10,
    chargeRadius: 6,
  },
  batteryBank: {
    name: 'Banco de baterías',
    icon: '🔋',
    description: 'Guarda la energía de los paneles cercanos para recargar de noche.',
    cost: { scrapMetal: 4, techParts: 3, stone: 2 },
    footprint: 0.9,
    colliders: [[0, 0, 0.6, 1.4]],
    bankCapacity: 60,
    chargeRadius: 4,
  },
  shelter: {
    name: 'Refugio',
    icon: '🛖',
    description: 'Protege del frío nocturno, las tormentas y la lluvia.',
    cost: { wood: 6, stone: 4, fiber: 4 },
    footprint: 3,
    // Postes en las esquinas: el interior queda libre para entrar.
    colliders: [
      [2.2, 2.2, 0.25, 3],
      [-2.2, 2.2, 0.25, 3],
      [2.2, -2.2, 0.25, 3],
      [-2.2, -2.2, 0.25, 3],
    ],
    shelterRadius: 2.8,
  },
  lightningRod: {
    name: 'Pararrayos',
    icon: '⚡',
    description: 'En tormenta atrae los rayos cercanos: protege al robot y carga los bancos de baterías próximos.',
    cost: { scrapMetal: 3, crystal: 2, techParts: 1 },
    footprint: 0.8,
    colliders: [[0, 0, 0.3, 5]],
    chargeRadius: 10,
  },
}

/** Distancia (m) a la que un pararrayos desvía los rayos hacia sí. */
export const ROD_ATTRACT = 70
/** Distancia (m) a la que protege al robot de los rayos. */
export const ROD_PROTECT = 25
/** Carga (%) que da cada rayo capturado a los bancos cercanos (o al robot). */
export const ROD_CHARGE = 15

/** Velocidad a la que un banco de baterías recarga al robot (%/h). */
export const BANK_DISCHARGE_RATE = 25
/** Distancia a la que se coloca la estructura delante del robot en modo construcción. */
export const BUILD_DISTANCE = 4.5
