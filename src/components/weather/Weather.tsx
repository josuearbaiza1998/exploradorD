import { useInCave } from '@/hooks/useInCave'
import { useQuality } from '@/store/settingsStore'
import { DustDevils } from './DustDevils'
import { DustParticles } from './DustParticles'
import { GroundDust } from './GroundDust'
import { GroundMist } from './GroundMist'
import { RainParticles } from './RainParticles'
import { RainSplashes } from './RainSplashes'
import { Lightning } from './Lightning'

/** Efectos visuales del clima (la lógica vive en DayNightCycle + weatherState). */
export function Weather() {
  // En calidad baja se quitan los velos de polvo y bruma (muchos sprites grandes).
  const extras = useQuality().extras
  // Dentro de la cueva no hay clima.
  const inside = useInCave()
  if (inside) return null
  return (
    <>
      <DustParticles />
      {extras && <GroundDust />}
      {extras && <GroundMist />}
      <RainParticles />
      {extras && <RainSplashes />}
      <Lightning />
      <DustDevils />
    </>
  )
}
