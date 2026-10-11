import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, LineBasicMaterial, type LineSegments } from 'three'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'

const COUNT = 1600
const BOX = { x: 50, y: 30, z: 50 }
const FALL_SPEED = 32
const STREAK = 0.035 // segundos de "estela" de cada gota

/** Lluvia torrencial: estelas inclinadas por el viento, alrededor de la cámara. */
export function RainParticles() {
  const ref = useRef<LineSegments>(null)
  const drops = useMemo(() => {
    const d = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      d[i * 3] = Math.random() * BOX.x
      d[i * 3 + 1] = Math.random() * BOX.y
      d[i * 3 + 2] = Math.random() * BOX.z
    }
    return d
  }, [])
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 6), 3))
    return g
  }, [])
  const material = useMemo(
    () => new LineBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0, depthWrite: false }),
    [],
  )

  useFrame(({ camera }, delta) => {
    const lines = ref.current
    if (!lines) return
    const density = weatherState.rain
    lines.visible = density > 0.02
    if (!lines.visible) return
    const dt = Math.min(delta, 0.05)
    const vx = wind.dirX * wind.strength * 10
    const vz = wind.dirZ * wind.strength * 10
    const arr = (geometry.getAttribute('position') as BufferAttribute).array as Float32Array
    const ox = camera.position.x - BOX.x / 2
    const oy = camera.position.y - 10
    const oz = camera.position.z - BOX.z / 2
    const count = Math.floor(COUNT * density)
    for (let i = 0; i < count; i++) {
      const k = i * 3
      drops[k] += vx * dt
      drops[k + 1] -= FALL_SPEED * dt
      drops[k + 2] += vz * dt
      const x = ox + ((((drops[k] - ox) % BOX.x) + BOX.x) % BOX.x)
      const y = oy + ((((drops[k + 1] - oy) % BOX.y) + BOX.y) % BOX.y)
      const z = oz + ((((drops[k + 2] - oz) % BOX.z) + BOX.z) % BOX.z)
      const j = i * 6
      arr[j] = x
      arr[j + 1] = y
      arr[j + 2] = z
      arr[j + 3] = x - vx * STREAK
      arr[j + 4] = y + FALL_SPEED * STREAK
      arr[j + 5] = z - vz * STREAK
    }
    geometry.setDrawRange(0, count * 2)
    geometry.getAttribute('position').needsUpdate = true
    material.opacity = 0.25 + density * 0.3
  })

  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
