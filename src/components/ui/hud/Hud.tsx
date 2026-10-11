import { useGameStore } from '@/store/gameStore'
import { Compass } from './Compass'
import { HudButtons } from './HudButtons'
import { ObjectiveCard } from './ObjectiveCard'
import { StatusPanel } from './StatusPanel'

/** Interfaz superior: estado + objetivo (izq.), brújula (centro), botones (der.). */
export function Hud() {
  const building = useGameStore((s) => !!s.build)
  return (
    <div className="hud">
      <div className="hud-left">
        <StatusPanel />
        {!building && <ObjectiveCard />}
      </div>
      <Compass />
      <HudButtons />
    </div>
  )
}

/** Tinte verde de la visión nocturna con viñeta y líneas de barrido. */
export function NightVisionOverlay() {
  const on = useGameStore((s) => s.nightVisionOn)
  if (!on) return null
  return <div className="night-vision" />
}
