import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, InstancedMesh, MeshBasicMaterial, Object3D, BoxGeometry, Vector3 } from 'three'
import { weatherState } from '@/systems/weatherState'
import { environment } from '@/systems/environmentState'
import { player } from '@/systems/player'
import { getHeight } from '@/utils/terrain/heightfield'
import { thunder } from '@/systems/audio/audioEngine'

const SEGMENTS = 22
const BOLT_TIME = 0.32
const SOUND_SPEED = 170 // m/s "de juego": el trueno llega con retraso, pero no tanto

const tmp = new Object3D()
const a = new Vector3()
const b = new Vector3()

/**
 * Rayos en lluvia fuerte y tormenta eléctrica: un relámpago quebrado cae a lo
 * lejos (a veces cerca), el cielo y la luz destellan y el trueno llega con
 * retraso según la distancia.
 */
export function Lightning() {
  const mesh = useRef<InstancedMesh>(null)
  const material = useMemo(
    () => new MeshBasicMaterial({ color: '#dfe9ff', transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
    [],
  )
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [])
  const bolt = useRef({ age: 99, flicker: 0 })

  useEffect(
    () => () => {
      weatherState.flash = 0
    },
    [],
  )

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    const dt = Math.min(delta, 0.1)
    const rate = weatherState.lightning * weatherState.blend
    const st = bolt.current
    if (rate > 0.05 && st.age > 1.5 && Math.random() < (dt * rate) / 60) strike(m, st)
    st.age += dt
    // Destello: pico al caer y un segundo parpadeo.
    const f1 = Math.max(0, 1 - st.age / 0.18)
    const f2 = st.age > 0.12 ? Math.max(0, 1 - (st.age - 0.12) / 0.22) * 0.7 : 0
    weatherState.flash = Math.max(f1, f2) * st.flicker * (environment.isDay ? 0.6 : 1)
    m.visible = st.age < BOLT_TIME
    material.opacity = m.visible ? (st.age < 0.08 || (st.age > 0.13 && st.age < 0.2) ? 1 : 0.35) : 0
  })

  return <instancedMesh ref={mesh} args={[geometry, material, SEGMENTS]} frustumCulled={false} visible={false} />
}

function strike(m: InstancedMesh, st: { age: number; flicker: number }) {
  // Casi siempre lejos; de vez en cuando cerca para asustar.
  const close = Math.random() < 0.15
  const dist = close ? 18 + Math.random() * 20 : 60 + Math.random() * 150
  const ang = Math.random() * Math.PI * 2
  const gx = player.position.x + Math.cos(ang) * dist
  const gz = player.position.z + Math.sin(ang) * dist
  const gy = Math.max(getHeight(gx, gz), -1.5)
  const top = gy + 95
  // Tronco principal quebrado (14 tramos) y una rama (el resto).
  const main = 14
  let px = gx + (Math.random() - 0.5) * 12
  let pz = gz + (Math.random() - 0.5) * 12
  let py = top
  let i = 0
  let branchFrom: Vector3 | null = null
  for (; i < main; i++) {
    const t = (i + 1) / main
    const nx = i === main - 1 ? gx : px + (gx - px) * (1 / (main - i)) + (Math.random() - 0.5) * 5
    const nz = i === main - 1 ? gz : pz + (gz - pz) * (1 / (main - i)) + (Math.random() - 0.5) * 5
    const ny = top + (gy - top) * t
    a.set(px, py, pz)
    b.set(nx, ny, nz)
    place(m, i, a, b, 1.1 - t * 0.5)
    if (i === 5) branchFrom = b.clone()
    px = nx
    py = ny
    pz = nz
  }
  if (branchFrom) {
    const dx = (Math.random() - 0.5) * 2
    const dz = (Math.random() - 0.5) * 2
    let p = branchFrom
    for (; i < SEGMENTS; i++) {
      const n = new Vector3(p.x + dx * 7 + (Math.random() - 0.5) * 4, p.y - 6 - Math.random() * 3, p.z + dz * 7 + (Math.random() - 0.5) * 4)
      place(m, i, p, n, 0.45)
      p = n
    }
  }
  m.instanceMatrix.needsUpdate = true
  st.age = 0
  st.flicker = close ? 1 : 0.55 + Math.random() * 0.35
  const near = Math.max(0, 1 - dist / 120)
  thunder(near, dist / SOUND_SPEED)
}

/** Coloca un tramo (caja estirada) entre dos puntos. */
function place(m: InstancedMesh, i: number, from: Vector3, to: Vector3, width: number) {
  tmp.position.copy(from)
  const len = from.distanceTo(to)
  tmp.lookAt(to)
  tmp.rotateX(Math.PI / 2)
  tmp.scale.set(width, len, width)
  tmp.updateMatrix()
  m.setMatrixAt(i, tmp.matrix)
}
