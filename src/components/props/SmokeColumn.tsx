import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, IcosahedronGeometry, Object3D, type InstancedMesh } from 'three'
import { PALETTE } from '@/config/palette'
import { createToonMaterial } from '@/materials/toonMaterials'
import { environment } from '@/systems/environmentState'
import { wind } from '@/systems/wind'

const PUFFS = 36
const MAX_HEIGHT = 85
const RISE_SPEED = 0.045 // ciclos por segundo

/**
 * Columna de humo de la nave: el FARO principal del mundo.
 * - Material sin niebla (fog: false) => visible desde cualquier punto de la isla.
 * - Se inclina con el viento global.
 * - Puffs instanciados: 1 draw call.
 */
export function SmokeColumn({ position }: { position: [number, number, number] }) {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), [])
  const material = useMemo(
    () => createToonMaterial({ color: '#ffffff', flatShading: true, fog: false, transparent: true, opacity: 0.95 }),
    [],
  )
  const seeds = useMemo(
    () => Array.from({ length: PUFFS }, (_, i) => ({ phase: i / PUFFS, jx: Math.sin(i * 12.9898) * 0.5, jz: Math.cos(i * 78.233) * 0.5 })),
    [],
  )
  const dark = useMemo(() => new Color(PALETTE.smoke), [])
  const light = useMemo(() => new Color('#c9c4c0'), [])
  const tmp = useMemo(() => new Color(), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < PUFFS; i++) mesh.setColorAt(i, dark)
  }, [dark])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    // De noche el humo se aclara un poco para recortarse contra el cielo oscuro.
    const nightLift = 1 - environment.palette.daylight
    for (let i = 0; i < PUFFS; i++) {
      const s = seeds[i]
      const life = (t * RISE_SPEED + s.phase) % 1
      const y = life * MAX_HEIGHT
      const drift = life * life * 40 * (0.4 + wind.strength)
      dummy.position.set(s.jx * (1 + life * 6) + wind.dirX * drift, y, s.jz * (1 + life * 6) + wind.dirZ * drift)
      const grow = 1.6 + life * 9
      const fade = life > 0.85 ? 1 - (life - 0.85) / 0.15 : Math.min(1, life * 8)
      dummy.scale.setScalar(grow * fade)
      dummy.rotation.set(life * 3 + i, life * 2, i)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      tmp.copy(dark).lerp(light, Math.min(1, life * 1.3 + nightLift * 0.3))
      mesh.setColorAt(i, tmp)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, PUFFS]}
      position={position}
      frustumCulled={false}
      castShadow
    />
  )
}
