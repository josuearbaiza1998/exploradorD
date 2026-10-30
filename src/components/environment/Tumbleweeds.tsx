import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D, Quaternion, TorusGeometry, Vector3, type BufferGeometry, type InstancedMesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { cave } from '@/config/cave'
import { ISLAND, OASIS } from '@/config/world'
import { sharedToon } from '@/materials/toonMaterials'
import { player } from '@/systems/player'
import { wind } from '@/systems/wind'
import { getHeight } from '@/utils/terrain/heightfield'

const COUNT = 6
const RADIUS = 0.55
/** Aparecen a barlovento a esta distancia del robot y se reciclan al alejarse. */
const SPAWN_DIST = 34
const FAR = 48

/** Bola de ramitas secas: aros finos enredados en un solo geometry. */
function tumbleGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const q = new Quaternion()
  for (let i = 0; i < 9; i++) {
    const t = new TorusGeometry(RADIUS * (0.75 + ((i * 37) % 10) / 40), 0.035, 3, 12)
    q.setFromAxisAngle(new Vector3(Math.sin(i * 2.4), Math.cos(i * 1.7), Math.sin(i * 0.9 + 1)).normalize(), i * 1.3)
    t.applyQuaternion(q)
    parts.push(t)
  }
  return mergeGeometries(parts)
}

type Weed = { p: Vector3; v: Vector3; q: Quaternion; on: boolean; wait: number; scale: number }

/**
 * Rodadoras: matas secas que el viento empuja por la arena, rodando y dando
 * botes. Con brisa floja se paran; con rachas y tormenta corren y saltan.
 * Pocas, siempre cerca del robot, en un solo draw call.
 */
export function Tumbleweeds() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(tumbleGeometry, [])
  const material = useMemo(() => sharedToon('#a8874f'), [])
  const weeds = useMemo<Weed[]>(
    () => Array.from({ length: COUNT }, (_, i) => ({ p: new Vector3(), v: new Vector3(), q: new Quaternion(), on: false, wait: i * 2.5, scale: 1 })),
    [],
  )
  const dummy = useMemo(() => new Object3D(), [])
  const axis = useMemo(() => new Vector3(), [])
  const spin = useMemo(() => new Quaternion(), [])

  /** Sitio en la arena a barlovento del robot, o false si no hay. */
  const spawn = (w: Weed) => {
    for (let tries = 0; tries < 6; tries++) {
      const side = (Math.random() - 0.5) * 50
      const x = player.position.x - wind.dirX * SPAWN_DIST - wind.dirZ * side
      const z = player.position.z - wind.dirZ * SPAWN_DIST + wind.dirX * side
      const y = getHeight(x, z)
      if (y < ISLAND.seaLevel + 1.5 || Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.radius * 1.6) continue
      w.p.set(x, y + RADIUS, z)
      w.v.set(wind.dirX, 0, wind.dirZ).multiplyScalar(2)
      w.scale = 0.75 + Math.random() * 0.5
      w.on = true
      return true
    }
    return false
  }

  useFrame((_, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const active = !cave.active && !player.underwater
    weeds.forEach((w, i) => {
      if (!w.on) {
        w.wait -= dt
        // Solo salen con viento de verdad.
        if (active && w.wait <= 0 && wind.strength > 0.3 && !spawn(w)) w.wait = 1
      }
      if (w.on) {
        const r = RADIUS * w.scale
        // El viento empuja hacia su velocidad; el roce con la arena frena.
        const target = wind.strength < 0.2 ? 0 : 1.2 + wind.strength * 7.5
        w.v.x += (wind.dirX * target - w.v.x) * dt * 0.9
        w.v.z += (wind.dirZ * target - w.v.z) * dt * 0.9
        w.v.y -= 14 * dt
        w.p.addScaledVector(w.v, dt)
        const ground = getHeight(w.p.x, w.p.z) + r
        if (w.p.y <= ground) {
          const climb = ground - w.p.y
          w.p.y = ground
          // Bote al tocar suelo: más alto con más viento y al chocar con una cuesta.
          const speed = Math.hypot(w.v.x, w.v.z)
          w.v.y = speed > 1 && Math.random() < 0.08 + wind.strength * 0.1 ? 1.5 + speed * 0.35 + Math.random() * 2 : Math.max(0, climb / dt) * 0.4
        }
        // Rueda sobre el eje perpendicular al avance.
        const speed = Math.hypot(w.v.x, w.v.z)
        if (speed > 0.01) {
          axis.set(w.v.z, 0, -w.v.x).normalize()
          w.q.premultiply(spin.setFromAxisAngle(axis, (speed / r) * dt))
        }
        const far = Math.hypot(w.p.x - player.position.x, w.p.z - player.position.z) > FAR
        const wet = getHeight(w.p.x, w.p.z) < ISLAND.seaLevel + 0.4
        if (!active || far || wet) {
          w.on = false
          w.wait = 1 + Math.random() * 4
        }
      }
      dummy.position.copy(w.p)
      dummy.quaternion.copy(w.q)
      dummy.scale.setScalar(w.on ? w.scale : 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, COUNT]} frustumCulled={false} castShadow />
}
