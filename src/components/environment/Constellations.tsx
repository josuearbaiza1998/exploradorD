import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, LineBasicMaterial, PointsMaterial, type Group } from 'three'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'

const R = 480

/**
 * Constelaciones pequeñas: estrellas algo más brillantes, siempre en el mismo
 * sitio del cielo, unidas por trazos muy tenues. Sirven para orientarse de
 * noche sin brújula. Cada una: [azimut°, elevación°] por estrella y pares de
 * índices para las líneas.
 */
const CONSTELLATIONS: { stars: [number, number][]; lines: [number, number][] }[] = [
  // La Hélice (norte): tres palas alrededor de un centro.
  { stars: [[0, 34], [-6, 41], [7, 40], [1, 27], [-2, 34]], lines: [[4, 1], [4, 2], [4, 3], [4, 0]] },
  // El Ancla (este, sobre la otra isla).
  { stars: [[68, 22], [68, 31], [63, 25], [73, 25], [64, 18], [72, 18]], lines: [[1, 0], [2, 3], [0, 4], [0, 5]] },
  // La Mochila (sur): un cuadrado con asa.
  { stars: [[175, 30], [185, 30], [185, 22], [175, 22], [180, 35]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 1]] },
  // La Grulla (oeste): una línea quebrada larga.
  { stars: [[255, 20], [262, 26], [270, 28], [278, 25], [284, 31], [270, 35]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
]

/** Azimut 0 = norte (-Z), creciendo hacia el este (+X). */
function dir(az: number, el: number): [number, number, number] {
  const a = (az * Math.PI) / 180
  const e = (el * Math.PI) / 180
  return [Math.sin(a) * Math.cos(e) * R, Math.sin(e) * R, -Math.cos(a) * Math.cos(e) * R]
}

export function Constellations() {
  const group = useRef<Group>(null)
  const { points, lines, pointMat, lineMat } = useMemo(() => {
    const p: number[] = []
    const l: number[] = []
    for (const c of CONSTELLATIONS) {
      const xyz = c.stars.map(([az, el]) => dir(az, el))
      for (const s of xyz) p.push(...s)
      for (const [a, b] of c.lines) l.push(...xyz[a], ...xyz[b])
    }
    const points = new BufferGeometry()
    points.setAttribute('position', new Float32BufferAttribute(p, 3))
    const lines = new BufferGeometry()
    lines.setAttribute('position', new Float32BufferAttribute(l, 3))
    const pointMat = new PointsMaterial({ color: '#fff4dc', size: 3.4, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending })
    const lineMat = new LineBasicMaterial({ color: '#9fb8ff', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: AdditiveBlending })
    return { points, lines, pointMat, lineMat }
  }, [])
  useFrame(({ camera, clock }) => {
    const g = group.current
    if (!g) return
    const clear = 1 - Math.min(1, weatherState.tintAmount * 1.5)
    const night = Math.max(0, 1 - environment.palette.daylight * 1.6) * clear
    g.visible = night > 0.02 && !environment.inCave
    if (!g.visible) return
    g.position.copy(camera.position)
    pointMat.opacity = night * (0.85 + Math.sin(clock.elapsedTime * 2.3) * 0.15)
    lineMat.opacity = night * 0.14
  })
  return (
    <group ref={group} visible={false}>
      <points geometry={points} material={pointMat} frustumCulled={false} />
      <lineSegments geometry={lines} material={lineMat} frustumCulled={false} />
    </group>
  )
}
