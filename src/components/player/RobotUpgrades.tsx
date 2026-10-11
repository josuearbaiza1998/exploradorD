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

/** Piernas: espinilleras naranjas (nivel 1) y propulsores en la pantorrilla (nivel 2). */
function LegParts({ limb, level }: { limb: Limb; level: number }) {
  return (
    <BoneAttachment bone={limb.bone} rest={limb.rest}>
      <group position={limb.mid} quaternion={limb.quat}>
        <mesh material={accent()} position-z={0.13} castShadow>
          <boxGeometry args={[0.2, limb.len * 0.75, 0.06]} />
        </mesh>
        <mesh material={dark()} position-z={0.15} position-y={limb.len * 0.25}>
          <boxGeometry args={[0.22, 0.05, 0.05]} />
        </mesh>
        {level >= 2 && (
          <group position={[0, -limb.len * 0.1, -0.15]}>
            <mesh material={dark()} castShadow>
              <cylinderGeometry args={[0.07, 0.09, limb.len * 0.5, 8]} />
            </mesh>
            <mesh material={thrust()} position-y={-limb.len * 0.27} userData={{ noOutline: true }}>
              <cylinderGeometry args={[0.06, 0.03, 0.06, 8]} />
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

/** Piezas de las mejoras que se ven en piernas y brazos. */
export function LimbUpgrades({ legs, arms }: { legs: Limb[]; arms: Limb[] }) {
  const legLevel = useGameStore((s) => s.upgrades.legs ?? 0)
  const armLevel = useGameStore((s) => s.upgrades.arms ?? 0)
  return (
    <>
      {legLevel > 0 && legs.map((l, i) => <LegParts key={i} limb={l} level={legLevel} />)}
      {armLevel > 0 && arms.map((l, i) => <ArmParts key={i} limb={l} />)}
    </>
  )
}

/**
 * Piezas de cabeza: aro naranja en las gafas (sensores 1), parasol de polvo
 * (sensores 2) y sensor nocturno verde que brilla al encenderlo.
 */
export function HeadUpgrades({ eyes, top }: { eyes: Vector3[]; top: number }) {
  const sensors = useGameStore((s) => s.upgrades.sensors ?? 0)
  const night = useGameStore((s) => (s.upgrades.nightVision ?? 0) > 0)
  const nightOn = useGameStore((s) => s.nightVisionOn)
  const cx = (eyes[0].x + eyes[1].x) / 2
  const ez = Math.max(eyes[0].z, eyes[1].z)
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
      {sensors >= 2 && (
        <mesh material={dark()} position={[cx, eyes[0].y + 0.17, ez + 0.06]} rotation-x={0.35} castShadow>
          <boxGeometry args={[0.62, 0.04, 0.22]} />
        </mesh>
      )}
      {night && (
        <group position={[eyes[1].x + 0.2, top - 0.08, ez - 0.12]}>
          <mesh material={dark()} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.18, 8]} />
          </mesh>
          <mesh material={nv} position-z={0.095} rotation-x={Math.PI / 2} userData={{ noOutline: true }}>
            <cylinderGeometry args={[0.055, 0.055, 0.02, 8]} />
          </mesh>
        </group>
      )}
    </>
  )
}

