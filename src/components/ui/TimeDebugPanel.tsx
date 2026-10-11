import { useEffect, useState } from 'react'
import { ambientTemperature, worldClock } from '@/systems/worldClock'

const SPEEDS = [1, 10, 60]

/**
 * Panel de depuración (solo Fase 1) para revisar el ciclo día/noche.
 * No forma parte de la UI final: el juego evitará barras y HUD intrusivos.
 */
export function TimeDebugPanel() {
  const [, force] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [])

  const hh = Math.floor(worldClock.hour)
  const mm = Math.floor((worldClock.hour - hh) * 60)
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`

  return (
    <div className="debug-panel">
      <button className="debug-chip" onClick={() => setOpen((o) => !o)}>
        {time} · {Math.round(ambientTemperature(worldClock.hour))}°C
      </button>
      {open && (
        <div className="debug-body">
          <input
            type="range"
            min={0}
            max={23.99}
            step={0.05}
            value={worldClock.hour}
            onChange={(e) => {
              worldClock.hour = Number(e.target.value)
              force((n) => n + 1)
            }}
          />
          <div className="debug-row">
            {SPEEDS.map((s) => (
              <button
                key={s}
                className={worldClock.speed === s ? 'active' : ''}
                onClick={() => {
                  worldClock.speed = s
                  force((n) => n + 1)
                }}
              >
                x{s}
              </button>
            ))}
            <button
              onClick={() => {
                worldClock.paused = !worldClock.paused
                force((n) => n + 1)
              }}
            >
              {worldClock.paused ? '▶' : '❚❚'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
