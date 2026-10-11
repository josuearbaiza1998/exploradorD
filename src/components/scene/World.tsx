import { DayNightCycle } from '@/components/environment/DayNightCycle'
import { Lighting } from '@/components/environment/Lighting'
import { AudioSystem } from '@/components/systems/AudioSystem'
import { Finds } from '@/components/props/Finds'
import { WeatherRewards } from '@/components/systems/WeatherRewards'
import { Pois } from '@/components/props/Pois'
import { HitEffects } from '@/components/props/HitEffects'
import { Fauna } from '@/components/environment/Fauna'
import { Clouds } from '@/components/environment/Clouds'
import { SkyDome } from '@/components/environment/SkyDome'
import { ChargingPad } from '@/components/props/ChargingPad'
import { DroppedBoxes } from '@/components/props/DroppedBoxes'
import { RobotSystems } from '@/components/systems/RobotSystems'
import { InteractionHighlight } from '@/components/props/InteractionHighlight'
import { SalvageNodes } from '@/components/props/SalvageNodes'
import { Structures } from '@/components/structures/Structures'
import { BuildGhost } from '@/components/structures/BuildGhost'
import { CrashedShip } from '@/components/props/CrashedShip'
import { Oasis } from '@/components/props/Oasis'
import { Vegetation } from '@/components/props/Vegetation'
import { Weather } from '@/components/weather/Weather'
import { Sea } from '@/components/terrain/Sea'
import { Terrain } from '@/components/terrain/Terrain'
import { Footprints } from '@/components/player/Footprints'
import { Robot } from '@/components/player/Robot'
import { ThirdPersonCamera } from '@/components/player/ThirdPersonCamera'

/** Composición del mundo: sistemas, entorno, terreno y puntos de interés. */
export function World() {
  return (
    <>
      <DayNightCycle />
      <RobotSystems />
      <AudioSystem />
      <WeatherRewards />
      <SkyDome />
      <Clouds />
      <Lighting />
      <Weather />

      <Terrain />
      <Sea />

      <CrashedShip />
      <ChargingPad />
      <DroppedBoxes />
      <SalvageNodes />
      <InteractionHighlight />
      <HitEffects />
      <Pois />
      <Finds />
      <Structures />
      <BuildGhost />
      <Oasis />
      <Vegetation />
      <Fauna />
      <Robot />
      <Footprints />
      <ThirdPersonCamera />
    </>
  )
}
