/**
 * Catálogo de objetos. Sin comida ni agua: todo gira en torno a energía,
 * materiales y tecnología (regla de supervivencia robótica).
 */
export type ItemId =
  | 'hook'
  | 'drone'
  | 'wood'
  | 'fiber'
  | 'stone'
  | 'scrapMetal'
  | 'techParts'
  | 'crystal'
  | 'fulgurite'
  | 'meteorite'
  | 'currentChart'
  | 'cell'
  | 'cloth'
  | 'axe'
  | 'hammer'
  | 'sonicCleaner'
  // Piezas únicas para adaptar la nave como barco (una en cada lugar por descubrir).
  | 'antenna'
  | 'navChip'
  | 'coolant'
  | 'energyCrystal'

export type ItemKind = 'resource' | 'tool' | 'consumable' | 'part'

export type ItemDef = { id: ItemId; name: string; icon: string; stack: number; kind: ItemKind; description?: string }

export const ITEMS: Record<ItemId, ItemDef> = {
  wood: { id: 'wood', name: 'Madera', icon: '🪵', stack: 50, kind: 'resource' },
  fiber: { id: 'fiber', name: 'Fibra vegetal', icon: '🌿', stack: 50, kind: 'resource' },
  stone: { id: 'stone', name: 'Piedra', icon: '🪨', stack: 50, kind: 'resource' },
  scrapMetal: { id: 'scrapMetal', name: 'Chatarra', icon: '🔩', stack: 30, kind: 'resource' },
  techParts: { id: 'techParts', name: 'Componentes', icon: '💾', stack: 20, kind: 'resource' },
  crystal: { id: 'crystal', name: 'Cristal azul', icon: '🔹', stack: 30, kind: 'resource', description: 'Crece en la cueva de cristal. Guarda energía.' },
  fulgurite: { id: 'fulgurite', name: 'Fulgurita', icon: '⚡', stack: 20, kind: 'resource', description: 'Arena fundida por un rayo. Conduce muy bien la energía.' },
  meteorite: { id: 'meteorite', name: 'Fragmento de meteorito', icon: '☄️', stack: 20, kind: 'resource', description: 'Metal caído del cielo. En la nave se funde en componentes.' },
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
  drone: {
    id: 'drone',
    name: 'Dron compañero',
    icon: '🛸',
    stack: 1,
    kind: 'tool',
    description: 'Te sigue, alumbra de noche y lleva 10 de carga extra.',
  },
  hook: {
    id: 'hook',
    name: 'Gancho',
    icon: '🪝',
    stack: 1,
    kind: 'tool',
    description: 'Se engancha a los postes de anclaje y te lanza hasta ellos, incluso sobre el agua.',
  },
  sonicCleaner: {
    id: 'sonicCleaner',
    name: 'Limpiador sónico',
    icon: '📡',
    stack: 1,
    kind: 'tool',
    description: 'Sacude el polvo de los sensores con vibración. Reutilizable, gasta batería.',
  },
  currentChart: { id: 'currentChart', name: 'Carta de corrientes', icon: '🗺️', stack: 1, kind: 'part', description: 'Ruta por mar hacia la otra isla, trazada con los datos de las tres boyas.' },
  antenna: { id: 'antenna', name: 'Antena de largo alcance', icon: '📡', stack: 1, kind: 'part', description: 'Pieza para convertir la nave en barco.' },
  navChip: { id: 'navChip', name: 'Chip de navegación', icon: '🧭', stack: 1, kind: 'part', description: 'Pieza para convertir la nave en barco.' },
  coolant: { id: 'coolant', name: 'Bomba de refrigerante', icon: '🧊', stack: 1, kind: 'part', description: 'Pieza para convertir la nave en barco.' },
  energyCrystal: { id: 'energyCrystal', name: 'Cristal de energía', icon: '💎', stack: 1, kind: 'part', description: 'Pieza para convertir la nave en barco.' },
}

export type Inventory = Partial<Record<ItemId, number>>
export type ToolId = 'axe' | 'hammer'
