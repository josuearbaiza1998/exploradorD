import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { ModelSlot } from '@/components/common/ModelSlot'
import { PALETTE } from '@/config/palette'
import { MATERIALS, createToonMaterial } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import type { DroppedBox } from '@/store/slices/inventorySlice'

/**
 * Cajas de inventario soltadas en modo emergencia.
 * Para encontrarlas no hay flechas ni minimapa: cada caja tiene una baliza
 * diegética (luz que parpadea y un haz tenue que se ve mejor de noche).
 */
export function DroppedBoxes() {
  const boxes = useGameStore((s) => s.droppedBoxes)
  return (
    <group name="dropped-boxes">
      {boxes.map((b) => (
        <InventoryBox key={b.id} box={b} />
      ))}
    </group>
  )
}

function InventoryBox({ box }: { box: DroppedBox }) {
  const beacon = useRef<Mesh>(null)
  const beam = useRef<Mesh>(null)
  const beaconMat = useMemo(
    () => createToonMaterial({ color: PALETTE.shipAccent, emissive: PALETTE.shipAccent, emissiveIntensity: 1.5 }),
    [],
  )
  const beamMat = useMemo(
    () => createToonMaterial({ color: PALETTE.shipAccent, emissive: PALETTE.shipAccent, emissiveIntensity: 1, transparent: true, opacity: 0.18, depthWrite: false, fog: false }),
    [],
  )
  // Pequeña inclinación determinista: parece caída, no colocada.
  const tilt = useMemo(() => (box.position[0] * 13.7 + box.position[2] * 7.3) % 0.25, [box.position])

  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 5) > 0.2
    beaconMat.emissiveIntensity = on ? 2 : 0.2
    if (beam.current) beam.current.scale.x = beam.current.scale.z = 1 + Math.sin(clock.elapsedTime * 2) * 0.15
  })

  return (
    <group position={box.position} rotation={[tilt, tilt * 6, -tilt]}>
      <ModelSlot
        id="inventoryBox"
        placeholder={
          <group>
            <mesh material={MATERIALS.shipHull} position-y={0.35} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.7, 0.65]} />
            </mesh>
            <mesh material={MATERIALS.shipAccent} position-y={0.35}>
              <boxGeometry args={[0.94, 0.14, 0.69]} />
            </mesh>
            {/* Antena de la baliza */}
            <mesh material={MATERIALS.shipDark} position={[0.3, 0.95, 0.2]}>
              <boxGeometry args={[0.04, 0.5, 0.04]} />
            </mesh>
          </group>
        }
      />
      <mesh ref={beacon} material={beaconMat} position={[0.3, 1.22, 0.2]}>
        <icosahedronGeometry args={[0.09, 0]} />
      </mesh>
      <mesh ref={beam} material={beamMat} position={[0.3, 12, 0.2]} renderOrder={2}>
        <cylinderGeometry args={[0.12, 0.12, 22, 6, 1, true]} />
      </mesh>
    </group>
  )
}
