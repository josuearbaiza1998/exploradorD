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
]

/** Distancia a la plataforma de la nave para usar el banco de trabajo. */
export const WORKBENCH_RADIUS = 10
