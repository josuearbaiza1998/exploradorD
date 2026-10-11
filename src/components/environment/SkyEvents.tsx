import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { cave } from '@/config/cave'
import { getGame } from '@/store/gameStore'
import { environment } from '@/systems/environmentState'
import { meteorFall } from '@/systems/audio/audioEngine'
import { player } from '@/systems/player'
import { MAX_FIREBALLS, METEOR_CHANCE, nightId, skyEvents } from '@/systems/skyEvents'
import { weatherState } from '@/systems/weatherState'
import { radialTexture } from '@/utils/radialTexture'
import { getHeight } from '@/utils/terrain/heightfield'
import { landSpot } from '@/utils/terrain/landSpot'

const SKY_R = 600
const STREAKS = 10
const UP = new Vector3(0, 1, 0)
const tmp = new Vector3()
const tmp2 = new Vector3()

/** Estela: cono con la cabeza blanca y la cola que se desvanece (colores de vértice). */
function streakGeometry() {
  const g = new ConeGeometry(1, 1, 6, 1, true)
  g.translate(0, 0.5, 0)
  const pos = g.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const k = pos.getY(i) > 0.5 ? 0 : 1
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
  }
  g.setAttribute('color', new BufferAttribute(col, 3))
  return g
}

const additive = (color: string) =>
  new MeshBasicMaterial({ color, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false })

type Streak = { t: number; dur: number; a: Vector3; b: Vector3; mesh: Mesh; mat: MeshBasicMaterial }
type Fireball = { t: number; from: Vector3; to: Vector3; done: boolean }

/** Decide los eventos de cada noche y avisa cuando empiezan. */
function useSkyDirector() {
  const prevWeather = useRef<string | null>(null)
  const announced = useRef({ meteor: -1, aurora: -1 })
  useFrame(() => {
    const game = getGame()
    const night = nightId(game.totalHours)
    const dark = Math.max(0, 1 - environment.palette.daylight * 1.6)
    const clear = 1 - Math.min(1, weatherState.tintAmount * 1.5)
    if (dark > 0.5 && skyEvents.decided !== night) {
      skyEvents.decided = night
      skyEvents.fireballs = 0
      if ((game.weather === 'clear' || game.weather === 'windy') && Math.random() < METEOR_CHANCE) skyEvents.meteorNight = night
    }
    // La aurora llega cuando una tormenta eléctrica se despeja de noche.
    const w = game.weather
    if (prevWeather.current === 'storm' && w !== 'storm' && dark > 0.3) skyEvents.auroraNight = night
    prevWeather.current = w

    const outside = !cave.active && game.mode === 'active'
    const meteors = skyEvents.meteorNight === night ? dark * clear : 0
    const aurora = skyEvents.auroraNight === night ? dark * Math.max(0, 1 - weatherState.rain * 1.5) : 0
    skyEvents.meteors += (meteors - skyEvents.meteors) * 0.05
    skyEvents.aurora += (aurora - skyEvents.aurora) * 0.02
    if (outside && meteors > 0.6 && announced.current.meteor !== night) {
      announced.current.meteor = night
      game.notify('🌠 ¡Lluvia de estrellas! Mira al cielo: alguna podría caer en la isla', 'info')
    }
    if (outside && aurora > 0.5 && announced.current.aurora !== night) {
      announced.current.aurora = night
      game.notify('🌌 La tormenta dejó una aurora en el cielo del norte', 'info')
    }
  })
}

/** Estrellas fugaces cruzando el cielo y bolas de fuego que caen en la isla. */
function Meteors() {
  const sky = useRef<Group>(null)
  const geo = useMemo(streakGeometry, [])
  const streaks = useMemo<Streak[]>(
    () =>
      Array.from({ length: STREAKS }, () => {
        const mat = additive('#dfe9ff')
        const mesh = new Mesh(geo, mat)
        mesh.visible = false
        mesh.frustumCulled = false
        return { t: -1, dur: 1, a: new Vector3(), b: new Vector3(), mesh, mat }
      }),
    [geo],
  )
  const fire = useMemo(() => {
    const trail = new Mesh(geo, additive('#ffb066'))
    trail.frustumCulled = false
    const map = radialTexture()
    const head = new Sprite(new SpriteMaterial({ map, color: '#ffd9a0', blending: AdditiveBlending, depthWrite: false, fog: false }))
    const flash = new Sprite(new SpriteMaterial({ map, color: '#ffae5c', blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }))
    const g = new Group()
    g.add(trail, head, flash)
    g.visible = false
    return { g, trail, head, flash }
  }, [geo])
  const state = useRef({ next: 2, radiant: new Vector3(0.3, 0.6, -0.5).normalize(), ball: null as Fireball | null, flashT: -1 })

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = state.current
    const vis = skyEvents.meteors
    sky.current?.position.copy(camera.position)

    // --- Estrellas fugaces: salen todas del mismo punto del cielo (radiante) ---
    if (vis > 0.05 && (st.next -= dt) <= 0) {
      st.next = 0.25 + Math.random() * 0.9
      const s = streaks.find((x) => x.t < 0)
      if (s) {
        const az = Math.random() * Math.PI * 2
        // Bajas sobre el horizonte: la cámara casi nunca mira hacia arriba.
        const el = 0.1 + Math.random() * 0.45
        s.a.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el))
        tmp.copy(s.a).sub(st.radiant).normalize()
        s.b.copy(s.a).addScaledVector(tmp, 0.15 + Math.random() * 0.2).normalize()
        s.dur = 0.5 + Math.random() * 0.7
        s.t = 0
      }
    }
    for (const s of streaks) {
      if (s.t < 0) continue
      s.t += dt / s.dur
      if (s.t >= 1) {
        s.t = -1
        s.mesh.visible = false
        continue
      }
      s.mesh.visible = true
      tmp.copy(s.a).lerp(s.b, s.t).normalize()
      s.mesh.position.copy(tmp).multiplyScalar(SKY_R)
      tmp2.copy(s.a).sub(s.b).normalize()
      s.mesh.quaternion.setFromUnitVectors(UP, tmp2)
      const len = 30 + 60 * Math.sin(s.t * Math.PI)
      s.mesh.scale.set(2, len, 2)
      s.mat.color.setScalar(Math.sin(s.t * Math.PI) * vis * 1.4)
    }

    // --- Bolas de fuego: unas pocas por noche caen lejos del robot ---
    const game = getGame()
    if (!st.ball && vis > 0.6 && skyEvents.fireballs < MAX_FIREBALLS && !cave.active && game.mode === 'active' && (skyEvents.nextFire -= dt) <= 0) {
      skyEvents.nextFire = 25 + Math.random() * 35
      const spot = landSpot(player.position.x, player.position.z, 60, 150, 3)
      if (spot) {
        skyEvents.fireballs++
        const to = new Vector3(spot.x, getHeight(spot.x, spot.z), spot.z)
        const az = Math.random() * Math.PI * 2
        const from = to.clone().add(new Vector3(Math.cos(az) * 260, 240, Math.sin(az) * 260))
        st.ball = { t: 0, from, to, done: false }
        meteorFall(3, Math.hypot(spot.x - player.position.x, spot.z - player.position.z))
      }
    }
    const b = st.ball
    if (b) {
      b.t += dt / 3
      const k = Math.min(1, b.t)
      fire.g.visible = true
      fire.trail.visible = fire.head.visible = k < 1
      tmp.copy(b.from).lerp(b.to, k * k)
      fire.trail.position.copy(tmp)
      fire.head.position.copy(tmp)
      fire.head.scale.setScalar(6 + Math.sin(clock.elapsedTime * 30) * 1.2)
      tmp2.copy(b.from).sub(b.to).normalize()
      fire.trail.quaternion.setFromUnitVectors(UP, tmp2)
      fire.trail.scale.set(1.6, 40 + k * 30, 1.6)
      if (k >= 1 && !b.done) {
        b.done = true
        st.flashT = 0
        fire.flash.position.copy(b.to).y += 2
        game.addFinds([{ id: `met-${Date.now().toString(36)}`, kind: 'meteorite', x: b.to.x, z: b.to.z, until: game.totalHours + 48 }])
        game.notify('☄️ ¡Algo cayó del cielo! Busca el humo antes de que se apague', 'info')
      }
      if (b.done) {
        st.flashT += dt / 1.2
        fire.flash.scale.setScalar(10 + st.flashT * 40)
        fire.flash.material.opacity = Math.max(0, 1 - st.flashT)
        if (st.flashT >= 1) {
          st.ball = null
          fire.g.visible = false
        }
      }
    }
  })

  return (
    <>
      <group ref={sky}>
        {streaks.map((s, i) => (
          <primitive key={i} object={s.mesh} />
        ))}
      </group>
      <primitive object={fire.g} />
    </>
  )
}

const auroraVert = /* glsl */ `
  uniform float uTime;
  uniform float uCenter;
  uniform float uSpan;
  uniform float uRadius;
  uniform float uBase;
  uniform float uHeight;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    vUv = position.xy + 0.5;
    float a = uCenter + position.x * uSpan;
    float r = uRadius + sin(position.x * 9.0 + uTime * 0.25 + uSeed) * 30.0;
    float y = uBase + vUv.y * uHeight + sin(position.x * 6.0 + uTime * 0.18 + uSeed) * 18.0;
    vec3 p = vec3(sin(a) * r, y, -cos(a) * r);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const auroraFrag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float rays = 0.55 + 0.45 * sin(vUv.x * 160.0 + uTime * 1.1 + sin(vUv.x * 23.0 + uTime * 0.35 + uSeed) * 4.0);
    float body = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.3, 1.0, vUv.y));
    float ends = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float pulse = 0.75 + 0.25 * sin(uTime * 0.5 + vUv.x * 4.0 + uSeed);
    vec3 col = mix(vec3(0.2, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(0.25, 0.85, vUv.y));
    gl_FragColor = vec4(col * body * ends * rays * pulse * uOpacity, 1.0);
  }
`

/** Cortinas de aurora al norte (verde abajo, violeta arriba), siguen a la cámara. */
function Aurora() {
  const group = useRef<Group>(null)
  const geo = useMemo(() => new PlaneGeometry(1, 1, 80, 1), [])
  const mats = useMemo(
    () =>
      [
        { c: -0.5, s: 1.3, r: 520, b: 70, h: 170, seed: 0 },
        { c: 0.35, s: 1.1, r: 600, b: 95, h: 210, seed: 2.7 },
        { c: 0.9, s: 0.9, r: 680, b: 80, h: 150, seed: 5.1 },
      ].map(
        (p) =>
          new ShaderMaterial({
            vertexShader: auroraVert,
            fragmentShader: auroraFrag,
            uniforms: {
              uTime: { value: 0 },
              uOpacity: { value: 0 },
              uCenter: { value: p.c },
              uSpan: { value: p.s },
              uRadius: { value: p.r },
              uBase: { value: p.b },
              uHeight: { value: p.h },
              uSeed: { value: p.seed },
            },
            transparent: true,
            blending: AdditiveBlending,
            depthWrite: false,
            side: DoubleSide,
          }),
      ),
    [],
  )
  useFrame(({ camera, clock }) => {
    const g = group.current
    if (!g) return
    const a = skyEvents.aurora
    g.visible = a > 0.01
    if (!g.visible) return
    g.position.copy(camera.position)
    for (const m of mats) {
      m.uniforms.uTime.value = clock.elapsedTime
      m.uniforms.uOpacity.value = a * 0.9
    }
  })
  return (
    <group ref={group} visible={false}>
      {mats.map((m, i) => (
        <mesh key={i} geometry={geo} material={m} frustumCulled={false} />
      ))}
    </group>
  )
}

/** Eventos raros del cielo: lluvia de estrellas y aurora. */
export function SkyEvents() {
  useSkyDirector()
  return (
    <>
      <Meteors />
      <Aurora />
    </>
  )
}
