import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { perfStats, useQuality, useSettings } from '@/store/settingsStore'
import { PCFShadowMap } from 'three'
import { World } from './World'

/**
 * Canvas principal, configurado para móvil:
 *  - dpr y sombras según la calidad (automática por defecto).
 *  - `flat` (sin tone mapping) => colores toon puros y saturados.
 *  - Sombras PCF (bordes duros, baratas).
 */
export function GameCanvas() {
  const q = useQuality()
  const auto = useSettings((s) => s.mode === 'auto')
  return (
    <Canvas
      flat
      dpr={q.dpr}
      shadows={q.shadows ? { type: PCFShadowMap } : false}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 62, near: 0.3, far: 2000 }}
    >
      <Suspense fallback={null}>
        <World />
      </Suspense>
      <FpsMeter />
      {/* Calidad automática: baja un nivel si el móvil no llega, sube si sobra. */}
      {auto && (
        <PerformanceMonitor
          bounds={() => [34, 58]}
          flipflops={4}
          onDecline={() => useSettings.getState().stepAuto(-1)}
          onIncline={() => useSettings.getState().stepAuto(1)}
        />
      )}
    </Canvas>
  )
}

/** Media móvil de fps para el menú. */
function FpsMeter() {
  useFrame((_, delta) => {
    if (delta > 0) perfStats.fps += (1 / delta - perfStats.fps) * 0.05
  })
  return null
}
