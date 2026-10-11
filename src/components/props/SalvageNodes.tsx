import { CRASH_SITE } from '@/config/world'
import { MATERIALS } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { SALVAGE_WORLD } from '@/systems/interaction/interactables'

/**
 * Chatarra de la nave (scavenging): escombros sueltos que se desmontan a
 * mano y paneles del casco que requieren el hacha. Son finitos: la nave es
 * la fuente inicial de metal, pero se agota.
 */
export function SalvageNodes() {
  const harvested = useGameStore((s) => s.harvested)
  return (
    <group name="salvage">
      {SALVAGE_WORLD.filter((n) => !(n.key in harvested)).map((n) =>
        n.kind === 'debris' ? (
          <group key={n.id} position={[n.x, n.y, n.z]} rotation={[n.rot * 0.3, n.rot, n.rot * 0.2]}>
            <mesh material={MATERIALS.shipHull} position-y={0.3} castShadow receiveShadow>
              <boxGeometry args={[1.4, 0.6, 1.1]} />
            </mesh>
            <mesh material={MATERIALS.shipAccent} position={[0.3, 0.65, 0.1]} rotation-z={0.5} castShadow>
              <boxGeometry args={[0.8, 0.12, 0.5]} />
            </mesh>
          </group>
        ) : (
          // Panel del casco: placa naranja atornillada al costado de la nave.
          <group key={n.id} position={[n.x, n.y, n.z]} rotation-y={-CRASH_SITE.rotation + n.rot}>
            <mesh material={MATERIALS.shipAccent} position-x={0.05} castShadow>
              <boxGeometry args={[0.15, 1.6, 2.6]} />
            </mesh>
            {[-0.9, 0.9].map((z) => (
              <mesh key={z} material={MATERIALS.shipDark} position={[0.14, 0.6, z]}>
                <boxGeometry args={[0.06, 0.18, 0.18]} />
              </mesh>
            ))}
          </group>
        ),
      )}
    </group>
  )
}
