import { HARVEST } from '@/config/harvest'
import { MATERIALS } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'

/**
 * Herramienta en la mano del robot: aparece la que sirve para el objetivo
 * actual (si la tiene). Placeholder de primitivas; sustituible por .glb.
 */
export function HeldTool() {
  const tool = useGameStore((s) => {
    const needed = s.target ? HARVEST[s.target.kind].tool : undefined
    return needed && s.inventory[needed] ? needed : null
  })
  if (!tool) return null
  return (
    <group position={[0.5, 1.0, 0.25]} rotation={[0.9, 0, -0.25]}>
      <mesh material={MATERIALS.shipDark} castShadow>
        <boxGeometry args={[0.07, 0.75, 0.07]} />
      </mesh>
      {tool === 'axe' ? (
        <mesh material={MATERIALS.robotAccent} position={[0, 0.32, 0.12]}>
          <boxGeometry args={[0.04, 0.22, 0.26]} />
        </mesh>
      ) : (
        <mesh material={MATERIALS.shipAccent} position={[0, 0.34, 0]}>
          <boxGeometry args={[0.16, 0.16, 0.34]} />
        </mesh>
      )}
    </group>
  )
}
