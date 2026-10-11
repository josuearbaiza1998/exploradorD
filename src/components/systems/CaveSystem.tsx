import { useFrame } from '@react-three/fiber'
import { CAVE_ARRIVAL, CAVE_EXIT_Z, CAVE_MOUTH, CAVE_ORIGIN, CAVE_OUTSIDE, cave } from '@/config/cave'
import { getGame } from '@/store/gameStore'
import { useUiStore } from '@/store/uiStore'
import { environment } from '@/systems/environmentState'
import { player, teleportPlayer } from '@/systems/player'

/** Entrar y salir de la Cueva de cristal cruzando su boca (con un fundido). */
export function CaveSystem() {
  useFrame(() => {
    const game = getGame()
    if (game.mode !== 'active') return
    const p = player.position
    if (!cave.active) {
      if (Math.hypot(p.x - CAVE_MOUTH.x, p.z - CAVE_MOUTH.z) < 1.8) {
        cave.active = true
        useUiStore.getState().fade()
        teleportPlayer(CAVE_ARRIVAL.x, CAVE_ARRIVAL.z, CAVE_ARRIVAL.heading)
        game.notify('🕳️ Cueva de cristal', 'info')
      }
    } else if (p.z - CAVE_ORIGIN.z > CAVE_EXIT_Z) {
      cave.active = false
      useUiStore.getState().fade()
      teleportPlayer(CAVE_OUTSIDE.x, CAVE_OUTSIDE.z, CAVE_OUTSIDE.heading)
    }
    environment.inCave = cave.active
  })
  return null
}
