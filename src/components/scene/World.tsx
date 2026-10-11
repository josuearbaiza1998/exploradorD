import { DayNightCycle } from '@/components/environment/DayNightCycle'
import { Lighting } from '@/components/environment/Lighting'
import { SkyDome } from '@/components/environment/SkyDome'
import { CrashedShip } from '@/components/props/CrashedShip'
import { Oasis } from '@/components/props/Oasis'
import { RobotPlaceholder } from '@/components/props/RobotPlaceholder'
import { Vegetation } from '@/components/props/Vegetation'
import { Sea } from '@/components/terrain/Sea'
import { Terrain } from '@/components/terrain/Terrain'
import { InspectionCamera } from './InspectionCamera'

/** Composición del mundo: sistemas, entorno, terreno y puntos de interés. */
export function World() {
  return (
    <>
      <DayNightCycle />
      <SkyDome />
      <Lighting />

      <Terrain />
      <Sea />

      <CrashedShip />
      <Oasis />
      <Vegetation />
      <RobotPlaceholder />

      <InspectionCamera />
    </>
  )
}
