import { useEffect, useMemo, useState } from 'react'
import { carriedLoad, withStorage } from '@/store/slices/inventorySlice'
import { upgradeEffects } from '@/config/upgrades'
import { ITEMS, type ItemId } from '@/config/items'
import { RECIPES, WORKBENCH_RADIUS, type Recipe } from '@/config/recipes'
import { CHARGING_PAD } from '@/config/world'
import { getGame, useGameStore } from '@/store/gameStore'
import { player } from '@/systems/player'
import { STRUCTURES, type StructureType } from '@/config/structures'
import { CELL_CHARGE } from '@/config/robot'
import { UPGRADES, type UpgradeId } from '@/config/upgrades'
import { useUiStore, type InventoryTab } from '@/store/uiStore'
import { REPAIRS } from '@/config/repairs'
import { POIS } from '@/config/pois'

const nearWorkbench = () =>
  Math.hypot(player.position.x - CHARGING_PAD.x, player.position.z - CHARGING_PAD.z) < WORKBENCH_RADIUS

/** ¿Está junto al banco de la nave? (se revisa cada medio segundo). */
function useAtBench() {
  const [atBench, setAtBench] = useState(nearWorkbench)
  useEffect(() => {
    const id = window.setInterval(() => setAtBench(nearWorkbench()), 500)
    return () => window.clearInterval(id)
  }, [])
  return atBench
}

/** Materiales disponibles: junto a la nave cuenta también el almacén. */
function useHave(atBench: boolean) {
  const inventory = useGameStore((s) => s.inventory)
  const storage = useGameStore((s) => s.storage)
  return useMemo(() => (atBench ? withStorage(inventory, storage) : inventory), [atBench, inventory, storage])
}

/** Panel de mochila: inventario, fabricación, construcción y mejoras (lo abre la botonera del HUD). */
export function InventoryPanel() {
  const tab = useUiStore((s) => s.inventoryTab)
  if (!tab) return null
  return <Panel tab={tab} />
}

function Panel({ tab }: { tab: InventoryTab }) {
  const setTab = useUiStore((s) => s.openInventory)
  const onClose = useUiStore((s) => s.closeInventory)
  return (
    <div className="inv-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="inv-panel">
        <header>
          <div className="inv-tabs">
            <button className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>
              Mochila
            </button>
            <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>
              Construir
            </button>
            <button className={tab === 'upgrades' ? 'active' : ''} onClick={() => setTab('upgrades')}>
              Mejoras
            </button>
            <button className={tab === 'ship' ? 'active' : ''} onClick={() => setTab('ship')}>
              Nave
            </button>
          </div>
          <button className="inv-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        {tab === 'items' ? (
          <ItemsTab />
        ) : tab === 'build' ? (
          <BuildTab onClose={onClose} />
        ) : tab === 'ship' ? (
          <ShipTab />
        ) : (
          <UpgradesTab />
        )}
      </div>
    </div>
  )
}

function BuildTab({ onClose }: { onClose: () => void }) {
  const inventory = useGameStore((s) => s.inventory)
  return (
    <ul className="recipe-list build-list">
      {(Object.keys(STRUCTURES) as StructureType[]).map((type) => {
        const def = STRUCTURES[type]
        const affordable = (Object.entries(def.cost) as [ItemId, number][]).every(([id, n]) => (inventory[id] ?? 0) >= n)
        return (
          <li key={type} className={`recipe ${affordable ? '' : 'disabled'}`}>
            <span className="inv-icon">{def.icon}</span>
            <div className="recipe-info">
              <strong>{def.name}</strong>
              <span className="recipe-cost">
                {(Object.entries(def.cost) as [ItemId, number][]).map(([id, n]) => (
                  <span key={id} className={(inventory[id] ?? 0) >= n ? 'have' : 'lack'}>
                    {ITEMS[id].icon}
                    {inventory[id] ?? 0}/{n}
                  </span>
                ))}
              </span>
              <span className="recipe-desc">{def.description}</span>
            </div>
            <button
              disabled={!affordable}
              onClick={() => {
                getGame().startBuild(type)
                onClose()
              }}
            >
              {affordable ? 'Colocar' : 'Faltan materiales'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ItemsTab() {
  const inventory = useGameStore((s) => s.inventory)
  const sensorDirt = useGameStore((s) => s.sensorDirt)
  const atBench = useAtBench()
  const storage = useGameStore((s) => s.storage)
  const carry = useGameStore((s) => upgradeEffects(s.upgrades, !!s.inventory.drone).carry)
  const load = carriedLoad(inventory)

  const items = (Object.entries(inventory) as [ItemId, number][]).filter(([, n]) => n > 0)
  const stored = (Object.entries(storage) as [ItemId, number][]).filter(([, n]) => n > 0)

  return (
    <div className="inv-columns">
      <section>
        <h3>
          Inventario{' '}
          <span className={`carry ${load >= carry ? 'full' : ''}`}>
            <i style={{ width: `${Math.min(100, (load / carry) * 100)}%` }} />
            <b>
              Carga {load}/{carry}
            </b>
          </span>
        </h3>
        {items.length === 0 && (
          <p className="inv-empty">Vacío. Rompe árboles pequeños y arbustos, o desmonta escombros de la nave.</p>
        )}
        <ul className="inv-grid">
          {items.map(([id, n]) => (
            <li key={id} title={ITEMS[id].name}>
              <span className="inv-icon">{ITEMS[id].icon}</span>
              <span className="inv-count">{n}</span>
              <span className="inv-name">{ITEMS[id].name}</span>
              {id === 'cell' && (
                <button
                  className="inv-use"
                  onClick={() => {
                    if (getGame().removeItem('cell')) {
                      getGame().addBattery(CELL_CHARGE)
                      getGame().notify(`🔋 +${CELL_CHARGE}% batería`, 'info')
                    }
                  }}
                >
                  Usar
                </button>
              )}
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
        {atBench && (
          <div className="storage">
            <h3>
              Almacén de la nave{' '}
              <button
                className="inv-use"
                disabled={load === 0}
                onClick={() => {
                  const n = getGame().storeAll()
                  if (n) getGame().notify(`📦 ${n} guardados en la nave`, 'info')
                }}
              >
                Guardar todo
              </button>
            </h3>
            {stored.length === 0 ? (
              <p className="inv-empty">Vacío. Lo guardado aquí se usa al fabricar, mejorar y reparar junto a la nave.</p>
            ) : (
              <ul className="inv-grid">
                {stored.map(([id, n]) => (
                  <li key={id} title={ITEMS[id].name}>
                    <span className="inv-icon">{ITEMS[id].icon}</span>
                    <span className="inv-count">{n}</span>
                    <span className="inv-name">{ITEMS[id].name}</span>
                    <button className="inv-use" disabled={load >= carry} onClick={() => getGame().takeFromStorage(id, 5)}>
                      Sacar 5
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
  )
}

function RecipeRow({ recipe, atBench }: { recipe: Recipe; atBench: boolean }) {
  const inventory = useHave(atBench)
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

/** Mejoras de las partes del robot: solo en el banco de la nave. */
function UpgradesTab() {
  const upgrades = useGameStore((s) => s.upgrades)
  const atBench = useAtBench()
  const inventory = useHave(atBench)
  return (
    <>
      <p className="inv-hint">
        {atBench ? <em className="inv-bench on">En el banco de la nave</em> : <em className="inv-bench">Acércate a la nave para instalar mejoras</em>}
      </p>
      <ul className="recipe-list upgrade-list">
        {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
          const def = UPGRADES[id]
          const level = upgrades[id] ?? 0
          const next = def.levels[level]
          const affordable = !!next && (Object.entries(next.cost) as [ItemId, number][]).every(([i, n]) => (inventory[i] ?? 0) >= n)
          let reason = ''
          if (!next) reason = 'Al máximo'
          else if (!atBench) reason = 'En la nave'
          else if (!affordable) reason = 'Faltan materiales'
          return (
            <li key={id} className={`recipe ${reason ? 'disabled' : ''}`}>
              <span className="inv-icon">{def.icon}</span>
              <div className="recipe-info">
                <strong>
                  {def.name}{' '}
                  <span className="upgrade-pips">
                    {def.levels.map((_, i) => (
                      <i key={i} className={i < level ? 'on' : ''} />
                    ))}
                  </span>
                </strong>
                {next ? (
                  <>
                    <span className="recipe-desc">Nivel {level + 1}: {next.description}</span>
                    <span className="recipe-cost">
                      {(Object.entries(next.cost) as [ItemId, number][]).map(([i, n]) => (
                        <span key={i} className={(inventory[i] ?? 0) >= n ? 'have' : 'lack'}>
                          {ITEMS[i].icon}
                          {inventory[i] ?? 0}/{n}
                        </span>
                      ))}
                    </span>
                  </>
                ) : (
                  <span className="recipe-desc">{def.levels[def.levels.length - 1].description}</span>
                )}
              </div>
              <button
                disabled={!!reason}
                onClick={() => {
                  if (getGame().buyUpgrade(id, atBench)) getGame().notify(`Mejora instalada: ${def.icon} ${def.name}`, 'info')
                }}
              >
                {reason || 'Instalar'}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Objetivo principal: adaptar la nave como barco con piezas únicas de los lugares por descubrir. */
function ShipTab() {
  const repairs = useGameStore((s) => s.repairs)
  const discovered = useGameStore((s) => s.discovered)
  const atBench = useAtBench()
  const inventory = useHave(atBench)
  const done = REPAIRS.filter((r) => repairs[r.id]).length
  return (
    <>
      <p className="inv-hint">
        <span className="repair-progress">
          <i style={{ width: `${(done / REPAIRS.length) * 100}%` }} />
        </span>
        Barco: {done}/{REPAIRS.length}
        {' · '}
        {atBench ? <em className="inv-bench on">junto a la nave</em> : <em className="inv-bench">acércate a la nave para montarlo</em>}
      </p>
      <ul className="recipe-list upgrade-list">
        {REPAIRS.map((r) => {
          const fixed = !!repairs[r.id]
          const affordable = (Object.entries(r.cost) as [ItemId, number][]).every(([i, n]) => (inventory[i] ?? 0) >= n)
          const part = (Object.keys(r.cost) as ItemId[]).find((i) => ITEMS[i].kind === 'part')
          const source = POIS.find((p) => p.part === part)
          let reason = ''
          if (fixed) reason = 'Hecho ✓'
          else if (!atBench) reason = 'En la nave'
          else if (!affordable) reason = 'Faltan piezas'
          return (
            <li key={r.id} className={`recipe ${reason ? 'disabled' : ''} ${fixed ? 'fixed' : ''}`}>
              <span className="inv-icon">{r.icon}</span>
              <div className="recipe-info">
                <strong>{r.name}</strong>
                <span className="recipe-desc">{r.description}</span>
                {!fixed && (
                  <>
                    <span className="recipe-cost">
                      {(Object.entries(r.cost) as [ItemId, number][]).map(([i, n]) => (
                        <span key={i} className={(inventory[i] ?? 0) >= n ? 'have' : 'lack'}>
                          {ITEMS[i].icon}
                          {inventory[i] ?? 0}/{n}
                        </span>
                      ))}
                    </span>
                    {part && !inventory[part] && source && (
                      <span className="recipe-desc">
                        {ITEMS[part].name}: {discovered[source.id] ? `en ${source.name}` : 'en algún lugar sin descubrir'}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                disabled={!!reason}
                onClick={() => {
                  if (getGame().repair(r.id, atBench)) getGame().notify(`Barco: ${r.icon} ${r.name} listo`, 'info')
                }}
              >
                {reason || 'Montar'}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
