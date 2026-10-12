import { DayNightCycle } from '@/components/environment/DayNightCycle'
import { Lighting } from '@/components/environment/Lighting'
import { AudioSystem } from '@/components/systems/AudioSystem'
import { CaveInterior } from '@/components/props/CaveInterior'
import { Anchors } from '@/components/props/Anchors'
import { Notes } from '@/components/props/Notes'
import { Finds } from '@/components/props/Finds'
import { CaveSystem } from '@/components/systems/CaveSystem'
import { EcologySystem } from '@/components/systems/EcologySystem'
import { Puddles } from '@/components/props/Puddles'
import { Underwater } from '@/components/props/Underwater'
import { WeatherRewards } from '@/components/systems/WeatherRewards'
import { Pois } from '@/components/props/Pois'
import { HitEffects } from '@/components/props/HitEffects'
import { Fauna } from '@/components/environment/Fauna'
import { Scavengers } from '@/components/environment/Scavengers'
import { Clouds } from '@/components/environment/Clouds'
import { SkyDome } from '@/components/environment/SkyDome'
import { SkyEvents } from '@/components/environment/SkyEvents'
import { FarIsland } from '@/components/environment/FarIsland'
import { Constellations } from '@/components/environment/Constellations'
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
import { Drone } from '@/components/player/Drone'
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
      <CaveSystem />
      <EcologySystem />
      <SkyDome />
      <SkyEvents />
      <FarIsland />
      <Constellations />
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
      <Notes />
      <Anchors />
      <CaveInterior />
      <Structures />
      <BuildGhost />
      <Oasis />
      <Puddles />
      <Underwater />
      <Vegetation />
      <Fauna />
      <Scavengers />
      <Robot />
      <Drone />
      <Footprints />
      <ThirdPersonCamera />
    </>
  )
}
