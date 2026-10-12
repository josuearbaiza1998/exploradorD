import type { Inventory } from './items'

/**
 * Objetivo principal: la nave ya no volverá a volar (el chasis está doblado),
 * pero su casco flota. Se adapta como barco sistema a sistema para cruzar a
 * la otra isla. Cada adaptación pide una pieza única (de un lugar por
 * descubrir) o materiales comunes. Se hace en la nave (pestaña Nave).
 */
export type RepairId = 'hull' | 'comms' | 'navigation' | 'cooling' | 'engine'

export type RepairDef = { id: RepairId; name: string; icon: string; description: string; cost: Inventory }

export const REPAIRS: RepairDef[] = [
  { id: 'hull', name: 'Casco estanco', icon: '🛶', description: 'Sellar las grietas y añadir flotadores a los costados.', cost: { wood: 8, fiber: 6, scrapMetal: 3 } },
  { id: 'comms', name: 'Radio', icon: '📡', description: 'Antena en el mástil: capta la baliza de la otra isla.', cost: { antenna: 1, scrapMetal: 2, techParts: 1 } },
  { id: 'navigation', name: 'Navegación', icon: '🧭', description: 'El ordenador de vuelo, reprogramado para rutas por mar.', cost: { navChip: 1, techParts: 2, fiber: 4 } },
  { id: 'cooling', name: 'Refrigeración', icon: '🧊', description: 'El agua del mar enfría el motor por tuberías nuevas.', cost: { coolant: 1, stone: 5, scrapMetal: 2 } },
  { id: 'engine', name: 'Motor y hélice', icon: '💎', description: 'El cristal reaviva el motor, que ahora mueve una hélice. Se acabó el humo negro.', cost: { energyCrystal: 1, techParts: 2, wood: 6 } },
]
