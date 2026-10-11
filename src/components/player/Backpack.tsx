import { MATERIALS, robotBatteryMaterial, sharedToon } from '@/materials/toonMaterials'
import { PALETTE } from '@/config/palette'

/**
 * Mochila-caja de la sonda: guarda el inventario y lleva un panel solar
 * lateral y la barra de batería (UI diegética). Es la misma caja que se suelta
 * en modo emergencia, así el jugador la reconoce al buscarla.
 * Pivote: centro de la cara que toca la espalda; +Z apunta hacia el robot.
 */
export function Backpack({ battery = true }: { battery?: boolean }) {
  const shell = sharedToon(PALETTE.backpack)
  const frame = sharedToon(PALETTE.robotJoint)
  const cell = sharedToon(PALETTE.solarCell, { bands: 2, emissive: '#3b6fd6', emissiveIntensity: 0.15 })
  return (
    <group>
      {/* Caja */}
      <mesh material={shell} position={[0, 0, -0.24]} castShadow>
        <boxGeometry args={[0.62, 0.7, 0.46]} />
      </mesh>
      {/* Tapa y correas */}
      <mesh material={frame} position={[0, 0.37, -0.24]} castShadow>
        <boxGeometry args={[0.66, 0.08, 0.5]} />
      </mesh>
      <mesh material={frame} position={[0, -0.1, -0.24]}>
        <boxGeometry args={[0.64, 0.06, 0.48]} />
      </mesh>
      {/* Panel solar plegado en el lateral, algo abierto */}
      <group position={[0.33, 0.05, -0.24]} rotation-z={-0.35}>
        <mesh material={frame} position={[0.04, 0, 0]}>
          <boxGeometry args={[0.04, 0.6, 0.5]} />
        </mesh>
        <mesh material={cell} position={[0.065, 0, 0]}>
          <boxGeometry args={[0.02, 0.54, 0.44]} />
        </mesh>
      </group>
      {/* Antena corta */}
      <mesh material={MATERIALS.shipDark} position={[-0.22, 0.6, -0.36]}>
        <boxGeometry args={[0.03, 0.42, 0.03]} />
      </mesh>
      {battery && (
        <mesh material={robotBatteryMaterial} position={[0, 0.02, -0.475]}>
          <boxGeometry args={[0.14, 0.5, 0.02]} />
        </mesh>
      )}
    </group>
  )
}
