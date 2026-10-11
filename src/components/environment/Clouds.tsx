import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, IcosahedronGeometry, Object3D, type InstancedMesh } from 'three'
import { createToonMaterial } from '@/materials/toonMaterials'
import { environment } from '@/systems/environmentState'
import { focus } from '@/systems/focus'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import { createRng } from '@/utils/random'

const CLOUDS = 18
const PUFFS_PER_CLOUD = 6
const AREA = 300
const ALTITUDE = 95

type Cloud = { x: number; z: number; y: number; size: number; puffs: { x: number; y: number; z: number; s: number }[] }

/**
 * Nubes lowpoly estilizadas: grupos de "bolas" achatadas que el viento
 * arrastra. Proyectan sombra (manchas que cruzan el desierto). Con lluvia
 * aparecen más y se oscurecen; con calma quedan unas pocas.
 * Una sola malla instanciada.
 */
export function Clouds() {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geometry = useMemo(() => new IcosahedronGeometry(1, 1), [])
  const material = useMemo(() => createToonMaterial({ color: '#ffffff', flatShading: true, bands: 2 }), [])
  const clouds = useMemo<Cloud[]>(() => {
    const rng = createRng(4242)
    return Array.from({ length: CLOUDS }, () => {
      const size = 9 + rng() * 14
      return {
        x: (rng() - 0.5) * AREA * 2,
        z: (rng() - 0.5) * AREA * 2,
        y: ALTITUDE + rng() * 40,
        size,
        puffs: Array.from({ length: PUFFS_PER_CLOUD }, (_, i) => ({
          x: (rng() - 0.5) * size * 2.2,
          y: (i === 0 ? 0.4 : rng() * 0.5) * size * 0.4,
          z: (rng() - 0.5) * size * 1.1,
          s: size * (i === 0 ? 0.9 : 0.45 + rng() * 0.4),
        })),
      }
    })
  }, [])
  const white = useMemo(() => new Color('#ffffff'), [])
  const storm = useMemo(() => new Color('#5d6270'), [])
  const tmp = useMemo(() => new Color(), [])

  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    for (let i = 0; i < CLOUDS * PUFFS_PER_CLOUD; i++) m.setColorAt(i, white)
  }, [white])

  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return
    const dt = Math.min(delta, 0.1)
    // Cobertura: pocas con sol, todas con lluvia.
    const cover = Math.min(1, 0.45 + (1 - weatherState.sun) * 1.2 + weatherState.rain)
    const visible = Math.round(CLOUDS * cover)
    const dark = Math.min(1, weatherState.rain * 1.2 + (1 - weatherState.sun) * 0.4)
    // De noche las nubes reflejan el color del cielo.
    tmp.copy(white).lerp(storm, dark).lerp(environment.palette.skyHorizon, 0.25).multiplyScalar(0.35 + environment.palette.daylight * 0.65)
    const speed = 2 + wind.strength * 10
    let k = 0
    for (let c = 0; c < CLOUDS; c++) {
      const cl = clouds[c]
      cl.x += wind.dirX * speed * dt
      cl.z += wind.dirZ * speed * dt
      // Envolver alrededor del jugador.
      const rx = ((((cl.x - focus.x) % (AREA * 2)) + AREA * 3) % (AREA * 2)) - AREA
      const rz = ((((cl.z - focus.z) % (AREA * 2)) + AREA * 3) % (AREA * 2)) - AREA
      const show = c < visible ? 1 : 0
      for (const p of cl.puffs) {
        dummy.position.set(focus.x + rx + p.x, cl.y + p.y, focus.z + rz + p.z)
        dummy.scale.set(p.s * show, p.s * 0.55 * show, p.s * 0.8 * show)
        dummy.rotation.set(0, c, 0)
        dummy.updateMatrix()
        m.setMatrixAt(k, dummy.matrix)
        m.setColorAt(k, tmp)
        k++
      }
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, CLOUDS * PUFFS_PER_CLOUD]} frustumCulled={false} castShadow />
}
