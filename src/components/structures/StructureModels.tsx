import type { Material } from 'three'
import { createToonMaterial, MATERIALS } from '@/materials/toonMaterials'
import type { StructureType } from '@/config/structures'

const panelCells = createToonMaterial({ color: '#2b4fa8', emissive: '#18306a', emissiveIntensity: 0.3 })
const fabric = createToonMaterial({ color: '#e0a35a', flatShading: true })
export const waterMat = createToonMaterial({ color: '#5fb8e0', emissive: '#2a8fc0', emissiveIntensity: 0.4 })
export const rodCrystal = createToonMaterial({ color: '#b6f4ff', emissive: '#5fd4ff', emissiveIntensity: 1.4, flatShading: true })
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
    case 'windTurbine':
      return (
        <group>
          <mesh material={m(MATERIALS.shipDark)} position-y={0.12} castShadow>
            <cylinderGeometry args={[0.5, 0.6, 0.24, 8]} />
          </mesh>
          <mesh material={m(MATERIALS.palmTrunk)} position-y={2.6} castShadow>
            <cylinderGeometry args={[0.1, 0.18, 5, 6]} />
          </mesh>
          <mesh material={m(MATERIALS.shipHull)} position={[0, 5.2, 0.1]} castShadow>
            <boxGeometry args={[0.36, 0.36, 0.7]} />
          </mesh>
          {/* Aspas: las gira <Structures/> según el viento */}
          <group name="turbine-rotor" position={[0, 5.2, 0.5]}>
            {[0, 1, 2].map((i) => (
              <group key={i} rotation-z={(i * Math.PI * 2) / 3}>
                <mesh material={m(fabric)} position-y={1.2} castShadow>
                  <boxGeometry args={[0.28, 2.4, 0.05]} />
                </mesh>
              </group>
            ))}
            <mesh material={m(MATERIALS.shipAccent)} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.16, 0.3, 8]} />
            </mesh>
          </group>
        </group>
      )
    case 'rainCollector':
      return (
        <group>
          {[0, 1, 2].map((i) => {
            const a = (i * Math.PI * 2) / 3
            return (
              <mesh key={i} material={m(MATERIALS.palmTrunk)} position={[Math.cos(a) * 0.55, 0.55, Math.sin(a) * 0.55]} castShadow>
                <cylinderGeometry args={[0.05, 0.06, 1.1, 5]} />
              </mesh>
            )
          })}
          {/* Embudo de fibra y depósito */}
          <mesh material={m(fabric)} position-y={1.35} castShadow>
            <cylinderGeometry args={[0.95, 0.35, 0.5, 10, 1, true]} />
          </mesh>
          <mesh material={m(MATERIALS.shipHull)} position-y={0.6} castShadow>
            <cylinderGeometry args={[0.45, 0.45, 0.9, 10]} />
          </mesh>
          {!override && (
            <mesh name="collector-water" material={waterMat} position-y={1.06} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.42, 12]} />
            </mesh>
          )}
        </group>
      )
    case 'lightningRod':
      return (
        <group>
          <mesh material={m(MATERIALS.shipDark)} position-y={0.15} castShadow>
            <cylinderGeometry args={[0.45, 0.55, 0.3, 8]} />
          </mesh>
          <mesh material={m(MATERIALS.shipHull)} position-y={2.6} castShadow>
            <cylinderGeometry args={[0.06, 0.11, 5, 6]} />
          </mesh>
          {[1.4, 2.2, 3.0].map((y) => (
            <mesh key={y} material={m(MATERIALS.shipAccent)} position-y={y} rotation-x={Math.PI / 2}>
              <torusGeometry args={[0.2, 0.04, 5, 10]} />
            </mesh>
          ))}
          <mesh name="rod-tip" material={m(rodCrystal)} position-y={5.35}>
            <octahedronGeometry args={[0.28, 0]} />
          </mesh>
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
