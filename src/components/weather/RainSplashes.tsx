import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { InstancedMesh, MeshBasicMaterial, Object3D, RingGeometry } from 'three'
import { weatherState } from '@/systems/weatherState'
import { player } from '@/systems/player'
import { getHeight } from '@/utils/terrain/heightfield'
import { ISLAND } from '@/config/world'

const COUNT = 70
const RADIUS = 14
const LIFE = 0.45

const tmp = new Object3D()

/** Salpicaduras de lluvia: anillos que se abren y apagan en el suelo cerca del robot. */
export function RainSplashes() {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new RingGeometry(0.6, 1, 12).rotateX(-Math.PI / 2), [])
  const material = useMemo(
    () => new MeshBasicMaterial({ color: '#dbe8ff', transparent: true, opacity: 0.5, depthWrite: false }),
    [],
  )
  const drops = useMemo(() => Array.from({ length: COUNT }, () => ({ x: 0, y: 0, z: 0, age: Math.random() * LIFE })), [])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const density = weatherState.rain
    m.visible = density > 0.15
    if (!m.visible) return
    const dt = Math.min(delta, 0.05)
    const active = Math.floor(COUNT * density)
    for (let i = 0; i < COUNT; i++) {
      const d = drops[i]
      d.age += dt
      if (d.age >= LIFE) {
        d.age -= LIFE
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * RADIUS
        d.x = player.position.x + Math.cos(a) * r
        d.z = player.position.z + Math.sin(a) * r
        d.y = Math.max(getHeight(d.x, d.z), ISLAND.seaLevel) + 0.04
      }
      const k = d.age / LIFE
      const s = i < active ? 0.05 + k * 0.28 : 0
      tmp.position.set(d.x, d.y, d.z)
      tmp.scale.set(s, 1, s)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    material.opacity = 0.35 + density * 0.25
  })

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} />
}
