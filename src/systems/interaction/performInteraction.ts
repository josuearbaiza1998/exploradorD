import { ecology } from '@/systems/ecology'
import { emitFloatText, emitHit } from '@/systems/hitFx'
import { upgradeEffects } from '@/config/upgrades'
import { HARVEST } from '@/config/harvest'
import { ITEMS } from '@/config/items'
import { getGame } from '@/store/gameStore'
import { player } from '@/systems/player'
import { SALVAGE_NODES } from '@/config/world'
import { POIS, type PoiId } from '@/config/pois'
import { useUiStore } from '@/store/uiStore'
import { knockScavenger } from '@/systems/scavengers'
import { COLLECTOR_USE } from '@/config/structures'
import { thermal } from '@/systems/thermal'
import { boardBoat, disembark } from '@/systems/boat'

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

  // Barco: subir y bajar no gasta energía ni cuenta golpes.
  if (target.kind === 'boat' || target.kind === 'disembark') {
    lastHit = now
    if (target.kind === 'boat') boardBoat()
    else disembark(target.position[0], target.position[2])
    return true
  }

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
  const [tx, ty, tz] = target.position
  emitHit({ material: def.material, x: tx, y: ty, z: tz, final: hits >= def.hits })
  if (hits < def.hits) return true

  // --- Registro: se abre para leerlo ---
  if (target.kind === 'note') {
    const id = target.key.slice(5)
    game.readNote(id)
    useUiStore.getState().openNote(id)
    game.resetHits(target.key)
    return true
  }

  // --- Contenedor de un lugar por descubrir: pieza única + botín ---
  if (target.kind === 'cache') {
    const id = target.key.replace('poi|', '') as PoiId
    const got = game.lootPoi(id)
    const text = (Object.entries(got) as [keyof typeof ITEMS, number][]).map(([i, n]) => `+${n} ${ITEMS[i].icon}`).join('  ')
    const part = POIS.find((p) => p.id === id)?.part
    if (part) game.notify(`Pieza encontrada: ${ITEMS[part].icon} ${ITEMS[part].name}`, 'gain')
    if (text) emitFloatText({ text, x: tx, y: ty, z: tz })
    game.resetHits(target.key)
    return true
  }

  // --- Panel solar con arena: limpio y rindiendo de nuevo ---
  if (target.key.startsWith('clean|')) {
    const id = target.key.slice(6)
    game.setStructureState({ panelDirt: { ...game.panelDirt, [id]: 0 } })
    game.notify('🔆 Panel limpio: vuelve a cargar a pleno sol', 'info')
    game.resetHits(target.key)
    return true
  }

  // --- Colector de lluvia: agua fresca para el robot ---
  if (target.key.startsWith('water|')) {
    const id = target.key.slice(6)
    game.setStructureState({ water: { ...game.water, [id]: Math.max(0, (game.water[id] ?? 0) - COLLECTOR_USE) } })
    thermal.heat = 0
    thermal.overheated = false
    game.cleanSensors(1)
    game.notify('💧 Agua fresca: robot refrigerado y gafas limpias', 'gain')
    game.resetHits(target.key)
    return true
  }

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
    let amount = randInt(y.min, y.max)
    // Las plantas dan más fibra con el suelo húmedo y menos en plena sequía.
    if (y.item === 'fiber' && def.material === 'plant') amount += ecology.moisture > 0.65 ? 1 : ecology.moisture < 0.2 ? -1 : 0
    if (amount <= 0) continue
    const added = game.addItem(y.item, amount)
    if (added > 0) gained.push(`+${added} ${ITEMS[y.item].icon}`)
    if (added < amount) overflow = true
  }
  if (gained.length) {
    game.notify(gained.join('  '), 'gain')
    emitFloatText({ text: gained.join('  '), x: tx, y: ty, z: tz })
  }
  if (overflow) game.notify('🎒 Mochila llena: guarda en la nave o mejora la mochila', 'warn')

  // --- Carroñero: suelta lo que había robado y se apaga un rato ---
  if (target.key.startsWith('scav|')) {
    const loot = knockScavenger(Number(target.key.slice(5)))
    const back: string[] = []
    for (const [id, n] of Object.entries(loot) as [keyof typeof ITEMS, number][]) {
      const added = game.addItem(id, n)
      if (added > 0) back.push(`+${added} ${ITEMS[id].icon}`)
    }
    if (back.length) game.notify(`Recuperado del carroñero: ${back.join('  ')}`, 'gain')
    game.resetHits(target.key)
    return true
  }

  // --- Hallazgos del clima: desaparecen al recogerlos ---
  if (target.key.startsWith('find|')) {
    game.removeFind(target.key.slice(5))
    game.resetHits(target.key)
    return true
  }

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
