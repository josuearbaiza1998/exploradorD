import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { ModelSlot } from "@/components/common/ModelSlot";
import { PALETTE } from "@/config/palette";
import { createToonMaterial, sharedToon } from "@/materials/toonMaterials";
import { Outlined } from "@/components/common/Outlined";
import { Backpack } from "@/components/player/Backpack";
import { useGameStore } from "@/store/gameStore";
import type { DroppedBox } from "@/store/slices/inventorySlice";

/**
 * Cajas de inventario soltadas en modo emergencia.
 * Para encontrarlas no hay flechas ni minimapa: cada caja tiene una baliza
 * diegética (luz que parpadea y un haz tenue que se ve mejor de noche).
 */
export function DroppedBoxes() {
  const boxes = useGameStore((s) => s.droppedBoxes);
  return (
    <group name="dropped-boxes">
      {boxes.map((b) => (
        <InventoryBox key={b.id} box={b} />
      ))}
    </group>
  );
}

function InventoryBox({ box }: { box: DroppedBox }) {
  const beacon = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const sandMat = sharedToon(PALETTE.sandDark);
  const beaconMat = useMemo(
    () =>
      createToonMaterial({
        color: PALETTE.shipAccent,
        emissive: PALETTE.shipAccent,
        emissiveIntensity: 1.5,
      }),
    [],
  );
  const beamMat = useMemo(
    () =>
      createToonMaterial({
        color: PALETTE.shipAccent,
        emissive: PALETTE.shipAccent,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  // Pequeña inclinación determinista: parece caída, no colocada.
  const tilt = useMemo(
    () => (box.position[0] * 13.7 + box.position[2] * 7.3) % 0.25,
    [box.position],
  );

  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 5) > 0.2;
    beaconMat.emissiveIntensity = on ? 2 : 0.2;
    if (beam.current)
      beam.current.scale.x = beam.current.scale.z =
        1 + Math.sin(clock.elapsedTime * 2) * 0.15;
  });

  const buried = !!box.buried;
  return (
    <group position={box.position}>
      {/* Montículo de arena encima si la tormenta la enterró */}
      {buried && (
        <mesh
          material={sandMat}
          scale={[1.1, 0.42 + (box.buried ?? 0) * 0.08, 1.1]}
          receiveShadow
          castShadow
        >
          <icosahedronGeometry args={[0.8, 1]} />
        </mesh>
      )}
      <group
        position-y={buried ? -0.45 : 0}
        rotation={[buried ? tilt + 0.35 : tilt, tilt * 6, -tilt]}
      >
        <ModelSlot
          id="inventoryBox"
          placeholder={
            // La misma mochila que lleva el robot: el jugador la reconoce al buscarla.
            <group position={[0, 0.29, 0.19]} scale={0.8}>
              <Outlined thickness={0.03}>
                <Backpack battery={false} />
              </Outlined>
            </group>
          }
        />
        <mesh ref={beacon} material={beaconMat} position={[-0.18, 1.0, -0.1]}>
          <icosahedronGeometry args={[0.09, 0]} />
        </mesh>
        <mesh
          ref={beam}
          material={beamMat}
          position={[-0.18, 12, -0.1]}
          renderOrder={2}
        >
          <cylinderGeometry args={[0.12, 0.12, 22, 6, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}
