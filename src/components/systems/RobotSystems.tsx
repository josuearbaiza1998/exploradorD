import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import { ROBOT } from '@/config/robot'
import { upgradeEffects } from '@/config/upgrades'
import { DISCOVER_RADIUS, POIS } from '@/config/pois'
import { CHARGING_PAD, CRASH_SITE } from '@/config/world'
import { robotBatteryMaterial } from '@/materials/toonMaterials'
import { getGame, useGameStore } from '@/store/gameStore'
import { hourOfDay, realToGameHours } from '@/store/slices/clockSlice'
import { environment } from '@/systems/environmentState'
import { findTarget } from '@/systems/interaction/interactables'
import { player, teleportPlayer } from '@/systems/player'
import { isSheltered } from '@/systems/shelter'
import { energyStatus, updateEnergyGrid } from '@/systems/energyGrid'
import { weatherState } from '@/systems/weatherState'
import { RAINY } from '@/config/weather'
import { wind } from '@/systems/wind'
import { ambientTemperature } from '@/systems/worldClock'
import { tallCoverNear, thermal, updateThermal } from '@/systems/thermal'
import { cave, CAVE_OUTSIDE, inCave } from '@/config/cave'
import { getHeight } from '@/utils/terrain/heightfield'

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
 *  - Consumo/carga de batería (movimiento, frío, clima, panel solar).
 *  - Suciedad de sensores por polvo y tormentas; la lluvia los lava.
 *  - La nave sirve de refugio: anula frío, clima y suciedad.
 *  - Máquina de estados del modo reposo: caja → regreso → recarga.
 *  - Detección de la caja caída más cercana y del recurso que el robot tiene delante.
 *  - Rebrote de recursos recolectados.
 *  - Guardado periódico de la posición.
 */
export function RobotSystems() {
  const saveTimer = useRef(0)
  const lastGrounded = useRef(true)
  const sweepTimer = useRef(0)
  const shadeTimer = useRef(0)
  const coverNear = useRef(false)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const game = getGame()
    const gameHours = realToGameHours(dt, game)
    const hour = hourOfDay(game.totalHours)
    game.tickModeTime(dt)

    // Paneles solares y bancos de baterías construidos: los bancos se llenan
    // aunque el robot esté lejos; solo se carga al robot si está activo.
    const gridGain = updateEnergyGrid(
      player.position.x,
      player.position.z,
      gameHours,
      environment.palette.daylight * weatherState.solar,
      game.mode === 'active',
    )

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
        const sheltered = isSheltered(player.position.x, player.position.z)
        // Aviso discreto al entrar/salir del refugio con mal tiempo.
        if (sheltered !== environment.sheltered && weatherState.drain > 1.05) {
          game.notify(sheltered ? 'A cubierto junto a la nave' : 'Expuesto al clima', sheltered ? 'info' : 'warn')
        }
        environment.sheltered = sheltered
        const fx = upgradeEffects(game.upgrades)
        let drain = ROBOT.drain.idle + ROBOT.drain.moving * effort * fx.movingDrain
        if (game.nightVisionOn) drain += ROBOT.drain.nightVision
        if (player.sprinting) drain += ROBOT.drain.sprint * fx.movingDrain
        // --- Temperatura: sol del mediodía y frío nocturno ---
        if ((shadeTimer.current -= dt) <= 0) {
          shadeTimer.current = 0.4
          coverNear.current = tallCoverNear(player.position.x, player.position.z)
        }
        const temp = ambientTemperature(hour) - (RAINY.includes(game.weather) ? (game.weather === 'drizzle' ? 3 : 6) : 0)
        const shade = sheltered || coverNear.current || inCave(player.position.x, player.position.z) || weatherState.sun < 0.5
        const wasHot = thermal.overheated
        const warm = thermal.heat
        updateThermal(temp, shade, effort, player.sprinting, gameHours)
        if (!wasHot && thermal.overheated) game.notify('🔥 ¡Sobrecalentado! Busca sombra: rocas altas, la nave o un refugio', 'warn')
        else if (warm < 0.7 && thermal.heat >= 0.7) game.notify('🌡️ El robot se está calentando', 'warn')
        if (thermal.overheated) drain *= 1.6
        if (!sheltered) drain *= thermal.cold
        if (!sheltered) drain *= weatherState.drain
        // Más capacidad = el mismo consumo baja menos el porcentaje.
        drain /= fx.capacity
        const solar = ROBOT.solarCharge * fx.solar * environment.palette.daylight * weatherState.solar
        let delta = (solar - drain) * gameHours
        delta += gridGain
        // Coste del salto: al despegar del suelo hacia arriba.
        if (lastGrounded.current && !player.grounded && player.velocity.y > 0) delta -= ROBOT.drain.jump / fx.capacity
        lastGrounded.current = player.grounded
        game.addBattery(delta)

        // --- Sensores: el polvo se pega más al moverse con viento fuerte ---
        // El clima añade suciedad aunque estés quieto (tormenta) o la lava (lluvia).
        if (!sheltered) {
          game.addSensorDirt(
            (ROBOT.sensors.dirtPerHour * gameHours * effort * (0.5 + wind.strength * 2) +
              weatherState.dirtPerHour * gameHours) *
              fx.dirt,
          )
          if (weatherState.washPerHour > 0) game.cleanSensors(weatherState.washPerHour * gameHours)
        }

        break
      }
      case 'emergency':
        if (game.modeTime >= EMERGENCY_TIMING.shutdown) game.setMode('returning')
        break
      case 'returning':
        // El movimiento automático lo hace <Robot/>; aquí solo el final del trayecto.
        if (game.modeTime >= EMERGENCY_TIMING.autopilot) {
          const faceShip = Math.atan2(CRASH_SITE.x - CHARGING_PAD.x, CRASH_SITE.z - CHARGING_PAD.z)
          cave.active = false
          teleportPlayer(CHARGING_PAD.x, CHARGING_PAD.z, faceShip)
          game.startRecharge()
        }
        break
      case 'recharging': {
        const r = game.recharge
        if (!r) break
        // La duración es proporcional a lo que falta (cargar desde 80 % es más rápido).
        const hours = Math.max(0.25, (ROBOT.rechargeHours * (ROBOT.batteryMax - r.startBattery)) / ROBOT.batteryMax)
        const progress = (game.totalHours - r.startHours) / hours
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

    // --- Objetivo de recolección (lo que el robot tiene delante) ---
    game.setTarget(
      game.mode === 'active' && !nearest && !game.build
        ? findTarget(player.position.x, player.position.z, player.heading, game.harvested, game.structures, game.looted, game.finds)
        : null,
    )

    // --- Lugares por descubrir: se descubren al acercarse ---
    if (game.mode === 'active') {
      for (const poi of POIS) {
        if (!game.discovered[poi.id] && Math.hypot(poi.x - player.position.x, poi.z - player.position.z) < DISCOVER_RADIUS) {
          game.discover(poi.id)
        }
      }
    }

    // --- Rebrote de recursos (cada pocos segundos basta) ---
    sweepTimer.current += dt
    if (sweepTimer.current > 2) {
      sweepTimer.current = 0
      game.sweepRegrown()
    }

    // --- Indicador de batería en la espalda del robot (UI diegética) ---
    const b = getGame().battery / ROBOT.batteryMax
    const c = robotBatteryMaterial.color
    if (b > 0.5) c.copy(yellow).lerp(green, (b - 0.5) * 2)
    else c.copy(red).lerp(yellow, Math.max(0, (b - 0.1) / 0.4))
    robotBatteryMaterial.emissive.copy(c)
    const t = state.clock.elapsedTime
    robotBatteryMaterial.emissiveIntensity =
      game.mode === 'recharging' || energyStatus.charging
        ? 0.6 + Math.sin(t * 4) * 0.4
        : b * 100 < ROBOT.batteryLow
          ? 0.4 + (Math.sin(t * 10) > 0 ? 0.8 : 0)
          : 0.8

    // --- Guardado periódico de la posición ---
    saveTimer.current += dt
    if (saveTimer.current > 2 && game.mode === 'active') {
      saveTimer.current = 0
      // Dentro de la cueva se guarda la entrada: al volver se aparece fuera.
      if (cave.active) game.savePosition([CAVE_OUTSIDE.x, getHeight(CAVE_OUTSIDE.x, CAVE_OUTSIDE.z), CAVE_OUTSIDE.z])
      else {
        const p = player.position
        game.savePosition([p.x, p.y, p.z])
      }
    }
  })

  return null
}

/** Hook de conveniencia para la UI: batería redondeada (re-render solo al cambiar el entero). */
export const useBatteryPercent = () => useGameStore((s) => Math.round(s.battery))
