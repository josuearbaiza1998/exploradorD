import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D, type Group, type Mesh } from 'three'
import { BUOYS, ROUTE, ROUTE_HALF_WIDTH, routePoint, STORM_AT } from '@/config/currents'
import { ISLAND } from '@/config/world'
import { sharedToon } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { thunder } from '@/systems/audio/audioEngine'
import { player } from '@/systems/player'
import { seaState, waveHeight } from '@/systems/sea'

/** Boya de deriva: flotador naranja con mástil y luz (roja sin leer, verde leída). */
function Buoy({ x, z, read }: { x: number; z: number; read: boolean }) {
  const ref = useRef<Group>(null)
  const light = useRef<Mesh>(null)
  const orange = sharedToon('#ff7a2e')
  const white = sharedToon('#f2f2ea')
  const dark = sharedToon('#33363d')
  const lamp = read ? sharedToon('#7dff8a', { emissive: '#3dff5a', emissiveIntensity: 2 }) : sharedToon('#ff6a5a', { emissive: '#ff3b2e', emissiveIntensity: 2.2 })
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = seaState.time
    g.position.y = ISLAND.seaLevel + waveHeight(x, z, t) - 0.3
    g.rotation.x = Math.sin(t * 1.1 + x) * 0.12
    g.rotation.z = Math.cos(t * 0.9 + z) * 0.12
    if (light.current) light.current.visible = Math.sin(clock.elapsedTime * 4 + x) > (read ? -1 : 0.3)
  })
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh material={orange} castShadow>
        <cylinderGeometry args={[0.8, 0.9, 1.2, 10]} />
      </mesh>
      <mesh material={white} position-y={0.35}>
        <cylinderGeometry args={[0.82, 0.82, 0.25, 10]} />
      </mesh>
      <mesh material={dark} position-y={1.6}>
        <cylinderGeometry args={[0.07, 0.09, 2.2, 6]} />
      </mesh>
      <mesh material={orange} position-y={2.3}>
        <coneGeometry args={[0.35, 0.6, 4]} />
      </mesh>
      <mesh ref={light} material={lamp} position-y={2.75} userData={{ noOutline: true }}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
    </group>
  )
}

const CLOUDS = 46

/**
 * La tormenta perpetua entre las dos islas: un banco de nubes negras sobre
 * cortinas de lluvia, cruzando el pasillo de la corriente, con relámpagos.
 */
function StormWall() {
  const clouds = useRef<InstancedMesh>(null)
  const flash = useRef<MeshBasicMaterial>(null)
  const p = routePoint(STORM_AT + 0.05)
  const heading = Math.atan2(ROUTE.to.x - ROUTE.from.x, ROUTE.to.z - ROUTE.from.z)
  const width = ROUTE_HALF_WIDTH * 2 + 160
  const { geo, mat, curtain, puffs } = useMemo(() => {
    const puffs = Array.from({ length: CLOUDS }, (_, i) => ({
      x: (i / CLOUDS - 0.5) * width + (Math.random() - 0.5) * 12,
      y: 26 + Math.random() * 22,
      z: (Math.random() - 0.5) * 40,
      s: 9 + Math.random() * 10,
    }))
    return {
      geo: new IcosahedronGeometry(1, 1),
      mat: sharedToon('#3a3f4c', { bands: 2 }),
      curtain: new MeshBasicMaterial({ color: '#4a5566', transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
      puffs,
    }
  }, [width])
  const dummy = useMemo(() => new Object3D(), [])
  const st = useRef({ next: 4, t: -1 })
  useFrame(({ clock }, delta) => {
    const m = clouds.current
    if (m) {
      const t = clock.elapsedTime
      puffs.forEach((c, i) => {
        dummy.position.set(c.x + Math.sin(t * 0.05 + i) * 4, c.y + Math.sin(t * 0.2 + i * 2) * 1.5, c.z)
        dummy.scale.set(c.s * 1.4, c.s * 0.7, c.s)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      })
      m.instanceMatrix.needsUpdate = true
    }
    // Relámpagos: destellos dentro de la tormenta, con trueno lejano si estás cerca.
    const s = st.current
    s.next -= Math.min(delta, 0.1)
    if (s.next <= 0) {
      s.next = 3 + Math.random() * 7
      s.t = 0
      const d = Math.hypot(player.position.x - p.x, player.position.z - p.z)
      if (d < 400) thunder(Math.max(0, 0.5 - d / 500), d / 340)
    }
    if (flash.current) {
      if (s.t >= 0) s.t += delta
      const on = s.t >= 0 && s.t < 0.35 && Math.sin(s.t * 60) > -0.2
      flash.current.opacity = on ? 0.7 : 0
      if (s.t > 0.35) s.t = -1
    }
  })
  return (
    <group position={[p.x, ISLAND.seaLevel, p.z]} rotation-y={heading}>
      <instancedMesh ref={clouds} args={[geo, mat, CLOUDS]} frustumCulled={false} />
      {[-6, 4].map((zz, i) => (
        <mesh key={i} material={curtain} position={[0, 18, zz]}>
          <planeGeometry args={[width, 40]} />
        </mesh>
      ))}
      <mesh position={[0, 32, 0]}>
        <planeGeometry args={[width * 0.6, 30]} />
        <meshBasicMaterial ref={flash} color="#e8eeff" transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** Lo del mar abierto: las boyas de deriva y la tormenta entre islas. */
export function SeaRoute() {
  const buoys = useGameStore((s) => s.buoys)
  return (
    <>
      {BUOYS.map((b) => (
        <Buoy key={b.id} x={b.x} z={b.z} read={!!buoys[b.id]} />
      ))}
      <StormWall />
    </>
  )
}
