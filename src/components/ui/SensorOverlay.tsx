import { useGameStore } from '@/store/gameStore'

/**
 * UI diegética de los sensores: el polvo se acumula en los bordes de la
 * "visión" del robot. Sin barras: el jugador nota que ve peor y lo intuye.
 */
export function SensorOverlay() {
  const dirt = useGameStore((s) => Math.round(s.sensorDirt * 50) / 50)
  if (dirt <= 0) return null
  return <div className="sensor-dirt" style={{ opacity: Math.min(1, dirt * 1.3), ['--dirt' as string]: dirt }} />
}
