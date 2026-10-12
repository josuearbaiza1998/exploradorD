import type { Inventory } from './items'

/**
 * Mejoras de las partes del robot (en el banco de la nave). Cada nivel cuesta
 * más; el metal escasea (solo sale de la nave), así que los primeros niveles
 * tiran sobre todo de madera, fibra y piedra.
 */
/** Carga base de la mochila. */
export const CARRY_BASE = 30
/** Carga extra que lleva el dron. */
export const DRONE_CARRY = 10

export type UpgradeId = 'battery' | 'legs' | 'solar' | 'sensors' | 'arms' | 'nightVision' | 'backpack' | 'climb' | 'diving'

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
      { description: '+10 % velocidad, sprint más rápido, salto más alto, -15 % gasto al correr', cost: { wood: 5, fiber: 3 } },
      { description: '+20 % velocidad, sprint aún más rápido, salto más alto, -30 % gasto al correr', cost: { wood: 4, stone: 3, scrapMetal: 2 } },
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
  backpack: {
    id: 'backpack',
    name: 'Mochila',
    icon: '🎒',
    levels: [
      { description: `Carga ${CARRY_BASE + 15} (antes ${CARRY_BASE})`, cost: { fiber: 6, wood: 4 } },
      { description: `Carga ${CARRY_BASE + 35}`, cost: { fiber: 6, scrapMetal: 2, techParts: 1 } },
      { description: `Carga ${CARRY_BASE + 60}`, cost: { stone: 6, scrapMetal: 3, techParts: 2 } },
    ],
  },
  climb: {
    id: 'climb',
    name: 'Garras de escalada',
    icon: '🧗',
    levels: [
      { description: 'Permite escalar paredes de roca, como la colina de la baliza', cost: { fiber: 6, stone: 4, scrapMetal: 2 } },
      { description: 'Escala un 50 % más rápido y gasta menos batería al trepar', cost: { stone: 4, scrapMetal: 2, crystal: 3 } },
    ],
  },
  diving: {
    id: 'diving',
    name: 'Sellado estanco',
    icon: '🤿',
    levels: [
      { description: 'Juntas selladas: nada en agua honda y bucea (⤒ subir, ⤓ bajar). Nadando gasta más batería', cost: { fiber: 6, scrapMetal: 3, techParts: 1 } },
      { description: 'Nada y bucea más rápido y gasta menos batería en el agua', cost: { scrapMetal: 3, techParts: 2, crystal: 2 } },
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
export function upgradeEffects(u: UpgradeLevels, drone = false) {
  const lv = (id: UpgradeId) => u[id] ?? 0
  return {
    /** Divide todo el consumo (más capacidad con la misma carga en %). */
    capacity: 1 + 0.3 * lv('battery'),
    speed: 1 + 0.1 * lv('legs'),
    /** Multiplicador de velocidad al esprintar (disponible desde el principio). */
    sprint: 1.45 + 0.12 * lv('legs'),
    jump: 1 + 0.12 * lv('legs'),
    movingDrain: 1 - 0.15 * lv('legs'),
    solar: 1 + 0.5 * lv('solar'),
    dirt: 1 - [0, 0.35, 0.65][lv('sensors')],
    hitPower: lv('arms') > 0 ? 2 : 1,
    nightVision: lv('nightVision') > 0,
    /** Nivel de garras: 0 = no puede trepar paredes de roca. */
    climb: lv('climb'),
    /** Velocidad al trepar (m/s). */
    climbSpeed: [0, 1.7, 2.6][lv('climb')],
    /** Multiplicador del gasto mientras trepa. */
    climbDrain: [1, 1.8, 1.3][lv('climb')],
    /** Nivel de sellado: 0 = no puede meterse en agua honda. */
    dive: lv('diving'),
    /** Multiplicador de velocidad caminando por el fondo. */
    diveSpeed: [0.55, 0.6, 0.85][lv('diving')],
    swimSpeed: [0.5, 0.5, 0.7][lv('diving')],
    swimDrain: [1, 1.4, 1.2][lv('diving')],
    /** Multiplicador del gasto de batería sumergido. */
    diveDrain: [1, 2.2, 1.5][lv('diving')],
    /** Carga máxima de la mochila (recursos y consumibles; herramientas y piezas no ocupan). */
    carry: CARRY_BASE + [0, 15, 35, 60][lv('backpack')] + (drone ? DRONE_CARRY : 0),
  }
}
