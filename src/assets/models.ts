/**
 * Registro central de modelos 3D.
 *
 * Mientras una ruta sea `null`, el componente dibuja su primitiva temporal.
 * Cuando tengas el .glb final: cópialo a /public/models y pon aquí la ruta
 * (ej. '/models/ship.glb'). No hay que tocar ningún componente.
 */
export const MODEL_PATHS = {
  robot: '/models/robot.glb',
  crashedShip: null,
  palmTree: null,
  shrub: null,
  smallTree: null,
  cactus: null,
  rock: null,
  mesa: null,
  inventoryBox: null,
  solarPanel: null,
  batteryBank: null,
  shelter: null,
} satisfies Record<string, string | null>

export type ModelId = keyof typeof MODEL_PATHS

export function modelPath(id: ModelId): string | null {
  return MODEL_PATHS[id] as string | null
}
