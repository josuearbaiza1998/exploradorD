import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { createToonMaterial } from '@/materials/toonMaterials'
import { getGame, useGameStore } from '@/store/gameStore'
import { buildSpot, checkPlacement } from '@/systems/building'
import { buildPreview } from '@/systems/buildPreview'
import { StructurePlaceholder } from './StructureModels'

/** Vista previa translúcida de la estructura a construir: verde = se puede, roja = no. */
export function BuildGhost() {
  const build = useGameStore((s) => s.build)
  const ref = useRef<Group>(null)
  const ok = useMemo(() => createToonMaterial({ color: '#6dff9a', transparent: true, opacity: 0.45, depthWrite: false }), [])
  const bad = useMemo(() => createToonMaterial({ color: '#ff6060', transparent: true, opacity: 0.45, depthWrite: false }), [])
  const valid = useRef(true)
  const groupOk = useRef<Group>(null)
  const groupBad = useRef<Group>(null)

  useFrame(() => {
    const b = getGame().build
    if (!b || !ref.current) return
    const spot = buildSpot()
    const check = checkPlacement(b.type, spot.x, spot.z)
    buildPreview.check = check
    valid.current = check.ok
    ref.current.position.set(check.x, check.y, check.z)
    ref.current.rotation.y = b.rot
    if (groupOk.current) groupOk.current.visible = check.ok
    if (groupBad.current) groupBad.current.visible = !check.ok
  })

  if (!build) return null
  return (
    <group ref={ref}>
      <group ref={groupOk}>
        <StructurePlaceholder type={build.type} override={ok} />
      </group>
      <group ref={groupBad} visible={false}>
        <StructurePlaceholder type={build.type} override={bad} />
      </group>
    </group>
  )
}
