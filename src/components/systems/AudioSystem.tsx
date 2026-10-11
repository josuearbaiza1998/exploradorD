import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ROBOT } from '@/config/robot'
import { CRASH_SITE } from '@/config/world'
import type { HarvestKind } from '@/config/harvest'
import { getGame, useGameStore } from '@/store/gameStore'
import { environment } from '@/systems/environmentState'
import { player } from '@/systems/player'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import {
  chirp,
  crackle,
  playFootstep,
  playHit,
  playLowBattery,
  playPickup,
  setAmbience,
  thunder,
  unlockAudio,
} from '@/systems/audio/audioEngine'

const STEP_LENGTH = 1.25

const HIT_MATERIAL: Record<HarvestKind, Parameters<typeof playHit>[0]> = {
  smallTree: 'wood',
  palm: 'wood',
  shrub: 'plant',
  rock: 'stone',
  debris: 'metal',
  hullPanel: 'metal',
  structure: 'metal',
}

/**
 * Paisaje sonoro: lee el estado del mundo cada frame y ajusta el motor de
 * audio procedural (viento, lluvia, fuego de la nave, grillos de noche,
 * pasos, golpes, truenos y avisos de batería).
 */
export function AudioSystem() {
  const stepDist = useRef(0)
  const lastPos = useRef({ x: player.position.x, z: player.position.z })
  const lastAction = useRef(player.actionAt)
  const lastKind = useRef<HarvestKind | null>(null)
  const timers = useRef({ crackle: 0, chirp: 0, beep: 0, thunder: 12 })

  // El audio solo puede arrancar tras un gesto del usuario.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Ding al conseguir recursos.
  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        if (s.notice && s.notice !== prev.notice && s.notice.tone === 'gain') playPickup()
      }),
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const game = getGame()
    const sheltered = environment.sheltered
    const night = 1 - environment.palette.daylight
    const t = timers.current

    // --- Ambientes en bucle ---
    const fireDist = Math.hypot(player.position.x - CRASH_SITE.x, player.position.z - CRASH_SITE.z)
    const fire = Math.max(0, 1 - fireDist / 45)
    const crickets = night * (1 - weatherState.rain) * Math.max(0, 1 - wind.strength * 1.2)
    setAmbience({
      wind: (0.12 + wind.strength * 0.88) * (sheltered ? 0.45 : 1),
      windPitch: wind.strength,
      rain: weatherState.rain * (sheltered ? 0.6 : 1),
      fire,
      crickets,
    })

    // --- Sonidos sueltos con temporizadores aleatorios ---
    if (fire > 0.02) {
      t.crackle -= dt
      if (t.crackle <= 0) {
        crackle()
        t.crackle = 0.04 + Math.random() * 0.25
      }
    }
    if (crickets > 0.05) {
      t.chirp -= dt
      if (t.chirp <= 0) {
        chirp()
        t.chirp = 0.25 + Math.random() * 1.1
      }
    }
    if (weatherState.rain > 0.7) {
      t.thunder -= dt
      if (t.thunder <= 0) {
        thunder()
        t.thunder = 14 + Math.random() * 20
      }
    }

    // --- Pasos: uno cada cierta distancia recorrida por el suelo ---
    const dx = player.position.x - lastPos.current.x
    const dz = player.position.z - lastPos.current.z
    lastPos.current.x = player.position.x
    lastPos.current.z = player.position.z
    const moved = Math.hypot(dx, dz)
    if (moved < 3 && player.grounded && (game.mode === 'active' || game.mode === 'returning')) {
      stepDist.current += moved
      if (stepDist.current > STEP_LENGTH) {
        stepDist.current = 0
        playFootstep(Math.min(1, 0.5 + player.speed / 8))
      }
    }

    // --- Golpes al recolectar ---
    if (game.target) lastKind.current = game.target.kind
    if (player.actionAt !== lastAction.current) {
      lastAction.current = player.actionAt
      if (lastKind.current) playHit(HIT_MATERIAL[lastKind.current])
    }

    // --- Batería baja: pitido periódico ---
    if (game.mode === 'active' && game.battery < ROBOT.batteryLow) {
      t.beep -= dt
      if (t.beep <= 0) {
        playLowBattery()
        t.beep = game.battery < 10 ? 3 : 7
      }
    } else t.beep = 0
  })

  return null
}
