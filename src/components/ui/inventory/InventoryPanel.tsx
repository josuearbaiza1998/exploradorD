import { useEffect, useState } from 'react'
import { ITEMS, type ItemId } from '@/config/items'
import { RECIPES, WORKBENCH_RADIUS, type Recipe } from '@/config/recipes'
import { CHARGING_PAD } from '@/config/world'
import { getGame, useGameStore } from '@/store/gameStore'
import { player } from '@/systems/player'

const nearWorkbench = () =>
  Math.hypot(player.position.x - CHARGING_PAD.x, player.position.z - CHARGING_PAD.z) < WORKBENCH_RADIUS

/** Botón de mochila (esquina superior izquierda) + panel de inventario y fabricación. */
export function InventoryPanel() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="bag-btn" aria-label="Mochila" onClick={() => setOpen(true)}>
        🎒
      </button>
      {open && <Panel onClose={() => setOpen(false)} />}
    </>
  )
}

function Panel({ onClose }: { onClose: () => void }) {
  const inventory = useGameStore((s) => s.inventory)
  const sensorDirt = useGameStore((s) => s.sensorDirt)
  const [atBench, setAtBench] = useState(nearWorkbench)

  useEffect(() => {
    const id = window.setInterval(() => setAtBench(nearWorkbench()), 500)
    return () => window.clearInterval(id)
  }, [])

  const items = (Object.entries(inventory) as [ItemId, number][]).filter(([, n]) => n > 0)

  return (
    <div className="inv-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="inv-panel">
        <header>
          <h2>Mochila</h2>
          <button className="inv-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <div className="inv-columns">
          <section>
            <h3>Inventario</h3>
            {items.length === 0 && (
              <p className="inv-empty">Vacío. Rompe árboles pequeños y arbustos, o desmonta escombros de la nave.</p>
            )}
            <ul className="inv-grid">
              {items.map(([id, n]) => (
                <li key={id} title={ITEMS[id].name}>
                  <span className="inv-icon">{ITEMS[id].icon}</span>
                  <span className="inv-count">{n}</span>
                  <span className="inv-name">{ITEMS[id].name}</span>
                  {id === 'cloth' && (
                    <button
                      className="inv-use"
                      disabled={sensorDirt < 0.02}
                      onClick={() => {
                        if (getGame().removeItem('cloth')) {
                          getGame().cleanSensors(0.6)
                          getGame().notify('🧽 Sensores limpios', 'info')
                        }
                      }}
                    >
                      Limpiar sensores
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>
              Fabricar{' '}
              {atBench ? <em className="inv-bench on">· banco de la nave</em> : <em className="inv-bench">· lejos de la nave</em>}
            </h3>
            <ul className="recipe-list">
              {RECIPES.map((r) => (
                <RecipeRow key={r.id} recipe={r} atBench={atBench} />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function RecipeRow({ recipe, atBench }: { recipe: Recipe; atBench: boolean }) {
  const inventory = useGameStore((s) => s.inventory)
  const out = ITEMS[recipe.output]
  const owned = out.kind === 'tool' && !!inventory[recipe.output]
  const missingTool = recipe.requires && !inventory[recipe.requires]
  const affordable = (Object.entries(recipe.cost) as [ItemId, number][]).every(([id, n]) => (inventory[id] ?? 0) >= n)
  const needsBench = recipe.station === 'ship' && !atBench

  let reason = ''
  if (owned) reason = 'Ya la tienes'
  else if (missingTool) reason = `Primero: ${ITEMS[recipe.requires!].name}`
  else if (needsBench) reason = 'Hazlo junto a la nave'
  else if (!affordable) reason = 'Faltan materiales'

  return (
    <li className={`recipe ${reason ? 'disabled' : ''}`}>
      <span className="inv-icon">{out.icon}</span>
      <div className="recipe-info">
        <strong>{out.name}</strong>
        <span className="recipe-cost">
          {(Object.entries(recipe.cost) as [ItemId, number][]).map(([id, n]) => (
            <span key={id} className={(inventory[id] ?? 0) >= n ? 'have' : 'lack'}>
              {ITEMS[id].icon}
              {inventory[id] ?? 0}/{n}
            </span>
          ))}
        </span>
        {out.description && <span className="recipe-desc">{out.description}</span>}
      </div>
      <button
        disabled={!!reason}
        onClick={() => {
          if (getGame().craft(recipe, atBench)) getGame().notify(`Fabricado: ${out.icon} ${out.name}`, 'info')
        }}
      >
        {reason || 'Fabricar'}
      </button>
    </li>
  )
}
