import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, Object3D, type InstancedMesh } from 'three'
import { cave } from '@/config/cave'
import { ISLAND, OASIS } from '@/config/world'
import { PALETTE } from '@/config/palette'
import { player } from '@/systems/player'
import { wind } from '@/systems/wind'
import { getHeight } from '@/utils/terrain/heightfield'

const MAX = 40

/** ¿Arena seca bajo (x, z)? Ni orilla mojada, ni hierba del oasis, ni cueva. */
function drySand(x: number, z: number) {
  if (cave.active) return false
  if (getHeight(x, z) < ISLAND.seaLevel + 1.3) return false
  return Math.hypot(x - OASIS.x, z - OASIS.z) > OASIS.radius * 1.5
}

/**
 * Polvo bajo los pies: nubecillas de arena al correr (sprint) y un anillo al
 * caer de un salto. El viento se las lleva. Un solo draw call.
 */
export function FootDust() {
  const ref = useRef<InstancedMesh>(null)
  const material = useMemo(() => new MeshBasicMaterial({ color: PALETTE.sandLight, transparent: true, opacity: 0.55, depthWrite: false }), [])
  const state = useMemo(
    () => ({
      puffs: Array.from({ length: MAX }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 99, life: 1, size: 0.3 })),
      next: 0,
      wasGrounded: true,
      fallSpeed: 0,
      stride: 0,
    }),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])

  const emit = (x: number, z: number, vx: number, vz: number, size: number, life: number) => {
    const p = state.puffs[state.next]
    state.next = (state.next + 1) % MAX
    Object.assign(p, { x, y: getHeight(x, z) + 0.15, z, vx, vy: 0.4 + Math.random() * 0.4, vz, age: 0, life, size })
  }

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const { x, z } = player.position
    const busy = player.swimming || player.climbing || player.inWater

    // Caída: anillo de polvo proporcional a la velocidad con la que llega.
    if (!player.grounded) state.fallSpeed = Math.max(state.fallSpeed, -player.velocity.y)
    if (player.grounded && !state.wasGrounded) {
      if (state.fallSpeed > 4 && !busy && drySand(x, z)) {
        const n = Math.min(10, 4 + Math.floor(state.fallSpeed / 2))
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.3
          const s = 1.2 + state.fallSpeed * 0.12
          emit(x + Math.cos(a) * 0.3, z + Math.sin(a) * 0.3, Math.cos(a) * s, Math.sin(a) * s, 0.35, 0.9)
        }
      }
      state.fallSpeed = 0
    }
    state.wasGrounded = player.grounded

    // Al correr: una nubecilla por zancada detrás de los pies.
    if (player.grounded && !busy && player.speed > 4.5) {
      state.stride += player.speed * dt
      if (state.stride > (player.sprinting ? 1.1 : 2.8)) {
        state.stride = 0
        if (drySand(x, z)) {
          const bx = -Math.sin(player.heading)
          const bz = -Math.cos(player.heading)
          emit(x + bx * 0.35, z + bz * 0.35, bx * 0.6, bz * 0.6, player.sprinting ? 0.32 : 0.24, 0.8)
        }
      }
    }

    for (let i = 0; i < MAX; i++) {
      const p = state.puffs[i]
      p.age += dt
      const k = p.age / p.life
      if (k >= 1) dummy.scale.setScalar(0)
      else {
        const drag = Math.exp(-3 * dt)
        p.vx = p.vx * drag + wind.dirX * wind.strength * 2.5 * dt
        p.vz = p.vz * drag + wind.dirZ * wind.strength * 2.5 * dt
        p.vy *= drag
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        dummy.position.set(p.x, p.y, p.z)
        // Crece y se deshace.
        dummy.scale.setScalar(p.size * (0.6 + k * 1.6) * (1 - k * k))
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, material, MAX]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 1]} />
    </instancedMesh>
  )
}
