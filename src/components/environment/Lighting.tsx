import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { AmbientLight, DirectionalLight, HemisphereLight } from 'three'
import { Fog } from 'three'
import { environment } from '@/systems/environmentState'
import { focus } from '@/systems/focus'

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

  useFrame(() => {
    const p = environment.palette
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
    if (ambient.current) ambient.current.intensity = p.ambient
    if (hemi.current) {
      hemi.current.color.copy(p.hemiSky)
      hemi.current.groundColor.copy(p.hemiGround)
      hemi.current.intensity = p.ambient * 1.4
    }
    if (scene.fog instanceof Fog) scene.fog.color.copy(p.skyHorizon)
  })

  return (
    <>
      <directionalLight
        ref={sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
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
