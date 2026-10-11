import { useEffect, useState } from 'react'
import { NOTES } from '@/config/notes'
import { restartGame, useGameStore } from '@/store/gameStore'
import { QUALITY, perfStats, qualityLevel, useSettings, type QualityMode } from '@/store/settingsStore'
import type { JournalKind } from '@/store/slices/explorationSlice'
import { useUiStore } from '@/store/uiStore'
import { isMuted, onMuteChange, playClick, setMuted, unlockAudio } from '@/systems/audio/audioEngine'
import { InstallButton } from '@/components/ui/hud/InstallButton'

/** Menú del juego: bitácora, ajustes y reiniciar la partida. */
export function GameMenu() {
  const view = useUiStore((s) => s.menu)
  if (!view) return null
  return (
    <div className="inv-backdrop" onPointerDown={(e) => e.target === e.currentTarget && useUiStore.getState().closeMenu()}>
      <div className="inv-panel menu-panel">
        <header>
          <div className="inv-tabs">
            <button className={view === 'main' ? 'active' : ''} onClick={() => useUiStore.getState().openMenu('main')}>
              Menú
            </button>
            <button className={view === 'journal' ? 'active' : ''} onClick={() => useUiStore.getState().openMenu('journal')}>
              Bitácora
            </button>
          </div>
          <button className="inv-close" onClick={() => useUiStore.getState().closeMenu()} aria-label="Cerrar">
            ✕
          </button>
        </header>
        {view === 'main' ? <MainMenu /> : <Journal />}
      </div>
    </div>
  )
}

function MainMenu() {
  const mode = useSettings((s) => s.mode)
  const minimap = useSettings((s) => s.minimap)
  const level = useSettings(qualityLevel)
  const [muted, setMutedState] = useState(isMuted)
  const [fps, setFps] = useState(Math.round(perfStats.fps))
  const [confirm, setConfirm] = useState(false)
  useEffect(() => onMuteChange(setMutedState), [])
  useEffect(() => {
    const id = window.setInterval(() => setFps(Math.round(perfStats.fps)), 500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="menu-list">
      <div className="menu-row">
        <span>Sonido</span>
        <button
          className="inv-use"
          onClick={() => {
            unlockAudio()
            setMuted(!muted)
          }}
        >
          {muted ? '🔇 Apagado' : '🔊 Encendido'}
        </button>
      </div>
      <div className="menu-row">
        <span>
          Minimapa
          <em className="menu-hint">Solo muestra lo que ya has explorado</em>
        </span>
        <button
          className="inv-use"
          onClick={() => {
            playClick()
            useSettings.getState().setMinimap(!minimap)
          }}
        >
          {minimap ? '🗺️ Encendido' : '🚫 Apagado'}
        </button>
      </div>
      <div className="menu-row">
        <span>
          Calidad gráfica
          <em className="menu-hint">
            {fps} fps · {QUALITY[level].label}
            {mode === 'auto' ? ' (automática)' : ''}
          </em>
        </span>
        <div className="seg">
          {(['auto', 'low', 'medium', 'high'] as QualityMode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'active' : ''}
              onClick={() => {
                playClick()
                useSettings.getState().setMode(m)
              }}
            >
              {m === 'auto' ? 'Auto' : QUALITY[m].label}
            </button>
          ))}
        </div>
      </div>
      <div className="menu-row">
        <span>Pantalla</span>
        <div className="menu-buttons">
          <InstallButton />
        </div>
      </div>
      <div className="menu-row danger">
        <span>
          Reiniciar partida
          <em className="menu-hint">Se borra todo el progreso. Los ajustes se conservan.</em>
        </span>
        {confirm ? (
          <div className="menu-buttons">
            <button className="inv-use" onClick={() => setConfirm(false)}>
              Cancelar
            </button>
            <button className="inv-use danger" onClick={restartGame}>
              Sí, reiniciar
            </button>
          </div>
        ) : (
          <button className="inv-use danger" onClick={() => setConfirm(true)}>
            Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}

const FILTERS: { id: 'all' | JournalKind | 'items'; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'note', label: 'Registros' },
  { id: 'items', label: 'Piezas y mejoras' },
  { id: 'place', label: 'Lugares' },
]

/** Bitácora: notas leídas, piezas encontradas, mejoras y reparaciones, lo último arriba. */
function Journal() {
  const journal = useGameStore((s) => s.journal)
  const notesRead = useGameStore((s) => Object.keys(s.notesRead).length)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const list = journal
    .filter((e) => filter === 'all' || e.kind === filter || (filter === 'items' && e.kind !== 'note' && e.kind !== 'place'))
    .slice()
    .reverse()
  return (
    <>
      <div className="seg journal-filters">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
        <em className="menu-hint">
          Registros {notesRead}/{NOTES.length}
        </em>
      </div>
      {list.length === 0 ? (
        <p className="inv-empty">Aún no hay nada aquí. Explora: los registros, las piezas y las mejoras se anotan solos.</p>
      ) : (
        <ul className="journal">
          {list.map((e) => (
            <li key={e.id}>
              <span className="inv-icon">{e.icon}</span>
              <div>
                <strong>{e.title}</strong>
                <span className="journal-day">Día {Math.floor(e.at / 24) + 1}</span>
                {e.text && <p>{e.text}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Registro abierto para leer (al interactuar con una tableta). */
export function NoteModal() {
  const id = useUiStore((s) => s.note)
  const note = NOTES.find((n) => n.id === id)
  if (!note) return null
  return (
    <div className="inv-backdrop" onPointerDown={(e) => e.target === e.currentTarget && useUiStore.getState().closeNote()}>
      <div className="install-help note-card">
        <h3>📜 {note.title}</h3>
        <p>{note.text}</p>
        <p className="menu-hint">Guardado en la bitácora (Menú › Bitácora).</p>
        <button className="install-ok" onClick={() => useUiStore.getState().closeNote()}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
