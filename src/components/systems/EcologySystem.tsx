import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { getGame } from '@/store/gameStore'
import { hourOfDay, realToGameHours } from '@/store/slices/clockSlice'
import { ecology, oasisOffset } from '@/systems/ecology'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'
import { ambientTemperature } from '@/systems/worldClock'
import { OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'

/** Plantas a las que la lluvia hace rebrotar antes (prefijos de clave). */
const PLANTS = ['dryShrubs|', 'oasisShrubs|', 'smallTrees|', 'palms|']

/**
 * Ciclo del agua: la lluvia moja (charcos) y empapa el suelo; el sol y el
 * calor lo secan. La humedad sube el oasis y hace rebrotar las plantas.
 */
export function EcologySystem() {
  const t = useRef({ save: 0, regrow: 0, init: false, struct: 0, structGh: 0 })
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const game = getGame()
    const s = t.current
    if (!s.init) {
      s.init = true
      ecology.moisture = game.moisture
      ecology.wetness = Math.max(0, game.moisture - 0.5)
    }
    const gh = realToGameHours(dt, game)
    if (gh <= 0) return
    const rain = weatherState.rain
    const temp = ambientTemperature(hourOfDay(game.totalHours))
    const sun = environment.palette.daylight * weatherState.sun
    // Charcos: se llenan en una hora de aguacero; se secan en unas horas de sol.
    const evap = 0.08 + sun * 0.35 + Math.max(0, temp - 20) * 0.02
    ecology.wetness = Math.min(1, Math.max(0, ecology.wetness + (rain * 1.4 - (rain > 0.1 ? 0 : evap)) * gh))
    // Suelo: lento. Unas horas de lluvia lo empapan; la sequía lo seca en días.
    const dry = 0.01 + Math.max(0, temp - 28) * 0.002
    ecology.moisture = Math.min(1, Math.max(0, ecology.moisture + (rain * 0.14 - (rain > 0.1 ? 0 : dry)) * gh))
    ecology.oasisLevel += (OASIS_WATER_LEVEL + oasisOffset(ecology.moisture) - ecology.oasisLevel) * Math.min(1, dt * 0.5)

    // Con lluvia, lo arrancado rebrota bastante antes.
    if (rain > 0.25) {
      s.regrow += gh * rain * 1.5
      if (s.regrow > 0.5) {
        game.hastenRegrow(s.regrow, PLANTS)
        s.regrow = 0
      }
    }
    // Estructuras: el polvo cubre los paneles (sobre todo con tormenta de
    // arena) y la lluvia los lava y llena los colectores.
    s.structGh += gh
    if ((s.struct -= dt) <= 0 && game.structures.length) {
      s.struct = 1
      const h = s.structGh
      s.structGh = 0
      const dust = weatherState.dust
      let changed = false
      const panelDirt = { ...game.panelDirt }
      const water = { ...game.water }
      for (const st of game.structures) {
        if (st.type === 'solarPanel') {
          const prev = panelDirt[st.id] ?? 0
          const next = Math.min(1, Math.max(0, prev + (dust * dust * 0.35 + dust * 0.02 - rain * 0.8) * h))
          if (Math.abs(next - prev) > 0.002) {
            panelDirt[st.id] = next
            changed = true
          }
        } else if (st.type === 'rainCollector') {
          const prev = water[st.id] ?? 0
          const next = Math.min(1, Math.max(0, prev + (rain * 0.5 - (rain > 0.1 ? 0 : 0.004)) * h))
          if (Math.abs(next - prev) > 0.002) {
            water[st.id] = next
            changed = true
          }
        }
      }
      if (changed) game.setStructureState({ panelDirt, water })
    }
    if ((s.save -= dt) <= 0) {
      s.save = 6
      if (Math.abs(game.moisture - ecology.moisture) > 0.005) game.setMoisture(ecology.moisture)
    }
  })
  return null
}
