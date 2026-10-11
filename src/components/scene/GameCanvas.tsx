import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { PCFShadowMap } from 'three'
import { INITIAL_CAMERA } from './InspectionCamera'
import { World } from './World'

/**
 * Canvas principal, configurado para móvil:
 *  - dpr limitado a 1.5 (las pantallas 3x matan el fill-rate).
 *  - `flat` (sin tone mapping) => colores toon puros y saturados.
 *  - Sombras PCF (bordes duros, baratas).
 */
export function GameCanvas() {
  return (
    <Canvas
      flat
      dpr={[1, 1.5]}
      shadows={{ type: PCFShadowMap }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: INITIAL_CAMERA, fov: 60, near: 0.3, far: 2000 }}
    >
      <Suspense fallback={null}>
        <World />
      </Suspense>
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
