import { upgradeEffects } from '@/config/upgrades'
import { HARVEST } from '@/config/harvest'
import { ITEMS } from '@/config/items'
import { getGame } from '@/store/gameStore'
import { player } from '@/systems/player'
import { SALVAGE_NODES } from '@/config/world'

/** Energía (%) que cuesta cada golpe. */
const HIT_COST = 0.25
/** Tiempo mínimo entre golpes (s reales). */
const HIT_COOLDOWN = 0.35

let lastHit = 0

const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

/**
 * Ejecuta un golpe sobre el objetivo actual. Devuelve false si no se pudo
 * (sin objetivo, falta herramienta o en enfriamiento).
 */
export function performInteraction(): boolean {
  const game = getGame()
  const target = game.target
  if (!target || game.mode !== 'active') return false
  const now = performance.now() / 1000
  if (now - lastHit < HIT_COOLDOWN) return false

  const def = HARVEST[target.kind]
  if (def.tool && !game.inventory[def.tool]) {
    game.notify(`Necesitas ${ITEMS[def.tool].icon} ${ITEMS[def.tool].name}`, 'warn')
    return false
  }

  lastHit = now
  player.actionAt = now
  const fx = upgradeEffects(game.upgrades)
  game.addBattery(-HIT_COST / fx.capacity)
  // Los brazos mejorados rinden doble en recursos naturales (no en la nave ni en estructuras).
  const natural = target.kind === 'smallTree' || target.kind === 'palm' || target.kind === 'rock' || target.kind === 'shrub'
  const hits = game.addHit(target.key, natural ? fx.hitPower : 1)
  if (hits < def.hits) return true

  // --- Estructura propia: desmontar y recuperar la mitad ---
  if (target.kind === 'structure') {
    const refund = game.dismantleStructure(target.key.replace('struct|', ''))
    const text = (Object.entries(refund) as [keyof typeof ITEMS, number][]).map(([id, n]) => `+${n} ${ITEMS[id].icon}`).join('  ')
    game.notify(text ? `Desmontado ${text}` : 'Desmontado', 'info')
    game.resetHits(target.key)
    return true
  }

  // --- Completado: entregar recursos ---
  const gained: string[] = []
  let overflow = false
  for (const y of def.yields) {
    const amount = randInt(y.min, y.max)
    if (amount <= 0) continue
    const added = game.addItem(y.item, amount)
    if (added > 0) gained.push(`+${added} ${ITEMS[y.item].icon}`)
    if (added < amount) overflow = true
  }
  if (gained.length) game.notify(gained.join('  '), 'gain')
  if (overflow) game.notify('Inventario lleno para ese recurso', 'warn')

  // --- Puntos de chatarra con usos limitados ---
  if (def.uses !== undefined) {
    const id = target.key.replace('ship|', '')
    const node = SALVAGE_NODES.find((n) => n.id === id)
    if (node) {
      const left = (game.salvageUses[id] ?? def.uses) - 1
      game.setSalvageUses(id, left)
      if (left > 0) {
        game.resetHits(target.key) // aún queda material: se puede seguir desmontando
        return true
      }
    }
  }

  game.markHarvested(target.key, def.regrowHours === null ? -1 : game.totalHours + def.regrowHours)
  return true
}
