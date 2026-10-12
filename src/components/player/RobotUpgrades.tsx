import { Quaternion, Vector3, type Matrix4, type Object3D } from 'three'
import { BoneAttachment } from '@/components/common/BoneAttachment'
import { sharedToon } from '@/materials/toonMaterials'
import { PALETTE } from '@/config/palette'
import { useGameStore } from '@/store/gameStore'

/** Tramo de una extremidad medido en la pose de referencia (metros de root). */
export type Limb = { bone: Object3D; rest: Matrix4; mid: Vector3; quat: Quaternion; len: number }

/** Tramo entre dos huesos: punto medio y giro que lleva +Y a lo largo del tramo. */
export function limbBetween(bone: Object3D, rest: Matrix4, from: Vector3, to: Vector3): Limb {
  const dir = to.clone().sub(from)
  const len = dir.length()
  // +Y siempre hacia arriba del tramo: así +Z queda hacia delante del robot.
  if (dir.y < 0) dir.negate()
  return {
    bone,
    rest,
    mid: from.clone().add(to).multiplyScalar(0.5),
    quat: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
    len,
  }
}

const accent = () => sharedToon(PALETTE.shipAccent)
const dark = () => sharedToon(PALETTE.robotDark)
const thrust = () => sharedToon('#7fe3ff', { emissive: '#3ad0ff', emissiveIntensity: 1.2 })

/** Piernas: espinilleras naranjas que envuelven la pantorrilla (nivel 1) y propulsores pegados detrás (nivel 2). */
function LegParts({ limb, level }: { limb: Limb; level: number }) {
  return (
    <BoneAttachment bone={limb.bone} rest={limb.rest}>
      <group position={limb.mid} quaternion={limb.quat}>
        <mesh material={accent()} castShadow>
          <cylinderGeometry args={[0.1, 0.085, limb.len * 0.7, 8]} />
        </mesh>
        <mesh material={dark()} position-y={limb.len * 0.25}>
          <cylinderGeometry args={[0.108, 0.108, 0.05, 8]} />
        </mesh>
        {level >= 2 && (
          <group position={[0, -limb.len * 0.05, -0.12]}>
            <mesh material={dark()} castShadow>
              <cylinderGeometry args={[0.06, 0.075, limb.len * 0.45, 8]} />
            </mesh>
            <mesh material={thrust()} position-y={-limb.len * 0.245} userData={{ noOutline: true }}>
              <cylinderGeometry args={[0.05, 0.03, 0.05, 8]} />
            </mesh>
          </group>
        )}
      </group>
    </BoneAttachment>
  )
}

/** Brazos reforzados: guanteletes en los antebrazos. */
function ArmParts({ limb }: { limb: Limb }) {
  return (
    <BoneAttachment bone={limb.bone} rest={limb.rest}>
      <group position={limb.mid} quaternion={limb.quat}>
        <mesh material={dark()} castShadow>
          <cylinderGeometry args={[0.16, 0.13, limb.len * 0.75, 8]} />
        </mesh>
        <mesh material={accent()} position-y={limb.len * 0.2}>
          <cylinderGeometry args={[0.17, 0.17, 0.07, 8]} />
        </mesh>
      </group>
    </BoneAttachment>
  )
}

/** Garras de escalada: tres uñas curvas en el dorso de la mano. */
function ClawParts({ limb, level }: { limb: Limb; level: number }) {
  const mat = level >= 2 ? accent() : dark()
  return (
    <BoneAttachment bone={limb.bone} rest={limb.rest}>
      <group position={limb.mid} quaternion={limb.quat}>
        <mesh material={dark()} position-y={-limb.len * 0.3} castShadow>
          <boxGeometry args={[0.22, 0.12, 0.24]} />
        </mesh>
        {[-0.07, 0, 0.07].map((x) => (
          <mesh key={x} material={mat} position={[x, -limb.len * 0.55, 0.09]} rotation-x={Math.PI - 0.35} castShadow>
            <coneGeometry args={[0.025, 0.2, 4]} />
          </mesh>
        ))}
      </group>
    </BoneAttachment>
  )
}

/** Piezas de las mejoras que se ven en piernas y brazos. */
export function LimbUpgrades({ legs, arms }: { legs: Limb[]; arms: Limb[] }) {
  const legLevel = useGameStore((s) => s.upgrades.legs ?? 0)
  const armLevel = useGameStore((s) => s.upgrades.arms ?? 0)
  const climbLevel = useGameStore((s) => s.upgrades.climb ?? 0)
  return (
    <>
      {legLevel > 0 && legs.map((l, i) => <LegParts key={i} limb={l} level={legLevel} />)}
      {armLevel > 0 && arms.map((l, i) => <ArmParts key={i} limb={l} />)}
      {climbLevel > 0 && arms.map((l, i) => <ClawParts key={i} limb={l} level={climbLevel} />)}
    </>
  )
}

/**
 * Piezas de cabeza: aro naranja en las gafas (sensores 1), parasol de polvo
 * (sensores 2) y sensor nocturno verde que brilla al encenderlo.
 */
export function HeadUpgrades({ eyes, brow, temple }: { eyes: Vector3[]; brow: Vector3; temple: Vector3 }) {
  const sensors = useGameStore((s) => s.upgrades.sensors ?? 0)
  const night = useGameStore((s) => (s.upgrades.nightVision ?? 0) > 0)
  const nightOn = useGameStore((s) => s.nightVisionOn)
  const nv = nightOn
    ? sharedToon('#7dff8a', { emissive: '#3dff5a', emissiveIntensity: 2.2 })
    : sharedToon('#2f6b3a', { emissive: '#3dff5a', emissiveIntensity: 0.2 })
  return (
    <>
      {sensors >= 1 &&
        eyes.map((e, i) => (
          <mesh key={i} material={accent()} position={[e.x, e.y, e.z + 0.07]}>
            <torusGeometry args={[0.12, 0.022, 6, 14]} />
          </mesh>
        ))}
      {/* Parasol de polvo: atornillado a la frente, justo sobre las gafas. */}
      {sensors >= 2 && (
        <mesh material={dark()} position={[brow.x, brow.y, brow.z + 0.08]} rotation-x={0.3} castShadow>
          <boxGeometry args={[0.62, 0.04, 0.2]} />
        </mesh>
      )}
      {/* Sensor nocturno: pegado a la sien derecha, mirando al frente. */}
      {night && (
        <group position={[temple.x + 0.05, temple.y, temple.z]}>
          <mesh material={dark()} position-x={-0.02}>
            <boxGeometry args={[0.06, 0.12, 0.16]} />
          </mesh>
          <mesh material={dark()} position={[0.03, 0, 0.06]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.065, 0.065, 0.2, 8]} />
          </mesh>
          <mesh material={nv} position={[0.03, 0, 0.165]} rotation-x={Math.PI / 2} userData={{ noOutline: true }}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
          </mesh>
        </group>
      )}
    </>
  )
}
