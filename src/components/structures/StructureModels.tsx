import type { Material } from 'three'
import { createToonMaterial, MATERIALS } from '@/materials/toonMaterials'
import type { StructureType } from '@/config/structures'

const panelCells = createToonMaterial({ color: '#2b4fa8', emissive: '#18306a', emissiveIntensity: 0.3 })
const fabric = createToonMaterial({ color: '#e0a35a', flatShading: true })
export const bankLightMaterial = createToonMaterial({ color: '#3ad0ff', emissive: '#3ad0ff', emissiveIntensity: 1 })

/**
 * Primitivas temporales de cada estructura (pivote en el suelo).
 * `override` sustituye todos los materiales (vista previa de construcción).
 */
export function StructurePlaceholder({ type, override }: { type: StructureType; override?: Material }) {
  const m = (mat: Material) => override ?? mat
  switch (type) {
    case 'solarPanel':
      return (
        <group>
          <mesh material={m(MATERIALS.shipDark)} position-y={0.7} castShadow>
            <cylinderGeometry args={[0.08, 0.12, 1.4, 6]} />
          </mesh>
          <mesh material={m(panelCells)} position-y={1.45} rotation-x={-0.6} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.08, 1.4]} />
          </mesh>
          <mesh material={m(MATERIALS.shipHull)} position-y={1.43} rotation-x={-0.6}>
            <boxGeometry args={[2.3, 0.05, 1.5]} />
          </mesh>
        </group>
      )
    case 'batteryBank':
      return (
        <group>
          <mesh material={m(MATERIALS.shipHull)} position-y={0.6} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.2, 0.8]} />
          </mesh>
          <mesh material={m(MATERIALS.shipDark)} position-y={1.25} castShadow>
            <boxGeometry args={[1.15, 0.1, 0.85]} />
          </mesh>
          {/* Indicador de carga: su altura la ajusta <BatteryBankLight/> */}
          {!override && (
            <mesh name="bank-light" material={bankLightMaterial} position={[0, 0.15, 0.41]}>
              <boxGeometry args={[0.18, 0.9, 0.02]} />
            </mesh>
          )}
        </group>
      )
    case 'shelter':
      return (
        <group>
          {[
            [2.2, 2.2],
            [-2.2, 2.2],
            [2.2, -2.2],
            [-2.2, -2.2],
          ].map(([x, z]) => (
            <mesh key={`${x}${z}`} material={m(MATERIALS.palmTrunk)} position={[x, 1.4, z]} castShadow>
              <cylinderGeometry args={[0.15, 0.2, 2.8, 5]} />
            </mesh>
          ))}
          {/* Techo a cuatro aguas de fibra tejida */}
          <mesh material={m(fabric)} position-y={3.4} rotation-y={Math.PI / 4} castShadow receiveShadow>
            <coneGeometry args={[3.7, 1.6, 4, 1, true]} />
          </mesh>
          {/* Paravientos en el lado de barlovento */}
          <mesh material={m(fabric)} position={[0, 1.1, -2.2]} castShadow>
            <boxGeometry args={[4.2, 2.2, 0.08]} />
          </mesh>
        </group>
      )
  }
}
