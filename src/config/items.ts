/**
 * Catálogo de objetos. Sin comida ni agua: todo gira en torno a energía,
 * materiales y tecnología (regla de supervivencia robótica).
 */
export type ItemId = 'wood' | 'fiber' | 'stone' | 'scrapMetal' | 'techParts' | 'cell'

export type ItemDef = { id: ItemId; name: string; icon: string; stack: number }

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { id: 'wood', name: 'Madera', icon: '🪵', stack: 50 },
  fiber: { id: 'fiber', name: 'Fibra vegetal', icon: '🌿', stack: 50 },
  stone: { id: 'stone', name: 'Piedra', icon: '🪨', stack: 50 },
  scrapMetal: { id: 'scrapMetal', name: 'Chatarra', icon: '🔩', stack: 30 },
  techParts: { id: 'techParts', name: 'Componentes', icon: '💾', stack: 20 },
  cell: { id: 'cell', name: 'Celda de energía', icon: '🔋', stack: 5 },
}

export type Inventory = Partial<Record<ItemId, number>>
