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
import { getGame } from '@/store/gameStore'
import { hourOfDay } from '@/store/slices/clockSlice'
import { ambientTemperature } from '@/systems/worldClock'
import { weatherState } from '@/systems/weatherState'
import { wind } from '@/systems/wind'
import { activePuddles, ecology } from '@/systems/ecology'
import { queryColliders } from '@/systems/physics/staticColliders'
import { cave } from '@/config/cave'

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

type Lizard = {
  x: number
  z: number
  heading: number
  speed: number
  flee: number
  hidden: number
  active: boolean
  dart: number
  /** Qué hace: pasear, buscar sombra, beber en un charco o curiosear al robot. */
  goal: 'roam' | 'shade' | 'drink' | 'curious'
  tx: number
  tz: number
  think: number
}

/** Punto de sombra junto a una roca o tronco alto cercano (lado contrario al sol). */
function shadeSpot(x: number, z: number): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null
  let bestD = 18
  for (const c of queryColliders(x, z, 16)) {
    if (c.h < 2) continue
    const d = Math.hypot(c.x - x, c.z - z)
    if (d < bestD) {
      bestD = d
      const lx = environment.lightDir.x
      const lz = environment.lightDir.z
      const len = Math.hypot(lx, lz) || 1
      best = { x: c.x - (lx / len) * (c.r + 0.7), z: c.z - (lz / len) * (c.r + 0.7) }
    }
  }
  return best
}

function Lizards() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(lizardGeometry, [])
  const material = sharedToon('#8f6a3e')
  const state = useMemo<Lizard[]>(
    () =>
      Array.from({ length: LIZARDS }, () => ({
        x: 0, z: 0, heading: 0, speed: 0, flee: 0, hidden: 0, active: false, dart: 1 + Math.random() * 3,
        goal: 'roam', tx: 0, tz: 0, think: Math.random() * 2,
      })),
    [],
  )
  const still = useRef(0)
  useFrame(({ clock }, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const px = player.position.x
    const pz = player.position.z
    const t = clock.elapsedTime
    const game = getGame()
    const temp = ambientTemperature(hourOfDay(game.totalHours))
    // Animales de sangre fría: con lluvia o de noche se quedan en sus agujeros.
    const away = weatherState.rain > 0.3 || environment.palette.daylight < 0.2 || cave.active
    const hot = temp > 31
    still.current = player.speed < 0.3 ? still.current + dt : 0
    // Cuanto más rápido va el robot, antes huyen; quieto, se acercan a curiosear.
    const fleeAt = player.speed > 3.5 ? LIZARD_FLEE + 1 : player.speed > 0.3 ? 3.5 : 0
    for (let i = 0; i < LIZARDS; i++) {
      const l = state[i]
      const dist = Math.hypot(l.x - px, l.z - pz)
      if (away) {
        l.hidden = Math.max(l.hidden, 1)
      } else if (!l.active || dist > 48 || (l.hidden > 0 && (l.hidden -= dt) <= 0)) {
        // Fuera de alcance o escondida un rato: reaparece en otro sitio.
        const spot = landSpot(px, pz, 14, 38)
        if (spot) Object.assign(l, { x: spot.x, z: spot.z, heading: Math.random() * Math.PI * 2, speed: 0, flee: 0, hidden: 0, active: true, goal: 'roam' })
      }
      if (l.hidden > 0) {
        dummy.scale.setScalar(0)
      } else {
        if (l.flee <= 0 && fleeAt > 0 && dist < fleeAt) {
          // ¡Huye! Lejos del robot, muy rápido, y luego se entierra.
          l.flee = 1.1
          l.heading = Math.atan2(l.x - px, l.z - pz) + (Math.random() - 0.5) * 0.8
        }
        // Decidir qué hacer cada poco.
        if ((l.think -= dt) <= 0) {
          l.think = 1.5 + Math.random() * 2
          const puddle = ecology.wetness > 0.2 && i % 2 === 0 ? nearestPuddle(l.x, l.z, 25) : null
          const shade = hot ? shadeSpot(l.x, l.z) : null
          if (still.current > 2.5 && dist < 13 && i % 3 !== 2) {
            l.goal = 'curious'
            l.tx = px + ((l.x - px) / (dist || 1)) * 2.4
            l.tz = pz + ((l.z - pz) / (dist || 1)) * 2.4
          } else if (puddle) {
            l.goal = 'drink'
            const d = Math.hypot(l.x - puddle.x, l.z - puddle.z) || 1
            l.tx = puddle.x + ((l.x - puddle.x) / d) * (puddle.r + 0.15)
            l.tz = puddle.z + ((l.z - puddle.z) / d) * (puddle.r + 0.15)
          } else if (shade) {
            l.goal = 'shade'
            l.tx = shade.x
            l.tz = shade.z
          } else l.goal = 'roam'
        }
        if (l.flee > 0) {
          l.speed = 8
          l.flee -= dt
          if (l.flee <= 0) l.hidden = 6 + Math.random() * 6
        } else if (l.goal !== 'roam') {
          // Ir al objetivo a carreritas; al llegar, quieta (bebiendo, a la sombra o mirando al robot).
          const dx = l.tx - l.x
          const dz = l.tz - l.z
          const d = Math.hypot(dx, dz)
          if (d > 0.4) {
            l.heading = Math.atan2(dx, dz)
            l.speed = l.goal === 'curious' ? 1.4 : 3
          } else {
            l.speed = 0
            if (l.goal === 'curious') l.heading = Math.atan2(px - l.x, pz - l.z)
          }
        } else if ((l.dart -= dt) <= 0) {
          // Carreritas cortas y pausas, como las lagartijas de verdad.
          l.dart = 1.5 + Math.random() * 3
          l.heading += (Math.random() - 0.5) * 2
          l.speed = 3
        } else l.speed = Math.max(0, l.speed - dt * 10)
        l.x += Math.sin(l.heading) * l.speed * dt
        l.z += Math.cos(l.heading) * l.speed * dt
        const wiggle = l.speed > 0.5 ? Math.sin(t * 40 + i) * 0.25 : 0
        // Bebiendo: cabecea hacia el agua.
        const sip = l.goal === 'drink' && l.speed === 0 ? Math.max(0, Math.sin(t * 3 + i)) * 0.25 : 0
        dummy.position.set(l.x, getHeight(l.x, l.z) + 0.02, l.z)
        dummy.rotation.set(sip, l.heading + wiggle, 0)
        dummy.scale.setScalar(1.3)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geometry, material, LIZARDS]} castShadow frustumCulled={false} />
}

function nearestPuddle(x: number, z: number, within: number) {
  let best = null
  let bd = within
  for (const p of activePuddles) {
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < bd) {
      bd = d
      best = p
    }
  }
  return best
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
  const circle = useRef({ x: center.x, z: center.z, y: center.y })
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    // De noche duermen y con tormenta se refugian: desaparecen del cielo.
    const visible = environment.palette.daylight > 0.25 && weatherState.rain < 0.4 && wind.strength < 0.8 && !cave.active
    // Si al robot le queda poca batería, los buitres lo rondan a él (y más bajo).
    const game = getGame()
    const weak = game.mode !== 'active' || game.battery < 20
    const c = circle.current
    const k = Math.min(1, Math.min(delta, 0.1) * 0.3)
    c.x += ((weak ? player.position.x : center.x) - c.x) * k
    c.z += ((weak ? player.position.z : center.z) - c.z) * k
    c.y += ((weak ? player.position.y + 14 : center.y) - c.y) * k
    for (const m of [body, wingL, wingR]) if (m.current) m.current.visible = visible
    if (!visible) return
    for (let i = 0; i < VULTURES; i++) {
      const r = 14 + i * 5
      const w = 0.12 + i * 0.02
      const a = t * w + i * 1.7
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      const y = c.y + i * 3 + Math.sin(t * 0.3 + i) * 2
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
    // Más luciérnagas con el suelo húmedo; con lluvia no salen.
    const night = Math.max(0, 1 - environment.palette.daylight * 2.2) * (weatherState.rain > 0.3 ? 0 : 0.35 + ecology.moisture)
    pts.visible = night > 0.02
    if (!pts.visible) return
    material.opacity = Math.min(1, night)
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
