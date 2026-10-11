import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Color, IcosahedronGeometry, Object3D, type InstancedMesh } from 'three'
import { createToonMaterial } from '@/materials/toonMaterials'
import { hitFx, type FloatText, type HitMaterial } from '@/systems/hitFx'

const POOL = 120

type Particle = { life: number; max: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; s: number; spin: number }

const COLORS: Record<HitMaterial, string[]> = {
  wood: ['#7a5a3e', '#a58360', '#5e4330'],
  stone: ['#e7a96a', '#d08a4f', '#9c5733'],
  metal: ['#ffd36b', '#ff9a3d', '#fff2c0'],
  plant: ['#9a8f3f', '#6f9e3a', '#c9b56a'],
}

/**
 * Respuesta al golpear: astillas, lascas de piedra o chispas que saltan del
 * objetivo (pool instanciado, 1 draw call) y el texto "+2 🪵" que sube y se
 * desvanece sobre el recurso al conseguirlo.
 */
export function HitEffects() {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), [])
  // Las chispas metálicas brillan: un poco de emisivo para todos sirve.
  const material = useMemo(() => createToonMaterial({ color: '#ffffff', flatShading: true, emissive: '#222222', bands: 2 }), [])
  const particles = useMemo<Particle[]>(() => Array.from({ length: POOL }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, spin: 0 })), [])
  const next = useRef(0)
  const tmp = useMemo(() => new Color(), [])
  const [texts, setTexts] = useState<(FloatText & { id: number })[]>([])
  const textId = useRef(0)

  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    for (let i = 0; i < POOL; i++) m.setColorAt(i, tmp.set('#ffffff'))
  }, [tmp])

  useFrame((_, delta) => {
    const m = ref.current
    if (!m) return
    const dt = Math.min(delta, 0.05)

    // --- Nuevos golpes ---
    for (const e of hitFx.events) {
      const n = e.final ? 22 : 9
      const palette = COLORS[e.material]
      const spark = e.material === 'metal'
      for (let k = 0; k < n; k++) {
        const i = next.current
        next.current = (next.current + 1) % POOL
        const p = particles[i]
        const a = Math.random() * Math.PI * 2
        const sp = (spark ? 5 : 2.5) + Math.random() * 3
        p.x = e.x + (Math.random() - 0.5) * 0.4
        p.y = e.y + 0.6 + Math.random() * 0.8
        p.z = e.z + (Math.random() - 0.5) * 0.4
        p.vx = Math.cos(a) * sp * 0.6
        p.vz = Math.sin(a) * sp * 0.6
        p.vy = 2.5 + Math.random() * 3.5
        p.s = spark ? 0.04 + Math.random() * 0.04 : (e.final ? 0.09 : 0.06) + Math.random() * 0.08
        p.max = p.life = spark ? 0.35 + Math.random() * 0.3 : 0.7 + Math.random() * 0.5
        p.spin = Math.random() * 10
        m.setColorAt(i, tmp.set(palette[k % palette.length]))
      }
    }
    hitFx.events.length = 0

    // --- Textos flotantes ---
    if (hitFx.texts.length) {
      const fresh = hitFx.texts.map((t) => ({ ...t, id: ++textId.current }))
      hitFx.texts.length = 0
      setTexts((prev) => [...prev, ...fresh].slice(-4))
      fresh.forEach((f) => window.setTimeout(() => setTexts((prev) => prev.filter((p) => p.id !== f.id)), 1400))
    }

    // --- Simulación ---
    hitFx.shake = Math.max(0, hitFx.shake - dt * 3)
    for (let i = 0; i < POOL; i++) {
      const p = particles[i]
      if (p.life > 0) {
        p.life -= dt
        p.vy -= 14 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        p.spin += dt * 8
      }
      const s = p.life > 0 ? p.s * Math.min(1, (p.life / p.max) * 2) : 0
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(p.spin, p.spin * 0.7, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, POOL]} frustumCulled={false} />
      {texts.map((t) => (
        <Html key={t.id} position={[t.x, t.y + 1.8, t.z]} center zIndexRange={[5, 0]} pointerEvents="none">
          <div className="float-text">{t.text}</div>
        </Html>
      ))}
    </>
  )
}
