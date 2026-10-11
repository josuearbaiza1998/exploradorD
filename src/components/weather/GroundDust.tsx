import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, PointsMaterial, type Points } from 'three'
import { environment } from '@/systems/environmentState'
import { focus } from '@/systems/focus'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import { getHeight } from '@/utils/terrain/heightfield'

const COUNT = 260
const RADIUS = 34

/** Mancha de polvo grande y muy suave (generada en canvas). */
function createPuffSprite() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

/**
 * Polvo rasante: velos de arena que el viento arrastra pegados al suelo
 * (como en el concept). Siempre hay algo con viento, y mucho más en tormenta.
 * Una sola malla de puntos alrededor del robot, ajustada a la altura del terreno.
 */
export function GroundDust() {
  const ref = useRef<Points>(null)
  const { geometry, seeds } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3))
    const seeds = Array.from({ length: COUNT }, () => ({
      x: (Math.random() * 2 - 1) * RADIUS,
      z: (Math.random() * 2 - 1) * RADIUS,
      h: Math.random() * 0.9,
      v: 0.6 + Math.random() * 0.8,
      p: Math.random() * Math.PI * 2,
    }))
    return { geometry: g, seeds }
  }, [])
  const material = useMemo(
    () => new PointsMaterial({ color: '#f1cf98', size: 3.2, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: 0, map: createPuffSprite() }),
    [],
  )

  useFrame(({ clock }, delta) => {
    const pts = ref.current
    if (!pts) return
    // Con calma apenas se ve; con viento y arena en el aire, mucho.
    const amount = Math.min(1, Math.max(0, wind.strength - 0.15) * 1.3 + weatherState.dust * 0.6) * (environment.sheltered ? 0.5 : 1)
    pts.visible = amount > 0.03
    if (!pts.visible) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const speed = 3 + wind.strength * 14
    const center = focus
    const arr = (geometry.getAttribute('position') as BufferAttribute).array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i]
      s.x += wind.dirX * speed * s.v * dt
      s.z += wind.dirZ * speed * s.v * dt
      // Reaparece al otro lado al salir del círculo alrededor del robot.
      if (s.x > RADIUS) s.x -= RADIUS * 2
      else if (s.x < -RADIUS) s.x += RADIUS * 2
      if (s.z > RADIUS) s.z -= RADIUS * 2
      else if (s.z < -RADIUS) s.z += RADIUS * 2
      const wx = center.x + s.x
      const wz = center.z + s.z
      arr[i * 3] = wx
      arr[i * 3 + 1] = getHeight(wx, wz) + 0.25 + s.h + Math.sin(t * 1.5 + s.p) * 0.15
      arr[i * 3 + 2] = wz
    }
    geometry.getAttribute('position').needsUpdate = true
    material.opacity = amount * 0.55 * (0.45 + environment.palette.daylight * 0.55)
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={1} />
}
