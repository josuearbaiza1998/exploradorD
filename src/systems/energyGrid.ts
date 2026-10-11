import { BANK_DISCHARGE_RATE, STRUCTURES } from '@/config/structures'
import { ROBOT } from '@/config/robot'
import { getGame } from '@/store/gameStore'
import { wind } from '@/systems/wind'

/** Distancia máxima panel → banco para cargarlo. */
const PANEL_TO_BANK = 9

export const energyStatus = {
  /** El robot está recibiendo energía de un panel o banco este frame. */
  charging: false,
}

/**
 * Red de energía del jugador, una vez por frame:
 *  - Los paneles cargan al robot si está cerca; si no, llenan los bancos cercanos.
 *  - Los bancos ceden su energía al robot cuando está al lado (útil de noche).
 * Devuelve la energía (%) que gana el robot este frame.
 */
export function updateEnergyGrid(
  px: number,
  pz: number,
  gameHours: number,
  solarFactor: number,
  robotCanCharge: boolean,
): number {
  const game = getGame()
  const robotFull = !robotCanCharge || game.battery >= ROBOT.batteryMax - 0.1
  let gained = 0
  const panels = game.structures.filter((s) => s.type === 'solarPanel')
  const banks = game.structures.filter((s) => s.type === 'batteryBank')
  const charges: Record<string, number> = { ...game.bankCharge }
  let changed = false

  // Generadores: paneles (sol, menos si tienen polvo) y molinos (viento, también de noche).
  const windPower = Math.max(0, Math.min(1, (wind.strength - 0.15) / 0.75))
  const generators = [...panels, ...game.structures.filter((s) => s.type === 'windTurbine')]
  for (const p of generators) {
    const def = STRUCTURES[p.type]
    const power =
      p.type === 'solarPanel'
        ? (def.solarRate ?? 0) * solarFactor * (1 - (game.panelDirt[p.id] ?? 0) * 0.85) * gameHours
        : (def.windRate ?? 0) * windPower * gameHours
    if (power <= 0) continue
    if (!robotFull && Math.hypot(px - p.x, pz - p.z) < (def.chargeRadius ?? 0)) {
      gained += power
      continue
    }
    const near = banks.filter((b) => Math.hypot(b.x - p.x, b.z - p.z) < PANEL_TO_BANK)
    for (const b of near) {
      const cap = STRUCTURES.batteryBank.bankCapacity ?? 0
      const next = Math.min(cap, (charges[b.id] ?? 0) + power / near.length)
      if (next !== charges[b.id]) {
        charges[b.id] = next
        changed = true
      }
    }
  }

  if (!robotFull) {
    for (const b of banks) {
      if (Math.hypot(px - b.x, pz - b.z) > (STRUCTURES.batteryBank.chargeRadius ?? 0)) continue
      const available = charges[b.id] ?? 0
      const draw = Math.min(available, BANK_DISCHARGE_RATE * gameHours)
      if (draw > 0) {
        charges[b.id] = available - draw
        gained += draw
        changed = true
      }
    }
  }

  if (changed) {
    // Escribir solo si algún banco cambió de forma apreciable (evita renders y guardados inútiles).
    const significant = Object.keys(charges).some((id) => Math.abs((game.bankCharge[id] ?? 0) - charges[id]) > 0.01)
    if (significant) writeBankCharges(charges)
  }
  energyStatus.charging = gained > 0
  return gained
}

function writeBankCharges(charges: Record<string, number>) {
  for (const [id, value] of Object.entries(charges)) {
    if (getGame().bankCharge[id] !== value) getGame().setBankCharge(id, value)
  }
}
