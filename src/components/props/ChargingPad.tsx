import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CHARGING_PAD } from '@/config/world'
import { PALETTE } from '@/config/palette'
import { MATERIALS, createToonMaterial } from '@/materials/toonMaterials'
import { getGame } from '@/store/gameStore'
import { getHeight } from '@/utils/terrain/heightfield'

const y = getHeight(CHARGING_PAD.x, CHARGING_PAD.z)

/** Plataforma de recarga junto a la nave: su anillo brilla mientras el robot carga. */
export function ChargingPad() {
  const ring = useMemo(
    () => createToonMaterial({ color: PALETTE.robotAccent, emissive: PALETTE.robotAccent, emissiveIntensity: 0.3 }),
    [],
  )
  useFrame(({ clock }) => {
    const charging = getGame().mode === 'recharging'
    ring.emissiveIntensity = charging ? 1 + Math.sin(clock.elapsedTime * 4) * 0.5 : 0.3
  })
  return (
    <group name="charging-pad" position={[CHARGING_PAD.x, y, CHARGING_PAD.z]}>
      <mesh material={MATERIALS.shipDark} position-y={0.08} receiveShadow castShadow>
        <cylinderGeometry args={[1.8, 2, 0.16, 8]} />
      </mesh>
      <mesh material={ring} position-y={0.17} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[1.35, 0.08, 4, 16]} />
      </mesh>
      {/* Poste con cable hacia la nave */}
      <mesh material={MATERIALS.shipHull} position={[1.9, 0.9, 0]} castShadow>
        <boxGeometry args={[0.25, 1.8, 0.25]} />
      </mesh>
      <mesh material={ring} position={[1.9, 1.85, 0]}>
        <boxGeometry args={[0.35, 0.12, 0.35]} />
      </mesh>
    </group>
  )
}
