import type { Inventory } from './items'

/**
 * Objetivo principal: reparar la nave sistema a sistema. Cada reparación
 * pide una pieza única (de un lugar por descubrir) y materiales comunes.
 * Se hace en la nave (pestaña Nave de la mochila).
 */
export type RepairId = 'comms' | 'navigation' | 'cooling' | 'engine'

export type RepairDef = { id: RepairId; name: string; icon: string; description: string; cost: Inventory }

export const REPAIRS: RepairDef[] = [
  { id: 'comms', name: 'Comunicaciones', icon: '📡', description: 'Antena nueva en el lomo de la nave.', cost: { antenna: 1, scrapMetal: 2, techParts: 1 } },
  { id: 'navigation', name: 'Navegación', icon: '🧭', description: 'El ordenador de vuelo vuelve a calcular rutas.', cost: { navChip: 1, techParts: 2, fiber: 4 } },
  { id: 'cooling', name: 'Refrigeración', icon: '🧊', description: 'Tuberías nuevas para que el motor no se funda.', cost: { coolant: 1, stone: 5, scrapMetal: 2 } },
  { id: 'engine', name: 'Núcleo del motor', icon: '💎', description: 'El cristal reaviva el motor. Se acabó el humo negro.', cost: { energyCrystal: 1, techParts: 2, wood: 6 } },
]
