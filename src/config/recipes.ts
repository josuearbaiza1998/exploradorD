import type { Inventory, ItemId } from './items'

/**
 * Recetas. `station: 'ship'` = solo junto a la nave (banco de trabajo en la
 * plataforma de recarga). Así la nave es la base y el crafteo escala con ella.
 */
export type Recipe = {
  id: string
  output: ItemId
  amount: number
  cost: Inventory
  station: 'none' | 'ship'
  /** Herramienta que hay que tener antes (progresión). */
  requires?: ItemId
}

export const RECIPES: Recipe[] = [
  { id: 'cloth', output: 'cloth', amount: 1, cost: { fiber: 2 }, station: 'none' },
  { id: 'axe', output: 'axe', amount: 1, cost: { wood: 3, scrapMetal: 3, fiber: 2 }, station: 'ship' },
  {
    id: 'hammer',
    output: 'hammer',
    amount: 1,
    cost: { wood: 2, scrapMetal: 4, techParts: 2 },
    station: 'ship',
    requires: 'axe',
  },
  {
    id: 'sonicCleaner',
    output: 'sonicCleaner',
    amount: 1,
    cost: { scrapMetal: 2, techParts: 2, fiber: 2 },
    station: 'ship',
  },
  { id: 'drone', output: 'drone', amount: 1, cost: { scrapMetal: 4, techParts: 3, fiber: 2 }, station: 'ship' },
  { id: 'hook', output: 'hook', amount: 1, cost: { scrapMetal: 3, fiber: 4, techParts: 1 }, station: 'ship' },
  { id: 'cell', output: 'cell', amount: 1, cost: { scrapMetal: 2, techParts: 1 }, station: 'ship' },
  // Celda sin metal: lo que deja la tormenta y lo que crece en la cueva.
  // Lo que cae del cielo: metal raro que se funde en componentes.
  { id: 'meteorParts', output: 'techParts', amount: 2, cost: { meteorite: 1 }, station: 'ship' },
  { id: 'cellFulgurite', output: 'cell', amount: 1, cost: { fulgurite: 2, crystal: 1 }, station: 'ship' },
]

/** Distancia a la plataforma de la nave para usar el banco de trabajo. */
export const WORKBENCH_RADIUS = 10
