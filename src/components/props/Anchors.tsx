import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three'
import { ANCHORS, ANCHOR_RING } from '@/config/grapple'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { anchorTop, grapple } from '@/systems/grapple'
import { player } from '@/systems/player'
import { getHeight } from '@/utils/terrain/heightfield'
import { Outlined } from '@/components/common/Outlined'

/** Postes de anclaje (con aro naranja) y la cuerda del gancho en vuelo. */
export function Anchors() {
  const hasHook = useGameStore((s) => !!s.inventory.hook)
  // El aro brilla cuando ya tienes el gancho: indica que se puede usar.
  const ring = hasHook ? sharedToon('#ffb347', { emissive: '#ff9a2e', emissiveIntensity: 0.9 }) : MATERIALS.shipAccent
  return (
    <>
      {ANCHORS.map((a) => (
        <group key={a.id} position={[a.x, getHeight(a.x, a.z), a.z]}>
          <Outlined thickness={0.03}>
            <mesh material={MATERIALS.shipDark} position-y={ANCHOR_RING / 2} castShadow>
              <cylinderGeometry args={[0.1, 0.16, ANCHOR_RING, 6]} />
            </mesh>
            <mesh material={ring} position-y={ANCHOR_RING} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.32, 0.07, 6, 12]} />
            </mesh>
            <mesh material={MATERIALS.shipHull} position-y={0.1}>
              <cylinderGeometry args={[0.4, 0.5, 0.2, 6]} />
            </mesh>
          </Outlined>
        </group>
      ))}
      <Rope />
    </>
  )
}

function Rope() {
  const line = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
    const l = new Line(g, new LineBasicMaterial({ color: '#2b211c' }))
    l.frustumCulled = false
    l.visible = false
    return l
  }, [])
  useFrame(() => {
    line.visible = grapple.active && !!grapple.anchor
    if (!line.visible || !grapple.anchor) return
    const a = grapple.anchor
    const attr = line.geometry.getAttribute('position') as BufferAttribute
    ;(attr.array as Float32Array).set([player.position.x, player.position.y + 1.3, player.position.z, a.x, anchorTop(a), a.z])
    attr.needsUpdate = true
  })
  return <primitive object={line} />
}
