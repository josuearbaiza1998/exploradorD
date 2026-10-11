/**
 * Catálogo de objetos. Sin comida ni agua: todo gira en torno a energía,
 * materiales y tecnología (regla de supervivencia robótica).
 */
export type ItemId =
  | 'wood'
  | 'fiber'
  | 'stone'
  | 'scrapMetal'
  | 'techParts'
  | 'cell'
  | 'cloth'
  | 'axe'
  | 'hammer'
  | 'sonicCleaner'

export type ItemKind = 'resource' | 'tool' | 'consumable'

export type ItemDef = { id: ItemId; name: string; icon: string; stack: number; kind: ItemKind; description?: string }

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { id: 'wood', name: 'Madera', icon: '🪵', stack: 50, kind: 'resource' },
  fiber: { id: 'fiber', name: 'Fibra vegetal', icon: '🌿', stack: 50, kind: 'resource' },
  stone: { id: 'stone', name: 'Piedra', icon: '🪨', stack: 50, kind: 'resource' },
  scrapMetal: { id: 'scrapMetal', name: 'Chatarra', icon: '🔩', stack: 30, kind: 'resource' },
  techParts: { id: 'techParts', name: 'Componentes', icon: '💾', stack: 20, kind: 'resource' },
  cell: {
    id: 'cell',
    name: 'Celda de energía',
    icon: '🔋',
    stack: 5,
    kind: 'consumable',
    description: 'Recarga de emergencia: +25 % de batería.',
  },
  cloth: {
    id: 'cloth',
    name: 'Paño de fibra',
    icon: '🧽',
    stack: 10,
    kind: 'consumable',
    description: 'Limpia el polvo de los sensores.',
  },
  axe: {
    id: 'axe',
    name: 'Hacha futurista simple',
    icon: '🪓',
    stack: 1,
    kind: 'tool',
    description: 'Tala troncos gruesos y abre los paneles de la nave.',
  },
  hammer: {
    id: 'hammer',
    name: 'Martillo de impacto',
    icon: '🔨',
    stack: 1,
    kind: 'tool',
    description: 'Rompe rocas para obtener piedra.',
  },
  sonicCleaner: {
    id: 'sonicCleaner',
    name: 'Limpiador sónico',
    icon: '📡',
    stack: 1,
    kind: 'tool',
    description: 'Sacude el polvo de los sensores con vibración. Reutilizable, gasta batería.',
  },
}

export type Inventory = Partial<Record<ItemId, number>>
export type ToolId = 'axe' | 'hammer'
