import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, IcosahedronGeometry, Object3D, type InstancedMesh } from 'three'
import { PALETTE } from '@/config/palette'
import { createToonMaterial } from '@/materials/toonMaterials'
import { environment } from '@/systems/environmentState'
import { wind } from '@/systems/wind'

const PUFFS = 56
const MAX_HEIGHT = 85
const RISE_SPEED = 0.04 // ciclos por segundo

/**
 * Columna de humo de la nave: el FARO principal del mundo.
 * - Material sin niebla (fog: false) => visible desde cualquier punto de la isla.
 * - Se inclina con el viento global.
 * - Puffs instanciados: 1 draw call.
 */
export function SmokeColumn({ position, clean = false }: { position: [number, number, number]; clean?: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geometry = useMemo(() => new IcosahedronGeometry(1, 1), [])
  const material = useMemo(
    () => createToonMaterial({ color: '#ffffff', flatShading: true, fog: false, bands: 2 }),
    [],
  )
  const seeds = useMemo(
    () =>
      Array.from({ length: PUFFS }, (_, i) => ({
        phase: i / PUFFS,
        jx: Math.sin(i * 12.9898) * 0.7,
        jz: Math.cos(i * 78.233) * 0.7,
        size: 0.75 + ((i * 0.618) % 1) * 0.5,
      })),
    [],
  )
  // Humo denso de combustible: casi negro abajo, pardo grisáceo arriba (como el concept).
  // Con el motor reparado sale vapor blanco y fino en lugar de humo negro.
  const dark = useMemo(() => new Color(clean ? '#dfe9ef' : PALETTE.smokeDark), [clean])
  const light = useMemo(() => new Color(clean ? '#ffffff' : '#8a7d72'), [clean])
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
      const y = life * MAX_HEIGHT * (clean ? 0.45 : 1)
      const drift = life * life * 40 * (0.4 + wind.strength)
      // Ondulación lenta: el humo "hierve" en lugar de subir en línea recta.
      const billow = Math.sin(t * 0.7 + i * 1.7) * (0.5 + life * 3)
      dummy.position.set(
        s.jx * (1 + life * 7) + wind.dirX * drift + billow,
        y,
        s.jz * (1 + life * 7) + wind.dirZ * drift + Math.cos(t * 0.6 + i) * life * 2,
      )
      const grow = (1.8 + life * 12) * s.size * (clean ? 0.45 : 1)
      const fade = life > 0.85 ? 1 - (life - 0.85) / 0.15 : Math.min(1, life * 8)
      dummy.scale.setScalar(grow * fade)
      dummy.rotation.set(life * 3 + i, life * 2, i)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      tmp.copy(dark).lerp(light, Math.min(1, life * 1.1 + nightLift * 0.35))
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
    />
  )
}
