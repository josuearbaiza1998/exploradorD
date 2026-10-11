import { useEffect, useState } from 'react'
import { ITEMS, type ItemId } from '@/config/items'
import { ROBOT } from '@/config/robot'
import { getGame, useGameStore } from '@/store/gameStore'
import { dayNumber, hourOfDay } from '@/store/slices/clockSlice'
import { ambientTemperature } from '@/systems/worldClock'
import { WEATHER, type WeatherId } from '@/config/weather'

const SPEEDS = [1, 10, 60]

/**
 * Panel de PRUEBAS (temporal): hora, velocidad del tiempo y atajos para
 * validar la Fase 3 sin jugar horas (batería crítica, sensores, objetos).
 * No forma parte de la UI final: el juego evita barras y HUD intrusivos.
 */
export function DebugPanel() {
  const [, force] = useState(0)
  const [open, setOpen] = useState(false)
  const timeSpeed = useGameStore((s) => s.timeSpeed)
  const paused = useGameStore((s) => s.paused)
  const inventory = useGameStore((s) => s.inventory)
  const boxes = useGameStore((s) => s.droppedBoxes.length)
  const mode = useGameStore((s) => s.mode)
  const weather = useGameStore((s) => s.weather)

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 250)
    return () => window.clearInterval(id)
  }, [])

  const g = getGame()
  const hour = hourOfDay(g.totalHours)
  const hh = Math.floor(hour)
  const mm = Math.floor((hour - hh) * 60)
  const time = `Día ${dayNumber(g.totalHours)} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  const items = (Object.entries(inventory) as [ItemId, number][]).filter(([, n]) => n > 0)

  return (
    <div className="debug-panel">
      <button className="debug-chip" onClick={() => setOpen((o) => !o)}>
        {time} · {Math.round(ambientTemperature(hour))}°C
      </button>
      {open && (
        <div className="debug-body">
          <input
            type="range"
            min={0}
            max={23.99}
            step={0.05}
            value={hour}
            onChange={(e) => {
              g.setHourOfDay(Number(e.target.value))
              force((n) => n + 1)
            }}
          />
          <div className="debug-row">
            {SPEEDS.map((s) => (
              <button key={s} className={timeSpeed === s ? 'active' : ''} onClick={() => g.setTimeSpeed(s)}>
                x{s}
              </button>
            ))}
            <button onClick={g.togglePause}>{paused ? '▶' : '❚❚'}</button>
          </div>
          <div className="debug-stats">
            🔋 {g.battery.toFixed(1)}% · 👁 sucio {Math.round(g.sensorDirt * 100)}% · {mode}
            <br />
            {items.length ? items.map(([id, n]) => `${ITEMS[id].icon}${n}`).join('  ') : 'Inventario vacío'}
            {boxes > 0 && ` · 📦 ${boxes} caja(s) en el mapa`}
          </div>
          <div className="debug-row wrap">
            {(Object.keys(WEATHER) as WeatherId[]).map((id) => (
              <button key={id} className={weather === id ? 'active' : ''} onClick={() => g.setWeather(id)}>
                {WEATHER[id].label}
              </button>
            ))}
          </div>
          <div className="debug-row wrap">
            <button onClick={() => g.setBattery(ROBOT.batteryCritical)}>Agotar batería</button>
            <button
              onClick={() => {
                g.addItem('wood', 4)
                g.addItem('scrapMetal', 2)
                g.addItem('fiber', 3)
                g.addItem('techParts', 2)
              }}
            >
              + Objetos
            </button>
            <button onClick={() => g.addSensorDirt(0.35)}>Ensuciar</button>
            <button onClick={() => g.cleanSensors()}>Limpiar</button>
            <button
              onClick={() => {
                if (!window.confirm('¿Borrar la partida guardada?')) return
                try {
                  localStorage.removeItem('exploradord-save')
                } catch {
                  /* ignorar */
                }
                useGameStore.persist.clearStorage()
                window.location.reload()
              }}
            >
              Reiniciar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
