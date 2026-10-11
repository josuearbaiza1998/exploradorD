import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, PointsMaterial, type Points } from 'three'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'

const COUNT = 2200
const BOX = { x: 70, y: 22, z: 70 }

/** Textura de mota redonda y suave (generada, sin archivos). */
function createDustSprite() {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * Polvo en suspensión alrededor de la cámara. Se mueve con el viento global
 * y su densidad depende del clima (unas motas con calma, muro de arena en tormenta).
 * Una sola malla de puntos y posiciones envueltas en una caja que sigue a la cámara.
 */
export function DustParticles() {
  const ref = useRef<Points>(null)
  const { geometry, offsets } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const offsets = new Float32Array(COUNT) // variación de velocidad por partícula
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = Math.random() * BOX.x
      positions[i * 3 + 1] = Math.random() * BOX.y
      positions[i * 3 + 2] = Math.random() * BOX.z
      offsets[i] = 0.6 + Math.random() * 0.8
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    return { geometry: g, offsets }
  }, [])
  const material = useMemo(
    () => new PointsMaterial({ color: '#e9c38a', size: 0.22, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, map: createDustSprite(), alphaTest: 0.01 }),
    [],
  )
  // Posiciones "locales" (dentro de la caja), independientes de la cámara.
  const local = useMemo(() => (geometry.getAttribute('position').array as Float32Array).slice(), [geometry])

  useFrame(({ camera, clock }, delta) => {
    const points = ref.current
    if (!points) return
    const density = weatherState.dust
    points.visible = density > 0.02
    if (!points.visible) return
    const dt = Math.min(delta, 0.05)
    const speed = 4 + wind.strength * 22
    const t = clock.elapsedTime
    const out = geometry.getAttribute('position') as BufferAttribute
    const arr = out.array as Float32Array
    const ox = camera.position.x - BOX.x / 2
    const oy = camera.position.y - 6
    const oz = camera.position.z - BOX.z / 2
    const count = Math.floor(COUNT * density)
    for (let i = 0; i < count; i++) {
      const k = i * 3
      local[k] += wind.dirX * speed * offsets[i] * dt
      local[k + 1] += Math.sin(t * 2 + i) * 0.6 * dt
      local[k + 2] += wind.dirZ * speed * offsets[i] * dt
      // Envolver dentro de la caja relativa a la cámara.
      arr[k] = ox + ((((local[k] - ox) % BOX.x) + BOX.x) % BOX.x)
      arr[k + 1] = oy + ((((local[k + 1] - oy) % BOX.y) + BOX.y) % BOX.y)
      arr[k + 2] = oz + ((((local[k + 2] - oz) % BOX.z) + BOX.z) % BOX.z)
    }
    geometry.setDrawRange(0, count)
    out.needsUpdate = true
    material.opacity = 0.35 + density * 0.45
    material.size = 0.12 + density * 0.14
    // De noche el polvo apenas se ve.
    material.color.set('#e9c38a').multiplyScalar(0.35 + 0.65 * environment.palette.daylight)
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
