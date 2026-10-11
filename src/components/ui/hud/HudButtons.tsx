import { useGameStore, getGame } from '@/store/gameStore'
import { useUiStore } from '@/store/uiStore'
import { cleanSensorsWithBestTool } from '@/systems/sensorCleaning'
import { playClick } from '@/systems/audio/audioEngine'
import { carriedLoad } from '@/store/slices/inventorySlice'
import { upgradeEffects } from '@/config/upgrades'

/** Botonera superior derecha: mochila, limpiar, visión nocturna y menú. */
export function HudButtons() {
  const openInventory = useUiStore((s) => s.openInventory)
  const cleanTool = useGameStore((s) => (s.inventory.sonicCleaner ? 'sonic' : (s.inventory.cloth ?? 0) > 0 ? 'cloth' : null))
  const cloths = useGameStore((s) => s.inventory.cloth ?? 0)
  const dirty = useGameStore((s) => s.sensorDirt > 0.25)
  const hasNv = useGameStore((s) => !!s.upgrades.nightVision)
  const nvOn = useGameStore((s) => s.nightVisionOn)
  const load = useGameStore((s) => carriedLoad(s.inventory))
  const carry = useGameStore((s) => upgradeEffects(s.upgrades, !!s.inventory.drone).carry)

  return (
    <div className="hud-buttons">
      <button
        className="hud-btn bag"
        aria-label="Mochila"
        onClick={() => {
          playClick()
          openInventory()
        }}
      >
        🎒<span className="hud-btn-label">Mochila</span>
        {load > 0 && <span className={`hud-badge ${load >= carry ? 'full' : ''}`}>{load >= carry ? 'llena' : load}</span>}
      </button>
      {cleanTool && (
        <button className={`hud-btn ${dirty ? 'attention' : ''}`} aria-label="Limpiar sensores" onClick={cleanSensorsWithBestTool}>
          {cleanTool === 'sonic' ? '📡' : '🧽'}
          {cleanTool === 'cloth' && <span className="hud-badge">{cloths}</span>}
        </button>
      )}
      {hasNv && (
        <button
          className={`hud-btn ${nvOn ? 'on' : ''}`}
          aria-label="Visión nocturna"
          onClick={() => {
            playClick()
            getGame().toggleNightVision()
          }}
        >
          🌙
        </button>
      )}
      <button
        className="hud-btn"
        aria-label="Menú"
        onClick={() => {
          playClick()
          useUiStore.getState().openMenu()
        }}
      >
        ☰
      </button>
    </div>
  )
}
