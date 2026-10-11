import type { ModelId } from '@/assets/models'
import type { HarvestKind } from './harvest'
import { OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'
import { oasisProximity, type ScatterRule } from '@/utils/scatter'

/**
 * Capas de props distribuidos por chunk. Solo DATOS (sin materiales ni
 * React): las usan tanto el render (<Vegetation/>) como la física
 * (colisiones), así lo que se ve y lo que bloquea son siempre lo mismo.
 */
export type PropLayerId = 'palms' | 'oasisShrubs' | 'dryShrubs' | 'smallTrees' | 'cacti' | 'rocks'

export type PropLayer = {
  id: PropLayerId
  model: ModelId
  rule: ScatterRule
  /** Radio de colisión en unidades del modelo (se multiplica por la escala). Sin valor = se atraviesa. */
  colliderRadius?: number
  /** Altura del colisionador en unidades del modelo (para que la cámara no lo atraviese). */
  colliderHeight?: number
  /** Si se puede recolectar, qué tipo de recurso es (ver config/harvest.ts). */
  harvest?: HarvestKind
}

export const PROP_LAYERS: PropLayer[] = [
  {
    id: 'palms',
    harvest: 'palm',
    model: 'palmTree',
    rule: {
      seed: 1,
      cellsPerSide: 10,
      probability: (x, z) => oasisProximity(x, z, 1.9) * 0.9,
      maxSlope: 0.5,
      minHeight: OASIS_WATER_LEVEL + 0.15,
      scale: [0.85, 1.25],
      tilt: 0.12,
    },
    colliderRadius: 0.4,
    colliderHeight: 8,
  },
  {
    id: 'oasisShrubs',
    harvest: 'shrub',
    model: 'shrub',
    rule: {
      seed: 2,
      cellsPerSide: 16,
      probability: (x, z) => oasisProximity(x, z, 2.3) * 0.8,
      maxSlope: 0.7,
      minHeight: OASIS_WATER_LEVEL + 0.1,
      scale: [0.7, 1.4],
    },
  },
  {
    id: 'dryShrubs',
    harvest: 'shrub',
    model: 'shrub',
    rule: {
      seed: 3,
      cellsPerSide: 9,
      probability: (x, z) => 0.22 * (1 - oasisProximity(x, z, 2.5)),
      maxSlope: 0.45,
      maxHeight: 14,
      scale: [0.5, 1.0],
    },
  },
  {
    // Árboles pequeños: los que el robot podrá romper sin herramientas.
    id: 'smallTrees',
    harvest: 'smallTree',
    model: 'smallTree',
    rule: {
      seed: 4,
      cellsPerSide: 6,
      probability: (x, z) => 0.12 + oasisProximity(x, z, 3) * 0.3,
      maxSlope: 0.4,
      maxHeight: 12,
      scale: [0.8, 1.3],
      tilt: 0.1,
    },
    colliderRadius: 0.25,
    colliderHeight: 2.6,
  },
  {
    id: 'cacti',
    model: 'cactus',
    rule: {
      seed: 5,
      cellsPerSide: 6,
      probability: (x, z) => 0.1 * (1 - oasisProximity(x, z, 2.5)),
      maxSlope: 0.4,
      scale: [0.8, 1.5],
    },
    colliderRadius: 0.45,
    colliderHeight: 2.6,
  },
  {
    // Rocas: en la Fase 4 requerirán herramientas para minarse.
    id: 'rocks',
    harvest: 'rock',
    model: 'rock',
    rule: {
      seed: 6,
      cellsPerSide: 7,
      probability: () => 0.18,
      maxSlope: 1.2,
      scale: [0.6, 2.4],
      tilt: 0.4,
    },
    colliderRadius: 1.05,
    colliderHeight: 1.25,
  },
]
