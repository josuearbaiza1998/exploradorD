import { DustParticles } from './DustParticles'
import { GroundDust } from './GroundDust'
import { RainParticles } from './RainParticles'

/** Efectos visuales del clima (la lógica vive en DayNightCycle + weatherState). */
export function Weather() {
  return (
    <>
      <DustParticles />
      <GroundDust />
      <RainParticles />
    </>
  )
}
