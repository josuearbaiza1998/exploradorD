import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import { Box3, LoopOnce, Matrix4, Mesh, Raycaster, Vector3, type AnimationAction, type Group, type Object3D } from 'three'
import { modelPath } from '@/assets/models'
import { Outlined } from '@/components/common/Outlined'
import { BoneAttachment, boneInRoot } from '@/components/common/BoneAttachment'
import { PALETTE } from '@/config/palette'
import { MATERIALS, robotBatteryMaterial, sharedToon } from '@/materials/toonMaterials'
import { getGame, useGameStore } from '@/store/gameStore'
import { player } from '@/systems/player'
import { Backpack } from './Backpack'
import { HeldTool } from './HeldTool'
import { HeadUpgrades, LimbUpgrades, limbBetween, type Limb } from './RobotUpgrades'

/** Altura final de la sonda en metros. */
const ROBOT_HEIGHT = 2.1

/** ¿Hay modelo animado? Si no, Robot.tsx anima el placeholder por código. */
export const ROBOT_RIGGED = !!modelPath('robot')

/** Primitivas temporales de la sonda (estilo Chappie). Pivote en los pies. */
function RobotPlaceholder() {
  return (
    <group>
      <mesh material={MATERIALS.robot} position={[0, 0.95, 0]} castShadow>
        <capsuleGeometry args={[0.38, 1.0, 4, 10]} />
      </mesh>
      <mesh material={MATERIALS.robot} position={[0, 1.95, 0]} castShadow>
        <boxGeometry args={[0.6, 0.38, 0.5]} />
      </mesh>
      <mesh material={MATERIALS.robotAccent} position={[0, 1.97, 0.26]}>
        <boxGeometry args={[0.46, 0.12, 0.04]} />
      </mesh>
      <mesh material={MATERIALS.shipDark} position={[0, 1.15, -0.38]} castShadow>
        <boxGeometry args={[0.42, 0.62, 0.18]} />
      </mesh>
      <mesh material={robotBatteryMaterial} position={[0, 1.15, -0.475]}>
        <boxGeometry args={[0.12, 0.46, 0.02]} />
      </mesh>
      <HeldTool position={[0.5, 1.0, 0.25]} rotation={[0.9, 0, -0.25]} />
    </group>
  )
}

/**
 * Modelo visual del robot. Con /models/robot.glb (src/assets/models.ts) usa el
 * modelo animado; si falta, las primitivas temporales.
 */
export function RobotModel() {
  const path = modelPath('robot')
  if (!path) return <RobotPlaceholder />
  return (
    <Suspense fallback={<RobotPlaceholder />}>
      <RiggedRobot path={path} />
    </Suspense>
  )
}

/** Colores toon por material del .glb (RobotExpressive: Main, Grey, Black). */
const RECOLOR: Record<string, string> = {
  Main: PALETTE.robotMetal,
  Grey: PALETTE.robotJoint,
  Black: PALETTE.robotDark,
}

/** Fracción del clip Jump con la pose de vuelo (piernas recogidas). */
const JUMP_HOLD = 0.42

type Clip = 'Idle' | 'Walking' | 'Running' | 'Jump' | 'Punch' | 'Death' | 'Sitting'

function RiggedRobot({ path }: { path: string }) {
  const { scene, animations } = useGLTF(path)
  const outer = useRef<Group>(null)
  const { actions, mixer } = useAnimations(animations, scene)

  // Materiales toon, sombras, escala y huesos de anclaje (una vez).
  const setup = useMemo(() => {
    const bones: Record<string, Object3D> = {}
    scene.traverse((o) => {
      // Las piezas rígidas cuelgan de nodos animados que no siempre son Bone.
      if (!(o instanceof Mesh) && (!bones[o.name] || (o as { isBone?: boolean }).isBone)) bones[o.name] = o
      if (o instanceof Mesh) {
        // StrictMode ejecuta esto dos veces: recordar el material original.
        const name: string = (o.userData.srcMaterial ??= (Array.isArray(o.material) ? o.material[0] : o.material).name)
        o.material = sharedToon(RECOLOR[name] ?? PALETTE.robotMetal)
        o.castShadow = true
        o.frustumCulled = false
      }
    })
    scene.updateWorldMatrix(true, true)
    const box = new Box3().setFromObject(scene)
    const scale = ROBOT_HEIGHT / (box.max.y - box.min.y)
    return { bones, scale, offsetY: -box.min.y * scale }
  }, [scene])

  // GLTFLoader quita los puntos de los nombres (Palm2.R → Palm2R).
  const handBone = setup.bones.Palm2R ?? setup.bones['Palm2.R'] ?? setup.bones.LowerArmR

  // Pose de referencia (primer fotograma de Idle): ahí se miden cabeza y
  // torso para colocar gafas y mochila, y se fijan los anclajes a los huesos.
  const current = useRef<{ clip: Clip; action?: AnimationAction }>({ clip: 'Idle' })
  const lastAction = useRef(0)
  /** Momento (s) en que dejó de pisar suelo; null si está en el suelo. */
  const airSince = useRef<number | null>(null)
  const [rig, setRig] = useState<{
    /** Centro de cada gafa, apoyado sobre la superficie de la cara. */
    eyes: Vector3[]
    back: Vector3
    headTop: number
    legs: Limb[]
    arms: Limb[]
    rest: Record<'head' | 'torso' | 'hand', Matrix4 | undefined>
  } | null>(null)
  useLayoutEffect(() => {
    const root = outer.current
    if (!root) return
    for (const name of ['Jump', 'Punch', 'Death', 'Sitting'] as Clip[]) {
      const a = actions[name]
      if (a) {
        a.setLoop(LoopOnce, 1)
        a.clampWhenFinished = true
      }
    }
    const idle = actions.Idle
    idle?.reset().play()
    mixer.update(0)
    current.current = { clip: 'Idle', action: idle ?? undefined }

    root.updateWorldMatrix(true, true)
    const inv = root.matrixWorld.clone().invert()
    /** Caja (en metros de root) de las mallas con cierto material bajo un nodo. */
    const boxOf = (node: Object3D | undefined, material: string) => {
      const b = new Box3()
      node?.traverse((o) => {
        if (o instanceof Mesh && o.userData.srcMaterial === material) b.union(new Box3().setFromObject(o))
      })
      return b.applyMatrix4(inv)
    }
    const head = boxOf(setup.bones.Head, 'Main')
    const torso = boxOf(setup.bones.Body, 'Main')
    const hw = head.max.x - head.min.x
    const tb = setup.bones.Torso
    const torsoBack = new Box3()
    // Solo el tronco (sin cabeza ni brazos): piezas directas del nodo Body.
    setup.bones.Body?.children.forEach((c) => {
      if (c instanceof Mesh || c.children.some((k) => k instanceof Mesh)) torsoBack.union(new Box3().setFromObject(c))
    })
    torsoBack.applyMatrix4(inv)
    const body = torsoBack.isEmpty() ? torso : torsoBack
    // Las gafas se apoyan donde está realmente la cara: rayo desde delante
    // hasta la malla de la cabeza (la caja incluye la visera, que sobresale).
    const headMeshes: Mesh[] = []
    setup.bones.Head?.traverse((o) => o instanceof Mesh && !o.userData.isOutline && headMeshes.push(o))
    const ray = new Raycaster()
    const fwd = new Vector3(0, 0, -1).transformDirection(root.matrixWorld)
    const eyeY = head.min.y + (head.max.y - head.min.y) * 0.42
    const cx = (head.min.x + head.max.x) / 2
    const lenses = [-1, 1].map((side) => {
      const local = new Vector3(cx + side * hw * 0.2, eyeY, head.max.z + 1)
      ray.set(root.localToWorld(local.clone()), fwd)
      const hit = ray.intersectObjects(headMeshes, false)[0]
      const z = hit ? root.worldToLocal(hit.point.clone()).z : head.max.z - 0.1
      return new Vector3(local.x, eyeY, z - 0.04)
    })
    // Tramos de piernas y antebrazos para las piezas de las mejoras.
    const at = (o: Object3D | undefined) => o && new Vector3().setFromMatrixPosition(boneInRoot(o, root))
    const limb = (from: string, to: string) => {
      const a = setup.bones[from]
      const pa = at(a)
      const pb = at(setup.bones[to])
      return a && pa && pb ? limbBetween(a, boneInRoot(a, root), pa, pb) : null
    }
    const legs = [limb('LowerLegL', 'LowerLegL_end'), limb('LowerLegR', 'LowerLegR_end')].filter((l): l is Limb => !!l)
    const arms = [limb('LowerArmL', 'Palm2L'), limb('LowerArmR', 'Palm2R')].filter((l): l is Limb => !!l)
    setRig({
      eyes: lenses,
      headTop: head.max.y,
      legs,
      arms,
      back: new Vector3(0, body.min.y + (body.max.y - body.min.y) * 0.6, body.min.z + 0.12),
      rest: {
        head: setup.bones.Head && boneInRoot(setup.bones.Head, root),
        torso: tb && boneInRoot(tb, root),
        hand: handBone && boneInRoot(handBone, root),
      },
    })
    if (import.meta.env.DEV) Object.assign(window, { __robot: { scene, root } })
    return () => {
      mixer.stopAllAction()
    }
  }, [scene, setup, actions, mixer])

  useFrame(() => {
    const mode = getGame().mode
    const now = performance.now() / 1000
    // En el aire (saltando o cayendo) nunca corre: pose de salto. Un margen
    // corto evita parpadeos al bajar escalones o pequeños desniveles.
    if (player.grounded) airSince.current = null
    else airSince.current ??= now
    const airborne = !player.grounded && (player.velocity.y > 1 || now - (airSince.current ?? now) > 0.12)
    let clip: Clip
    if (mode === 'emergency') clip = 'Death'
    else if (mode === 'recharging') clip = 'Sitting'
    else if (mode === 'returning') clip = 'Walking'
    else if (now - player.actionAt < 0.45) clip = 'Punch'
    else if (airborne) clip = 'Jump'
    else if (player.speed < 0.35) clip = 'Idle'
    else if (player.speed < 4) clip = 'Walking'
    else clip = 'Running'

    // Golpe repetido: reiniciar el clip aunque ya esté sonando.
    const replayPunch = clip === 'Punch' && player.actionAt !== lastAction.current
    if (clip === 'Punch') lastAction.current = player.actionAt

    const cur = current.current
    if (clip !== cur.clip || replayPunch) {
      const next = actions[clip]
      if (next) {
        next.reset().setEffectiveWeight(1).fadeIn(clip === 'Punch' ? 0.08 : 0.25).play()
        if (cur.action && cur.action !== next) cur.action.fadeOut(0.25)
        current.current = { clip, action: next }
      }
    }
    // Caída: el clip de salto se congela en la pose de vuelo (si entró ya
    // cayendo, salta directamente a esa pose) hasta tocar suelo.
    const jumpAction = actions.Jump
    if (clip === 'Jump' && jumpAction) {
      const hold = jumpAction.getClip().duration * JUMP_HOLD
      if (player.velocity.y <= 1 && jumpAction.time < hold && cur.clip !== 'Jump') jumpAction.time = hold
      jumpAction.paused = jumpAction.time >= hold && player.velocity.y <= 1
    } else if (jumpAction) jumpAction.paused = false

    // Pisadas acordes a la velocidad real (evita "patinar").
    const a = current.current.action
    if (a && clip === 'Walking') a.timeScale = Math.max(0.6, player.speed / 2.2)
    else if (a && clip === 'Running') a.timeScale = Math.max(0.8, player.speed / 6)
    else if (a) a.timeScale = 1
  })

  // La mochila se queda en el suelo cuando el robot la ha soltado.
  const carrying = useGameStore((s) => s.droppedBoxes.length === 0)
  const lens = sharedToon(PALETTE.robotDark)
  const batteryLevel = useGameStore((s) => s.upgrades.battery ?? 0)
  const solarLevel = useGameStore((s) => s.upgrades.solar ?? 0)

  return (
    <group ref={outer}>
      <Outlined thickness={0.025}>
        <primitive object={scene} scale={setup.scale} position-y={setup.offsetY} />
      </Outlined>
      {rig && (
        <>
          <BoneAttachment bone={setup.bones.Head} rest={rig.rest.head}>
            {/* Gafas redondas (sensores ópticos): se ensucian con la arena */}
            {rig.eyes.map((eye, i) => (
              <group key={i} position={eye}>
                <mesh material={lens} position-z={0.03} rotation-x={Math.PI / 2} castShadow>
                  <cylinderGeometry args={[0.11, 0.12, 0.12, 12]} />
                </mesh>
                <mesh material={MATERIALS.robotAccent} position-z={0.095} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.085, 0.085, 0.01, 12]} />
                </mesh>
              </group>
            ))}
            <HeadUpgrades eyes={rig.eyes} top={rig.headTop} />
          </BoneAttachment>
          <LimbUpgrades legs={rig.legs} arms={rig.arms} />
          {carrying && (
            <BoneAttachment bone={setup.bones.Torso} rest={rig.rest.torso}>
              <group position={rig.back} scale={0.8}>
                <Backpack cells={batteryLevel} solar={solarLevel} />
              </group>
            </BoneAttachment>
          )}
          <BoneAttachment bone={handBone} rest={rig.rest.hand} align={false}>
            <HeldTool />
          </BoneAttachment>
        </>
      )}
    </group>
  )
}

useGLTF.preload('/models/robot.glb')
