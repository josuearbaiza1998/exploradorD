import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RAINY, type WeatherId } from '@/config/weather'
import { OASIS } from '@/config/world'
import { getGame } from '@/store/gameStore'
import type { Find } from '@/store/slices/explorationSlice'
import { player } from '@/systems/player'
import { getHeight, OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'
import { landSpot } from '@/utils/terrain/landSpot'

let seq = 0
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}`

/**
 * Premios del clima: al terminar una tormenta de arena aparecen restos
 * desenterrados cerca del robot; tras la lluvia florece el oasis durante un día.
 */
export function WeatherRewards() {
  const prev = useRef<WeatherId | null>(null)
  const lastExpire = useRef(0)
  useFrame(({ clock }) => {
    const game = getGame()
    const w = game.weather
    if (prev.current && prev.current !== w) {
      // Avisos al empezar la lluvia fuerte (el cielo ya se nota venir).
      if (w === 'storm') game.notify('⛈️ Tormenta eléctrica: rachas fuertes y rayos. Mejor ponerse a cubierto.', 'warn')
      else if (w === 'rain' && prev.current !== 'storm') game.notify('🌧️ Llega un aguacero: el oasis lo agradecerá.', 'info')
      if (prev.current === 'sandstorm') {
        const finds: Find[] = []
        for (let i = 0; i < 3; i++) {
          const s = landSpot(player.position.x, player.position.z, 12, 45, 2.5)
          if (s) finds.push({ id: uid(), kind: 'buried', x: s.x, z: s.z, until: game.totalHours + 72 })
        }
        if (finds.length) {
          game.addFinds(finds)
          game.notify('⛏️ La tormenta desenterró restos cerca. Míralos en la brújula.', 'info')
        }
      } else if (RAINY.includes(prev.current) && !RAINY.includes(w)) {
        const finds: Find[] = []
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4
          const r = OASIS.radius * (1.05 + Math.random() * 0.35)
          const x = OASIS.x + Math.cos(a) * r
          const z = OASIS.z + Math.sin(a) * r
          if (getHeight(x, z) > OASIS_WATER_LEVEL + 0.2) finds.push({ id: uid(), kind: 'bloom', x, z, until: game.totalHours + 24 })
        }
        game.addFinds(finds)
        game.notify('🌸 La lluvia hizo florecer el oasis', 'info')
      }
    }
    prev.current = w
    if (clock.elapsedTime - lastExpire.current > 2) {
      lastExpire.current = clock.elapsedTime
      game.expireFinds(game.totalHours)
    }
  })
  return null
}
