import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, ConeGeometry, Group, MeshBasicMaterial, SpriteMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { cave } from '@/config/cave'
import { FAR_ISLAND } from '@/config/farIsland'
import { ISLAND } from '@/config/world'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'
import { radialTexture } from '@/utils/radialTexture'

const DARK = new Color('#1c2436')

/** Montes de la isla lejana: conos de pocas caras deformados (perfil irregular), en una sola malla. */
function islandGeometry() {
  const parts = [
    { x: 0, z: 0, r: 120, h: FAR_ISLAND.peak, seg: 11 },
    { x: -95, z: 25, r: 85, h: 42, seg: 9 },
    { x: 85, z: -15, r: 95, h: 34, seg: 9 },
    { x: 175, z: 10, r: 70, h: 16, seg: 8 },
    { x: -185, z: -10, r: 60, h: 11, seg: 7 },
  ].map((p, k) => {
    const g = new ConeGeometry(p.r, p.h, p.seg, 3, true)
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const a = Math.atan2(z, x)
      const t = y / p.h + 0.5 // 0 abajo, 1 cima
      // Hombros y quebradas: el radio y la altura varían con el ángulo.
      const n = Math.sin(a * 3 + k * 1.7) * 0.18 + Math.sin(a * 7 + k) * 0.08
      const bulge = 1 + n + Math.sin(t * Math.PI) * 0.25
      pos.setXYZ(i, x * bulge, (t * t * (1.6 - 0.6 * t)) * p.h * (1 + n * 0.5 * t), z * bulge)
    }
    g.translate(p.x, 0, p.z)
    return g
  })
  // Encogida en planta: el barco llega hasta el muro de tormenta sin meterse dentro de la silueta.
  return mergeGeometries(parts)!.scale(0.7, 1, 0.7)
}

/**
 * Silueta de la otra isla en el horizonte. Sin niebla (está más allá de su
 * alcance): se tiñe a mano con el color del horizonte para parecer lejana y
 * desaparece con el mal tiempo. De noche parpadea una baliza en la cima.
 */
export function FarIsland() {
  const group = useRef<Group>(null)
  const geo = useMemo(islandGeometry, [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: '#445', fog: false }), [])
  const beacon = useMemo(
    () => new SpriteMaterial({ map: radialTexture(), color: '#ff5a4a', blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }),
    [],
  )
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.visible = !cave.active
    // Con tormenta o calima la isla se pierde en el horizonte.
    const haze = Math.min(1, weatherState.tintAmount * 1.4)
    const p = environment.palette
    mat.color.copy(p.skyHorizon).lerp(DARK, 0.42 * (1 - haze))
    // Baliza: destello doble cada pocos segundos, solo de noche y con buena visibilidad.
    const night = Math.max(0, 1 - p.daylight * 1.8)
    const t = clock.elapsedTime % 3
    const on = t < 0.18 || (t > 0.42 && t < 0.6) ? 1 : 0.12
    beacon.opacity = on * night * (1 - haze)
  })
  return (
    <group ref={group} position={[FAR_ISLAND.x, ISLAND.seaLevel - 1, FAR_ISLAND.z]} rotation-y={0.3}>
      <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-0.5} />
      <sprite material={beacon} position-y={FAR_ISLAND.peak + 2} scale={20} />
    </group>
  )
}
