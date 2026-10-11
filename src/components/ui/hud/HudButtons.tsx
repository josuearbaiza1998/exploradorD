import { useEffect, useState } from 'react'
import { useGameStore, getGame } from '@/store/gameStore'
import { useUiStore } from '@/store/uiStore'
import { cleanSensorsWithBestTool } from '@/systems/sensorCleaning'
import { isMuted, onMuteChange, playClick, setMuted, unlockAudio } from '@/systems/audio/audioEngine'
import { InstallButton } from './InstallButton'

/** Botonera superior derecha: mochila, limpiar, visión nocturna, sonido e instalar. */
export function HudButtons() {
  const openInventory = useUiStore((s) => s.openInventory)
  const cleanTool = useGameStore((s) => (s.inventory.sonicCleaner ? 'sonic' : (s.inventory.cloth ?? 0) > 0 ? 'cloth' : null))
  const cloths = useGameStore((s) => s.inventory.cloth ?? 0)
  const dirty = useGameStore((s) => s.sensorDirt > 0.25)
  const hasNv = useGameStore((s) => !!s.upgrades.nightVision)
  const nvOn = useGameStore((s) => s.nightVisionOn)
  const items = useGameStore((s) => Object.values(s.inventory).reduce((a, n) => a + (n ?? 0), 0))
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMuteChange(setMutedState), [])

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
        {items > 0 && <span className="hud-badge">{items}</span>}
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
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        onClick={() => {
          unlockAudio()
          setMuted(!muted)
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <InstallButton />
    </div>
  )
}
