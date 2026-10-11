import type { Inventory } from './items'

/**
 * Mejoras de las partes del robot (en el banco de la nave). Cada nivel cuesta
 * más; el metal escasea (solo sale de la nave), así que los primeros niveles
 * tiran sobre todo de madera, fibra y piedra.
 */
export type UpgradeId = 'battery' | 'legs' | 'solar' | 'sensors' | 'arms' | 'nightVision'

export type UpgradeDef = {
  id: UpgradeId
  name: string
  icon: string
  /** Qué hace cada nivel (índice 0 = nivel 1). */
  levels: { description: string; cost: Inventory }[]
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  battery: {
    id: 'battery',
    name: 'Batería',
    icon: '🔋',
    levels: [
      { description: '+30 % de autonomía', cost: { wood: 4, fiber: 4, scrapMetal: 1 } },
      { description: '+60 % de autonomía', cost: { stone: 4, scrapMetal: 2, techParts: 1 } },
      { description: '+90 % de autonomía', cost: { stone: 6, scrapMetal: 3, techParts: 2 } },
    ],
  },
  legs: {
    id: 'legs',
    name: 'Piernas',
    icon: '🦿',
    levels: [
      { description: '+10 % velocidad, salto más alto, -15 % gasto al correr', cost: { wood: 5, fiber: 3 } },
      { description: '+20 % velocidad, salto más alto, -30 % gasto al correr', cost: { wood: 4, stone: 3, scrapMetal: 2 } },
    ],
  },
  solar: {
    id: 'solar',
    name: 'Panel solar',
    icon: '☀️',
    levels: [
      { description: 'Carga solar +50 %', cost: { fiber: 4, scrapMetal: 1, techParts: 1 } },
      { description: 'Carga solar +100 %', cost: { stone: 3, scrapMetal: 2, techParts: 2 } },
    ],
  },
  sensors: {
    id: 'sensors',
    name: 'Gafas y sensores',
    icon: '🥽',
    levels: [
      { description: 'El polvo se pega un 35 % menos', cost: { fiber: 5, stone: 2 } },
      { description: 'El polvo se pega un 65 % menos', cost: { fiber: 4, scrapMetal: 2, techParts: 1 } },
    ],
  },
  arms: {
    id: 'arms',
    name: 'Brazos',
    icon: '💪',
    levels: [
      { description: 'Cada golpe cuenta doble en árboles y rocas', cost: { wood: 6, stone: 3 } },
    ],
  },
  nightVision: {
    id: 'nightVision',
    name: 'Visión nocturna',
    icon: '🌙',
    levels: [
      { description: 'Las gafas aclaran la noche (gasta batería mientras está encendida)', cost: { fiber: 3, scrapMetal: 1, techParts: 1 } },
    ],
  },
}

export type UpgradeLevels = Partial<Record<UpgradeId, number>>

/** Efectos numéricos según los niveles comprados (lo consultan los sistemas por frame). */
export function upgradeEffects(u: UpgradeLevels) {
  const lv = (id: UpgradeId) => u[id] ?? 0
  return {
    /** Divide todo el consumo (más capacidad con la misma carga en %). */
    capacity: 1 + 0.3 * lv('battery'),
    speed: 1 + 0.1 * lv('legs'),
    jump: 1 + 0.12 * lv('legs'),
    movingDrain: 1 - 0.15 * lv('legs'),
    solar: 1 + 0.5 * lv('solar'),
    dirt: 1 - [0, 0.35, 0.65][lv('sensors')],
    hitPower: lv('arms') > 0 ? 2 : 1,
    nightVision: lv('nightVision') > 0,
  }
}
