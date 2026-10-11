import { ROBOT } from '@/config/robot'
import { getGame, useGameStore } from '@/store/gameStore'

/**
 * Efectos de pantalla del estado de energía:
 *  - Batería baja: pulso rojo en los bordes (más rápido cuanto menos queda).
 *  - Emergencia: parpadeo y aviso; regreso: fundido a negro; recarga: fundido de vuelta.
 */
export function EmergencyOverlay() {
  const mode = useGameStore((s) => s.mode)
  const battery = useGameStore((s) => Math.round(s.battery))
  const voluntary = useGameStore((s) => !!s.recharge?.voluntary)

  const low = mode === 'active' && battery < ROBOT.batteryLow
  return (
    <>
      {low && <div className={`battery-warning ${battery < 10 ? 'fast' : ''}`} />}
      {mode === 'emergency' && (
        <div className="emergency-glitch">
          <span>ENERGÍA CRÍTICA</span>
        </div>
      )}
      {mode === 'returning' && (
        <div className="emergency-fade">
          <span>Modo reposo · regresando a la nave</span>
        </div>
      )}
      {mode === 'recharging' && (
        <>
          {!voluntary && <div className="recharge-fade-in" />}
          <div className="recharge-label">
            Recargando · {battery}%
            {voluntary && (
              <button className="recharge-stop" onClick={() => getGame().stopRecharge()}>
                Detener
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}
