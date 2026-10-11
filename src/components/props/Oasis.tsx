import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { PALETTE } from '@/config/palette'
import { OASIS } from '@/config/world'
import { createToonMaterial } from '@/materials/toonMaterials'
import { OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'

const waterMaterial = createToonMaterial({
  color: PALETTE.oasisWater,
  emissive: PALETTE.oasisWaterDeep,
  emissiveIntensity: 0.35,
  bands: 2,
  transparent: true,
  opacity: 0.88,
})

/**
 * Oasis: agua cian brillante (ligeramente emisiva para que destaque incluso
 * al atardecer). La hierba verde la pinta el terreno y las palmeras las
 * distribuye <Vegetation/> por proximidad.
 */
export function Oasis() {
  const water = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = OASIS_WATER_LEVEL + Math.sin(clock.elapsedTime * 0.8) * 0.04
  })
  return (
    <group name="oasis" position={[OASIS.x, 0, OASIS.z]}>
      <mesh ref={water} rotation-x={-Math.PI / 2} material={waterMaterial} receiveShadow>
        <circleGeometry args={[OASIS.radius * 1.15, 28]} />
      </mesh>
    </group>
  )
}
