import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { HARVEST } from '@/config/harvest'
import { createToonMaterial } from '@/materials/toonMaterials'
import { getGame } from '@/store/gameStore'
import { getHeight } from '@/utils/terrain/heightfield'

/**
 * Anillo en el suelo bajo el recurso seleccionado: indica QUÉ vas a
 * recolectar sin retícula ni texto. Ámbar si falta la herramienta.
 */
export function InteractionHighlight() {
  const ring = useRef<Mesh>(null)
  const ok = useMemo(() => createToonMaterial({ color: '#ffffff', emissive: '#bff6ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), [])
  const locked = useMemo(() => createToonMaterial({ color: '#ffb84d', emissive: '#ff9a1f', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), [])

  useFrame(({ clock }) => {
    const mesh = ring.current
    if (!mesh) return
    const game = getGame()
    const t = game.target
    mesh.visible = !!t
    if (!t) return
    const def = HARVEST[t.kind]
    const hasTool = !def.tool || !!game.inventory[def.tool]
    mesh.material = hasTool ? ok : locked
    const [x, , z] = t.position
    const r = Math.min(t.radius, 2.2) + 0.35
    // Progreso de golpes: el anillo se "cierra" con cada golpe.
    const progress = (game.hits[t.key] ?? 0) / def.hits
    const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.05
    mesh.position.set(x, getHeight(x, z) + 0.08, z)
    mesh.scale.setScalar(r * pulse * (1 - progress * 0.35))
  })

  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
      <ringGeometry args={[0.85, 1, 24]} />
    </mesh>
  )
}
