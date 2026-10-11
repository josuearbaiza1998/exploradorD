import { useEffect, useRef, useState } from 'react'
import { ROBOT } from '@/config/robot'
import { WEATHER } from '@/config/weather'
import { getGame, useGameStore } from '@/store/gameStore'
import { dayNumber, hourOfDay } from '@/store/slices/clockSlice'
import { energyStatus } from '@/systems/energyGrid'
import { environment } from '@/systems/environmentState'
import { ambientTemperature } from '@/systems/worldClock'
import { useTicker } from './useTicker'

const WEATHER_ICON = { clear: '☀️', windy: '💨', sandstorm: '🌪️', rain: '🌧️' } as const

/** Tendencia de la batería: % por segundo real, medida sobre los últimos segundos. */
function useBatteryTrend() {
  const samples = useRef<number[]>([])
  const [rate, setRate] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = samples.current
      s.push(getGame().battery)
      if (s.length > 6) s.shift()
      if (s.length >= 2) setRate((s[s.length - 1] - s[0]) / (s.length - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])
  return rate
}

/**
 * Panel de estado (arriba a la izquierda): batería con tendencia y autonomía,
 * sensores, temperatura y clima. Todo de un vistazo.
 */
export function StatusPanel() {
  useTicker(500)
  const battery = useGameStore((s) => Math.round(s.battery))
  const dirt = useGameStore((s) => Math.round(s.sensorDirt * 100))
  const mode = useGameStore((s) => s.mode)
  const weather = useGameStore((s) => s.weather)
  const rate = useBatteryTrend()

  const g = getGame()
  const hour = hourOfDay(g.totalHours)
  const hh = String(Math.floor(hour)).padStart(2, '0')
  const mm = String(Math.floor((hour % 1) * 60)).padStart(2, '0')
  const temp = Math.round(ambientTemperature(hour))
  const charging = mode === 'recharging' || energyStatus.charging || rate > 0.02
  const level = battery / ROBOT.batteryMax
  const tone = level > 0.5 ? 'ok' : level > ROBOT.batteryLow / 100 ? 'mid' : 'low'
  let trend = ''
  if (charging) trend = 'cargando'
  else if (rate < -0.005) {
    const min = battery / -rate / 60
    trend = min > 99 ? '' : `≈ ${Math.max(1, Math.round(min))} min`
  }
  const clean = 100 - dirt

  return (
    <div className="hud-status">
      <div className={`hud-battery ${tone} ${charging ? 'charging' : ''}`}>
        <div className="hud-battery-head">
          <span className="hud-label">⚡ Energía</span>
          <strong>{battery}%</strong>
        </div>
        <div className="hud-bar">
          <div className="hud-bar-fill" style={{ width: `${battery}%` }} />
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="hud-bar-tick" style={{ left: `${(i + 1) * 10}%` }} />
          ))}
        </div>
        <span className="hud-trend">{trend}</span>
      </div>
      <div className="hud-row">
        <span className={`hud-chip ${clean < 40 ? 'bad' : clean < 75 ? 'warn' : ''}`} title="Limpieza de sensores">
          🥽 {clean}%
        </span>
        <span className={`hud-chip ${temp < 0 ? 'cold' : ''}`} title="Temperatura">
          🌡️ {temp}°
        </span>
        <span className="hud-chip" title={WEATHER[weather].label}>
          {weather === 'clear' && environment.palette.daylight < 0.3 ? '🌙' : WEATHER_ICON[weather]} {environment.sheltered ? '🛡️' : ''}
        </span>
      </div>
      <div className="hud-clock">
        Día {dayNumber(g.totalHours)} · {hh}:{mm}
      </div>
    </div>
  )
}
