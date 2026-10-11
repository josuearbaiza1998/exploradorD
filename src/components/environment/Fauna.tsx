import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  Matrix4,
  Object3D,
  PointsMaterial,
  type InstancedMesh,
  type Points,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CRASH_SITE, OASIS } from '@/config/world'
import { landSpot } from '@/utils/terrain/landSpot'
import { sharedToon } from '@/materials/toonMaterials'
import { environment } from '@/systems/environmentState'
import { player } from '@/systems/player'
import { getHeight } from '@/utils/terrain/heightfield'

/** Fauna pequeña: no hace daño, solo da vida al desierto. */
export function Fauna() {
  return (
    <>
      <Lizards />
      <Vultures />
      <Fireflies />
    </>
  )
}

// ---------- Lagartijas ----------

const LIZARDS = 7
const LIZARD_FLEE = 6
const dummy = new Object3D()

function lizardGeometry() {
  const parts = [
    new BoxGeometry(0.16, 0.08, 0.42).translate(0, 0.06, 0),
    new BoxGeometry(0.12, 0.07, 0.14).translate(0, 0.07, 0.26),
    new ConeGeometry(0.05, 0.42, 4).rotateX(-Math.PI / 2).translate(0, 0.05, -0.4),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => new BoxGeometry(0.16, 0.03, 0.04).translate(sx * 0.12, 0.03, sz * 0.12))),
  ]
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))
}

function Lizards() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(lizardGeometry, [])
  const material = sharedToon('#8f6a3e')
  const state = useMemo(
    () =>
      Array.from({ length: LIZARDS }, () => ({ x: 0, z: 0, heading: 0, speed: 0, flee: 0, hidden: 0, active: false, dart: 1 + Math.random() * 3 })),
    [],
  )
  useFrame(({ clock }, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const px = player.position.x
    const pz = player.position.z
    const t = clock.elapsedTime
    for (let i = 0; i < LIZARDS; i++) {
      const l = state[i]
      const dist = Math.hypot(l.x - px, l.z - pz)
      // Fuera de alcance o escondida un rato: reaparece en otro sitio.
      if (!l.active || dist > 48 || (l.hidden > 0 && (l.hidden -= dt) <= 0)) {
        const spot = landSpot(px, pz, 14, 38)
        if (spot) Object.assign(l, { x: spot.x, z: spot.z, heading: Math.random() * Math.PI * 2, speed: 0, flee: 0, hidden: 0, active: true })
      }
      if (l.hidden > 0) {
        dummy.scale.setScalar(0)
      } else {
        if (l.flee <= 0 && dist < LIZARD_FLEE) {
          // ¡Huye! Lejos del robot, muy rápido, y luego se entierra.
          l.flee = 1.1
          l.heading = Math.atan2(l.x - px, l.z - pz) + (Math.random() - 0.5) * 0.8
        }
        if (l.flee > 0) {
          l.speed = 8
          l.flee -= dt
          if (l.flee <= 0) l.hidden = 6 + Math.random() * 6
        } else if ((l.dart -= dt) <= 0) {
          // Carreritas cortas y pausas, como las lagartijas de verdad.
          l.dart = 1.5 + Math.random() * 3
          l.heading += (Math.random() - 0.5) * 2
          l.speed = 3
        } else l.speed = Math.max(0, l.speed - dt * 10)
        l.x += Math.sin(l.heading) * l.speed * dt
        l.z += Math.cos(l.heading) * l.speed * dt
        const wiggle = l.speed > 0.5 ? Math.sin(t * 40 + i) * 0.25 : 0
        dummy.position.set(l.x, getHeight(l.x, l.z) + 0.02, l.z)
        dummy.rotation.set(0, l.heading + wiggle, 0)
        dummy.scale.setScalar(1.3)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geometry, material, LIZARDS]} castShadow frustumCulled={false} />
}

// ---------- Buitres sobre la nave ----------

const VULTURES = 4
const bodyMatrix = new Matrix4()
const wingMatrix = new Matrix4()

function Vultures() {
  const body = useRef<InstancedMesh>(null)
  const wingL = useRef<InstancedMesh>(null)
  const wingR = useRef<InstancedMesh>(null)
  const geo = useMemo(
    () => ({
      body: mergeGeometries([new BoxGeometry(0.35, 0.3, 1.1).toNonIndexed(), new ConeGeometry(0.12, 0.4, 4).rotateX(Math.PI / 2).translate(0, 0.05, 0.7).toNonIndexed()]),
      wing: new BoxGeometry(1.6, 0.05, 0.6).translate(0.8, 0, 0),
    }),
    [],
  )
  const mat = sharedToon('#2b211c')
  const center = useMemo(() => ({ x: CRASH_SITE.x, z: CRASH_SITE.z, y: getHeight(CRASH_SITE.x, CRASH_SITE.z) + 34 }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // De noche duermen: desaparecen del cielo.
    const visible = environment.palette.daylight > 0.25
    for (const m of [body, wingL, wingR]) if (m.current) m.current.visible = visible
    if (!visible) return
    for (let i = 0; i < VULTURES; i++) {
      const r = 14 + i * 5
      const w = 0.12 + i * 0.02
      const a = t * w + i * 1.7
      const x = center.x + Math.cos(a) * r
      const z = center.z + Math.sin(a) * r
      const y = center.y + i * 3 + Math.sin(t * 0.3 + i) * 2
      const heading = a + Math.PI // tangente del círculo
      // Planean casi siempre; a ratos aletean.
      const flap = Math.sin(t * 0.25 + i * 2) > 0.7 ? Math.sin(t * 7 + i) * 0.5 : 0.12
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, -heading, 0.35)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      bodyMatrix.copy(dummy.matrix)
      body.current?.setMatrixAt(i, bodyMatrix)
      // Alas: giradas respecto al cuerpo (la izquierda es la derecha volteada).
      for (const [m, side] of [[wingL, -1], [wingR, 1]] as const) {
        dummy.position.set(0, 0, 0)
        dummy.rotation.set(0, side < 0 ? Math.PI : 0, flap)
        dummy.updateMatrix()
        m.current?.setMatrixAt(i, wingMatrix.multiplyMatrices(bodyMatrix, dummy.matrix))
      }
    }
    for (const m of [body, wingL, wingR]) if (m.current) m.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={body} args={[geo.body, mat, VULTURES]} frustumCulled={false} />
      <instancedMesh ref={wingL} args={[geo.wing, mat, VULTURES]} frustumCulled={false} />
      <instancedMesh ref={wingR} args={[geo.wing, mat, VULTURES]} frustumCulled={false} />
    </>
  )
}

// ---------- Luciérnagas en el oasis ----------

const FIREFLIES = 70

function glowSprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,200,1)')
  g.addColorStop(0.3, 'rgba(220,255,120,0.6)')
  g.addColorStop(1, 'rgba(200,255,100,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  return new CanvasTexture(c)
}

function Fireflies() {
  const ref = useRef<Points>(null)
  const { geometry, seeds } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(FIREFLIES * 3), 3))
    const seeds = Array.from({ length: FIREFLIES }, () => {
      const a = Math.random() * Math.PI * 2
      const r = OASIS.radius * (0.9 + Math.random() * 0.6)
      const x = OASIS.x + Math.cos(a) * r
      const z = OASIS.z + Math.sin(a) * r
      return { x, z, y: Math.max(getHeight(x, z), 0), p: Math.random() * 100 }
    })
    return { geometry: g, seeds }
  }, [])
  const material = useMemo(
    () =>
      new PointsMaterial({ size: 0.7, map: glowSprite(), transparent: true, depthWrite: false, blending: AdditiveBlending, color: '#e8ff9a', opacity: 0 }),
    [],
  )
  useFrame(({ clock }) => {
    const pts = ref.current
    if (!pts) return
    const night = Math.max(0, 1 - environment.palette.daylight * 2.2)
    pts.visible = night > 0.02
    if (!pts.visible) return
    material.opacity = night
    const t = clock.elapsedTime
    const arr = (geometry.getAttribute('position') as BufferAttribute).array as Float32Array
    for (let i = 0; i < FIREFLIES; i++) {
      const s = seeds[i]
      // Parpadeo: cada una se apaga a ratos (se esconde bajo tierra).
      const off = Math.sin(t * 1.3 + s.p) < -0.3 ? -50 : 0
      arr[i * 3] = s.x + Math.sin(t * 0.5 + s.p) * 1.5
      arr[i * 3 + 1] = s.y + 0.8 + Math.sin(t * 0.9 + s.p * 2) * 0.6 + off
      arr[i * 3 + 2] = s.z + Math.cos(t * 0.4 + s.p) * 1.5
    }
    geometry.getAttribute('position').needsUpdate = true
  })
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
