import { DayNightCycle } from '@/components/environment/DayNightCycle'
import { Lighting } from '@/components/environment/Lighting'
import { SkyDome } from '@/components/environment/SkyDome'
import { ChargingPad } from '@/components/props/ChargingPad'
import { DroppedBoxes } from '@/components/props/DroppedBoxes'
import { RobotSystems } from '@/components/systems/RobotSystems'
import { CrashedShip } from '@/components/props/CrashedShip'
import { Oasis } from '@/components/props/Oasis'
import { Vegetation } from '@/components/props/Vegetation'
import { Sea } from '@/components/terrain/Sea'
import { Terrain } from '@/components/terrain/Terrain'
import { Robot } from '@/components/player/Robot'
import { ThirdPersonCamera } from '@/components/player/ThirdPersonCamera'

/** Composición del mundo: sistemas, entorno, terreno y puntos de interés. */
export function World() {
  return (
    <>
      <DayNightCycle />
      <RobotSystems />
      <SkyDome />
      <Lighting />

      <Terrain />
      <Sea />

      <CrashedShip />
      <ChargingPad />
      <DroppedBoxes />
      <Oasis />
      <Vegetation />
      <Robot />
      <ThirdPersonCamera />
    </>
  )
}
