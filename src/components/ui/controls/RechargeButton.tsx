import { useEffect, useState } from 'react'
import { ROBOT } from '@/config/robot'
import { CHARGING_PAD, CRASH_SITE } from '@/config/world'
import { getGame, useGameStore } from '@/store/gameStore'
import { player, teleportPlayer } from '@/systems/player'

/** Distancia a la plataforma de la nave para ofrecer la recarga. */
const PAD_REACH = 5

const nearPad = () => Math.hypot(player.position.x - CHARGING_PAD.x, player.position.z - CHARGING_PAD.z) < PAD_REACH

/**
 * Junto a la plataforma de la nave: cargar al 100 % cuando el jugador quiera.
 * El robot se sienta y el tiempo pasa más rápido mientras carga (como en el
 * modo reposo, pero sin perder la mochila). Se puede detener en cualquier momento.
 */
export function RechargeButton() {
  const [near, setNear] = useState(false)
  const active = useGameStore((s) => s.mode === 'active')
  const full = useGameStore((s) => s.battery >= ROBOT.batteryMax - 0.5)
  useEffect(() => {
    const id = window.setInterval(() => setNear(nearPad()), 300)
    return () => window.clearInterval(id)
  }, [])
  if (!near || !active || full) return null
  return (
    <button
      className="recharge-btn"
      onPointerDown={(e) => {
        e.stopPropagation()
        const faceShip = Math.atan2(CRASH_SITE.x - CHARGING_PAD.x, CRASH_SITE.z - CHARGING_PAD.z)
        teleportPlayer(CHARGING_PAD.x, CHARGING_PAD.z, faceShip)
        getGame().startRecharge(true)
      }}
    >
      🔌 Cargar al 100 %
    </button>
  )
}
