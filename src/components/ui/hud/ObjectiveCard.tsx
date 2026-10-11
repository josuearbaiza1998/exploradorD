import { useState } from 'react'
import { ITEMS, type Inventory, type ItemId } from '@/config/items'
import { RECIPES } from '@/config/recipes'
import { STRUCTURES } from '@/config/structures'
import { REPAIRS } from '@/config/repairs'
import { POIS } from '@/config/pois'
import { player } from '@/systems/player'

const CARDINALS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']
/** Dirección cardinal (norte = -Z) de un vector del mundo. */
const cardinal = (dx: number, dz: number) => CARDINALS[Math.round(((Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8]
import { getGame, useGameStore, type GameState } from '@/store/gameStore'

type Objective = { title: string; detail: string; cost?: Inventory }

const recipeCost = (id: string) => RECIPES.find((r) => r.id === id)?.cost ?? {}

/** Siguiente meta sugerida según el progreso (guía suave, sin flechas). */
function nextObjective(s: GameState): Objective {
  if (s.droppedBoxes.length > 0)
    return { title: 'Recupera tu mochila', detail: 'Búscala con el marcador 🎒 de la brújula.' }
  if (!s.inventory.axe)
    return { title: 'Fabrica el hacha', detail: 'Rompe arbustos y árboles secos, desmonta escombros de la nave.', cost: recipeCost('axe') }
  if (!s.inventory.hammer)
    return { title: 'Fabrica el martillo', detail: 'Fuerza los paneles del casco con el hacha para sacar componentes.', cost: recipeCost('hammer') }
  if (!s.structures.some((st) => st.type === 'solarPanel'))
    return { title: 'Construye un panel solar', detail: 'Mochila › Construir. Te recarga de día si estás cerca.', cost: STRUCTURES.solarPanel.cost }
  const repaired = REPAIRS.filter((r) => s.repairs[r.id]).length
  if (repaired < REPAIRS.length) {
    // Primero lo que ya se puede reparar; si no, explorar hacia el lugar más cercano sin abrir.
    const ready = REPAIRS.find((r) => !s.repairs[r.id] && s.hasItems(r.cost))
    if (ready) return { title: `Repara: ${ready.icon} ${ready.name}`, detail: 'Mochila › Nave, junto a la nave.', cost: ready.cost }
    const missing = POIS.filter((p) => !s.looted[p.id] && !s.inventory[p.part])
    if (missing.length && Object.keys(s.upgrades).length > 0) {
      const near = missing.reduce((a, b) =>
        Math.hypot(a.x - player.position.x, a.z - player.position.z) < Math.hypot(b.x - player.position.x, b.z - player.position.z) ? a : b,
      )
      const dir = cardinal(near.x - player.position.x, near.z - player.position.z)
      return {
        title: `Repara la nave (${repaired}/${REPAIRS.length})`,
        detail: s.discovered[near.id] ? `Abre el contenedor de ${near.name} (${dir}).` : `Faltan piezas. Explora hacia el ${dir}: algo destaca en el horizonte.`,
      }
    }
    if (!missing.length) {
      const next = REPAIRS.find((r) => !s.repairs[r.id])!
      return { title: `Repara: ${next.icon} ${next.name}`, detail: 'Reúne los materiales y repárala en la nave.', cost: next.cost }
    }
  }
  if (Object.keys(s.upgrades).length === 0)
    return { title: 'Mejora tu robot', detail: 'Mochila › Mejoras, junto a la nave.' }
  if (!s.upgrades.nightVision)
    return { title: 'Desbloquea la visión nocturna', detail: 'Mochila › Mejoras. Explorar de noche será más fácil.' }
  if (!s.structures.some((st) => st.type === 'shelter'))
    return { title: 'Levanta un refugio lejos de la nave', detail: 'Te protege del frío y de las tormentas.', cost: STRUCTURES.shelter.cost }
  return { title: 'Explora el desierto', detail: 'Mejora tus piezas al máximo y aguanta las tormentas.' }
}

/** Tarjeta de objetivo (debajo del estado). Se puede plegar tocándola. */
export function ObjectiveCard() {
  const [open, setOpen] = useState(true)
  // Se re-renderiza cuando cambia la meta o el inventario (para los contadores).
  useGameStore((s) => nextObjective(s).title)
  const inventory = useGameStore((s) => s.inventory)
  const objective = nextObjective(getGame())
  const hidden = useGameStore((s) => s.mode !== 'active')
  if (hidden) return null
  return (
    <button className={`hud-objective ${open ? '' : 'folded'}`} onClick={() => setOpen((o) => !o)}>
      <span className="hud-label">🎯 Objetivo</span>
      <strong>{objective.title}</strong>
      {open && (
        <>
          <span className="hud-objective-detail">{objective.detail}</span>
          {objective.cost && (
            <span className="recipe-cost">
              {(Object.entries(objective.cost) as [ItemId, number][]).map(([id, n]) => (
                <span key={id} className={(inventory[id] ?? 0) >= n ? 'have' : 'lack'}>
                  {ITEMS[id].icon} {Math.min(inventory[id] ?? 0, n)}/{n}
                </span>
              ))}
            </span>
          )}
        </>
      )}
    </button>
  )
}
