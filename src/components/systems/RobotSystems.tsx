import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import { ROBOT } from '@/config/robot'
import { CHARGING_PAD, CRASH_SITE } from '@/config/world'
import { robotBatteryMaterial } from '@/materials/toonMaterials'
import { getGame, useGameStore } from '@/store/gameStore'
import { hourOfDay, realToGameHours } from '@/store/slices/clockSlice'
import { environment } from '@/systems/environmentState'
import { player, teleportPlayer } from '@/systems/player'
import { wind } from '@/systems/wind'
import { ambientTemperature } from '@/systems/worldClock'

/** Duración (s reales) de cada etapa de la secuencia de emergencia. */
export const EMERGENCY_TIMING = {
  /** El robot se detiene y "se apaga" tras soltar la caja. */
  shutdown: 1.4,
  /** Piloto automático visible antes de que termine el fundido a negro. */
  autopilot: 3.2,
}

const MAX_SPEED = 6.5
const green = new Color('#3dff7a')
const yellow = new Color('#ffd23d')
const red = new Color('#ff3d3d')

/**
 * Sistemas de supervivencia (sin geometría), ejecutados una vez por frame:
 *  - Consumo/carga de batería (movimiento, frío, panel solar).
 *  - Suciedad de sensores por polvo.
 *  - Máquina de estados del modo reposo: caja → regreso → recarga.
 *  - Detección de la caja caída más cercana para poder recogerla.
 *  - Guardado periódico de la posición.
 */
export function RobotSystems() {
  const saveTimer = useRef(0)
  const lastGrounded = useRef(true)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const game = getGame()
    const gameHours = realToGameHours(dt, game)
    const hour = hourOfDay(game.totalHours)
    game.tickModeTime(dt)

    switch (game.mode) {
      case 'active': {
        // --- Batería crítica => emergencia (antes de sumar la carga solar del frame) ---
        if (game.battery <= ROBOT.batteryCritical) {
          const p = player.position
          game.dropInventoryBox([p.x, p.y, p.z])
          game.setMode('emergency')
          break
        }

        // --- Batería ---
        const effort = Math.min(player.speed / MAX_SPEED, 1)
        let drain = ROBOT.drain.idle + ROBOT.drain.moving * effort
        if (ambientTemperature(hour) < 0) drain *= ROBOT.drain.coldMultiplier
        const solar = ROBOT.solarCharge * environment.palette.daylight
        let delta = (solar - drain) * gameHours
        // Coste del salto: al despegar del suelo hacia arriba.
        if (lastGrounded.current && !player.grounded && player.velocity.y > 0) delta -= ROBOT.drain.jump
        lastGrounded.current = player.grounded
        game.addBattery(delta)

        // --- Sensores: el polvo se pega más al moverse con viento fuerte ---
        game.addSensorDirt(ROBOT.sensors.dirtPerHour * gameHours * effort * (0.5 + wind.strength * 2))

        break
      }
      case 'emergency':
        if (game.modeTime >= EMERGENCY_TIMING.shutdown) game.setMode('returning')
        break
      case 'returning':
        // El movimiento automático lo hace <Robot/>; aquí solo el final del trayecto.
        if (game.modeTime >= EMERGENCY_TIMING.autopilot) {
          const faceShip = Math.atan2(CRASH_SITE.x - CHARGING_PAD.x, CRASH_SITE.z - CHARGING_PAD.z)
          teleportPlayer(CHARGING_PAD.x, CHARGING_PAD.z, faceShip)
          game.startRecharge()
        }
        break
      case 'recharging': {
        const r = game.recharge
        if (!r) break
        const progress = (game.totalHours - r.startHours) / ROBOT.rechargeHours
        game.setBattery(r.startBattery + (ROBOT.batteryMax - r.startBattery) * Math.min(progress, 1))
        if (progress >= 1) game.finishRecharge()
        break
      }
    }

    // --- Caja caída más cercana al alcance ---
    let nearest: string | null = null
    if (game.mode === 'active') {
      let best = ROBOT.pickupRadius
      for (const box of game.droppedBoxes) {
        const d = Math.hypot(box.position[0] - player.position.x, box.position[2] - player.position.z)
        if (d < best) {
          best = d
          nearest = box.id
        }
      }
    }
    game.setNearbyBox(nearest)

    // --- Indicador de batería en la espalda del robot (UI diegética) ---
    const b = getGame().battery / ROBOT.batteryMax
    const c = robotBatteryMaterial.color
    if (b > 0.5) c.copy(yellow).lerp(green, (b - 0.5) * 2)
    else c.copy(red).lerp(yellow, Math.max(0, (b - 0.1) / 0.4))
    robotBatteryMaterial.emissive.copy(c)
    const t = state.clock.elapsedTime
    robotBatteryMaterial.emissiveIntensity =
      game.mode === 'recharging'
        ? 0.6 + Math.sin(t * 4) * 0.4
        : b * 100 < ROBOT.batteryLow
          ? 0.4 + (Math.sin(t * 10) > 0 ? 0.8 : 0)
          : 0.8

    // --- Guardado periódico de la posición ---
    saveTimer.current += dt
    if (saveTimer.current > 2 && game.mode === 'active') {
      saveTimer.current = 0
      const p = player.position
      game.savePosition([p.x, p.y, p.z])
    }
  })

  return null
}

/** Hook de conveniencia para la UI: batería redondeada (re-render solo al cambiar el entero). */
export const useBatteryPercent = () => useGameStore((s) => Math.round(s.battery))
