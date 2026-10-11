import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, PointsMaterial, type Points } from 'three'
import { environment } from '@/systems/environmentState'
import { focus } from '@/systems/focus'
import { wind } from '@/systems/wind'
import { getHeight } from '@/utils/terrain/heightfield'

const COUNT = 140
const RADIUS = 60

function createMistSprite() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.5)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.2)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * Bruma baja de noche y al amanecer: velos azulados que se arrastran
 * despacio pegados al suelo y se acumulan en las zonas bajas.
 */
export function GroundMist() {
  const ref = useRef<Points>(null)
  const { geometry, seeds } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3))
    const seeds = Array.from({ length: COUNT }, () => ({
      x: (Math.random() * 2 - 1) * RADIUS,
      z: (Math.random() * 2 - 1) * RADIUS,
      h: Math.random() * 1.6,
      p: Math.random() * Math.PI * 2,
    }))
    return { geometry: g, seeds }
  }, [])
  const material = useMemo(
    () => new PointsMaterial({ color: '#c3d0f0', size: 9, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, map: createMistSprite() }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const pts = ref.current
    if (!pts) return
    const amount = environment.mist * (1 - environment.nightVision * 0.6)
    pts.visible = amount > 0.03
    if (!pts.visible) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const arr = (geometry.getAttribute('position') as BufferAttribute).array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]
      s.x += wind.dirX * 0.6 * dt
      s.z += wind.dirZ * 0.6 * dt
      if (s.x > RADIUS) s.x -= RADIUS * 2
      else if (s.x < -RADIUS) s.x += RADIUS * 2
      if (s.z > RADIUS) s.z -= RADIUS * 2
      else if (s.z < -RADIUS) s.z += RADIUS * 2
      const wx = focus.x + s.x
      const wz = focus.z + s.z
      const ground = getHeight(wx, wz)
      arr[i * 3] = wx
      // Más espesa en las hondonadas: los puntos altos se hunden bajo el terreno visible.
      arr[i * 3 + 1] = ground + 0.6 + s.h + Math.sin(t * 0.4 + s.p) * 0.3
      arr[i * 3 + 2] = wz
    }
    geometry.getAttribute('position').needsUpdate = true
    material.opacity = amount * 0.5
    // Al amanecer toma el color cálido del horizonte.
    material.color.set('#c3d0f0').lerp(environment.palette.skyHorizon, environment.palette.daylight * 0.6)
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
}
