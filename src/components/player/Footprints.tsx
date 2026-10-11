import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Color, MeshBasicMaterial, MultiplyBlending, Object3D, type InstancedMesh } from 'three'
import { player } from '@/systems/player'
import { wind } from '@/systems/wind'
import { weatherState } from '@/systems/weatherState'
import { getHeight, isUnderwater } from '@/utils/terrain/heightfield'

const MAX = 90
const STRIDE = 0.8
/** Vida base de una huella (s reales); el viento la borra antes. */
const LIFE = 40

/**
 * Huellas del robot en la arena: se borran poco a poco con el viento
 * (mucho más rápido en una tormenta). Un solo draw call.
 */
export function Footprints() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new CircleGeometry(0.5, 7).rotateX(-Math.PI / 2), [])
  const material = useMemo(
    () => // Multiplicativo: oscurece la arena que hay debajo, de día y de noche.
      new MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        premultipliedAlpha: true,
        blending: MultiplyBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  )
  const state = useMemo(
    () => ({
      prints: Array.from({ length: MAX }, () => ({ x: 0, z: 0, y: -999, rot: 0, age: Infinity })),
      next: 0,
      travelled: 0,
      lastX: player.position.x,
      lastZ: player.position.z,
      side: 1,
    }),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  const dark = useMemo(() => new Color('#b89c80'), [])
  const white = useMemo(() => new Color('#ffffff'), [])
  const tmp = useMemo(() => new Color(), [])

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const dx = player.position.x - state.lastX
    const dz = player.position.z - state.lastZ
    state.lastX = player.position.x
    state.lastZ = player.position.z
    const step = Math.hypot(dx, dz)
    if (step > 3) state.travelled = 0 // teletransporte
    else if (player.grounded) state.travelled += step
    if (state.travelled > STRIDE) {
      state.travelled = 0
      state.side = -state.side
      const h = player.heading
      const x = player.position.x + Math.cos(h) * 0.22 * state.side
      const z = player.position.z - Math.sin(h) * 0.22 * state.side
      if (!isUnderwater(x, z)) {
        Object.assign(state.prints[state.next], { x, z, y: getHeight(x, z) + 0.04, rot: h, age: 0 })
        state.next = (state.next + 1) % MAX
      }
    }
    // La tormenta de arena las borra en segundos.
    const erase = 1 + wind.strength * 1.5 + weatherState.dust * weatherState.dust * 25
    for (let i = 0; i < MAX; i++) {
      const p = state.prints[i]
      p.age += dt * erase
      const f = 1 - p.age / LIFE
      if (f <= 0) dummy.scale.setScalar(0)
      else {
        dummy.position.set(p.x, p.y, p.z)
        dummy.rotation.set(0, p.rot, 0)
        dummy.scale.set(0.34, 1, 0.5).multiplyScalar(0.6 + f * 0.4)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // Se aclaran hasta fundirse con la arena.
      mesh.setColorAt(i, tmp.copy(dark).lerp(white, 1 - Math.max(0, f)))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, MAX]} frustumCulled={false} renderOrder={1} />
}
