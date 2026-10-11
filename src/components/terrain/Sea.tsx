import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { PALETTE } from '@/config/palette'
import { ISLAND } from '@/config/world'
import { focus } from '@/systems/focus'
import { createToonMaterial } from '@/materials/toonMaterials'

const seaMaterial = createToonMaterial({ color: PALETTE.sea, bands: 2, transparent: true, opacity: 0.92 })

/** Mar que rodea la isla. Sigue al foco para parecer infinito. */
export function Sea() {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.x = focus.x
    ref.current.position.z = focus.z
    ref.current.position.y = ISLAND.seaLevel + Math.sin(clock.elapsedTime * 0.6) * 0.08
  })
  if (!ISLAND.enabled) return null
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} material={seaMaterial} receiveShadow>
      <planeGeometry args={[1600, 1600, 1, 1]} />
    </mesh>
  )
}
