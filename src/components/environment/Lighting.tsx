import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { AmbientLight, DirectionalLight, HemisphereLight } from 'three'
import { Fog } from 'three'
import { environment } from '@/systems/environmentState'
import { focus } from '@/systems/focus'
import { weatherState } from '@/systems/weatherState'
import { getGame } from '@/store/gameStore'
import { Color } from 'three'
import { useQuality } from '@/store/settingsStore'

const CAVE_AMBIENT = new Color('#6f86c8')
const MIST_COLOR = new Color('#9fb0d8')

const SHADOW_DISTANCE = 120
const LIGHT_DISTANCE = 150

/**
 * Iluminación de contraste para cell-shading:
 *  - UNA DirectionalLight fuerte (sol de día, luna de noche) con sombras duras.
 *  - Ambient + Hemisphere muy bajas para no "lavar" las bandas del toon.
 * La cámara de sombras sigue al foco, así la resolución se concentra donde
 * está el jugador (necesario también para el terreno por chunks).
 */
export function Lighting() {
  const sun = useRef<DirectionalLight>(null)
  const q = useQuality()
  const ambient = useRef<AmbientLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    scene.fog = new Fog('#ffd3a1', 160, 520)
    return () => {
      scene.fog = null
    }
  }, [scene])

  useEffect(() => {
    if (sun.current) scene.add(sun.current.target)
  }, [scene])

  const nv = useRef(0)
  useFrame((_, delta) => {
    const p = environment.palette
    // Visión nocturna: sube la luz ambiente de noche (el tinte verde lo pone la UI).
    const nvTarget = getGame().nightVisionOn ? 1 - p.daylight : 0
    nv.current += (nvTarget - nv.current) * Math.min(1, delta * 4)
    environment.nightVision = nv.current
    const light = sun.current
    if (light) {
      light.color.copy(p.sunColor)
      light.intensity = p.sunIntensity
      light.position.set(
        focus.x + environment.lightDir.x * LIGHT_DISTANCE,
        focus.y + environment.lightDir.y * LIGHT_DISTANCE,
        focus.z + environment.lightDir.z * LIGHT_DISTANCE,
      )
      light.target.position.copy(focus)
      light.target.updateMatrixWorld()
    }
    if (ambient.current) {
      ambient.current.intensity = p.ambient + nv.current * 1.1 + weatherState.flash * 2.2
      ambient.current.color.set('#ffffff')
    }
    if (hemi.current) {
      hemi.current.color.copy(p.hemiSky)
      hemi.current.groundColor.copy(p.hemiGround)
      hemi.current.intensity = p.ambient * 1.4 + nv.current * 0.6 + weatherState.flash * 1.6
    }
    if (scene.fog instanceof Fog) {
      // La niebla se cierra con tormentas/lluvia y toma el color del clima.
      scene.fog.color.copy(p.skyHorizon).lerp(environment.weatherTint, weatherState.tintAmount)
      scene.fog.near = weatherState.fogNear
      scene.fog.far = weatherState.fogFar
      // Bruma nocturna: de noche y al amanecer la niebla se acerca y se vuelve azulada.
      const mist = environment.mist * (1 - nv.current * 0.7)
      if (mist > 0) {
        scene.fog.color.lerp(MIST_COLOR, mist * 0.6)
        scene.fog.near *= 1 - mist * 0.75
        scene.fog.far *= 1 - mist * 0.55
      }
    }
    // Dentro de la cueva: casi sin sol, penumbra azulada (la luz la ponen los cristales).
    if (environment.inCave) {
      const night = nv.current
      if (light) light.intensity *= 0.04
      if (ambient.current) {
        ambient.current.color.set(CAVE_AMBIENT)
        ambient.current.intensity = 0.35 + night * 0.6
      }
      if (hemi.current) hemi.current.intensity = 0.15 + night * 0.5
      if (scene.fog instanceof Fog) {
        scene.fog.color.set('#0b1020')
        scene.fog.near = 6
        scene.fog.far = 48 + night * 30
      }
    }
  })

  return (
    <>
      <directionalLight
        ref={sun}
        castShadow={q.shadows}
        key={q.shadowMap}
        shadow-mapSize={[q.shadowMap, q.shadowMap]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
        shadow-camera-left={-SHADOW_DISTANCE}
        shadow-camera-right={SHADOW_DISTANCE}
        shadow-camera-top={SHADOW_DISTANCE}
        shadow-camera-bottom={-SHADOW_DISTANCE}
        shadow-camera-near={1}
        shadow-camera-far={LIGHT_DISTANCE * 2.5}
      />
      <ambientLight ref={ambient} intensity={0.2} />
      <hemisphereLight ref={hemi} intensity={0.25} />
    </>
  )
}
