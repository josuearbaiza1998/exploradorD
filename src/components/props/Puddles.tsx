import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Object3D, type InstancedMesh } from 'three'
import { ISLAND, OASIS } from '@/config/world'
import { createToonMaterial } from '@/materials/toonMaterials'
import { getGame } from '@/store/gameStore'
import { activePuddles, ecology, type Puddle } from '@/systems/ecology'
import { player } from '@/systems/player'
import { getHeight, getSlope } from '@/utils/terrain/heightfield'

const MAX = 48
const NEAR = 75
const dummy = new Object3D()

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return s - Math.floor(s)
}

/** Hondonadas llanas donde se acumula el agua (se calculan una vez). */
let spots: Puddle[] | null = null
function puddleSpots(): Puddle[] {
  if (spots) return spots
  spots = []
  const step = 7
  const R = ISLAND.radius - 20
  for (let x = -R; x <= R; x += step) {
    for (let z = -R; z <= R; z += step) {
      if (hash(x, z) > 0.45) continue
      const px = x + (hash(z, x) - 0.5) * step
      const pz = z + (hash(x + 3, z) - 0.5) * step
      const y = getHeight(px, pz)
      if (y < ISLAND.seaLevel + 0.8 || y > 14) continue
      if (Math.hypot(px - OASIS.x, pz - OASIS.z) < OASIS.radius * 1.6) continue
      if (getSlope(px, pz, 1.5) > 0.18) continue
      // Más bajo que el entorno: ahí se queda el agua.
      const around = (getHeight(px + 4, pz) + getHeight(px - 4, pz) + getHeight(px, pz + 4) + getHeight(px, pz - 4)) / 4
      if (around - y < -0.05) continue
      spots.push({ x: px, z: pz, y, r: 1.2 + hash(px, pz) * 1.6 })
    }
  }
  return spots
}

/**
 * Charcos tras la lluvia: aparecen en las hondonadas, reflejan el cielo y se
 * secan con el sol. Pisarlos lava un poco el polvo de las gafas.
 */
export function Puddles() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new CircleGeometry(1, 14).rotateX(-Math.PI / 2), [])
  const material = useMemo(
    () => createToonMaterial({ color: '#86b9d9', emissive: '#4f86b0', emissiveIntensity: 0.25, transparent: true, opacity: 0.8, bands: 2 }),
    [],
  )
  const timer = useRef(0)
  useFrame(({ clock }, delta) => {
    const m = ref.current
    if (!m) return
    const w = ecology.wetness
    m.visible = w > 0.08
    activePuddles.length = 0
    if (!m.visible) return
    const px = player.position.x
    const pz = player.position.z
    const size = Math.min(1, (w - 0.08) / 0.5)
    let n = 0
    for (const p of puddleSpots()) {
      if (n >= MAX) break
      if (Math.abs(p.x - px) > NEAR || Math.abs(p.z - pz) > NEAR) continue
      const r = p.r * size
      activePuddles.push({ x: p.x, z: p.z, y: p.y, r })
      dummy.position.set(p.x, p.y + 0.05, p.z)
      dummy.rotation.set(0, p.x, 0)
      dummy.scale.set(r * (1 + Math.sin(clock.elapsedTime + p.z) * 0.02), 1, r * 0.8)
      dummy.updateMatrix()
      m.setMatrixAt(n++, dummy.matrix)
    }
    m.count = n
    m.instanceMatrix.needsUpdate = true
    // Pisar un charco lava un poco las gafas.
    if ((timer.current -= delta) <= 0) {
      timer.current = 0.5
      const inPuddle = activePuddles.some((p) => (p.x - px) ** 2 + (p.z - pz) ** 2 < p.r * p.r)
      if (inPuddle && player.speed > 0.5 && getGame().sensorDirt > 0) getGame().cleanSensors(0.03)
    }
  })
  return <instancedMesh ref={ref} args={[geometry, material, MAX]} frustumCulled={false} receiveShadow renderOrder={1} />
}
