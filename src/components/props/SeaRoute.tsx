import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D, RepeatWrapping, SpriteMaterial, type Sprite, type Group, type Mesh } from 'three'
import { BUOYS, ROUTE_HALF_WIDTH, routePoint, STORM_AT } from '@/config/currents'
import { ISLAND } from '@/config/world'
import { createToonMaterial, sharedToon } from '@/materials/toonMaterials'
import { radialTexture } from '@/utils/radialTexture'
import { useGameStore } from '@/store/gameStore'
import { thunder } from '@/systems/audio/audioEngine'
import { player } from '@/systems/player'
import { seaState, waveHeight } from '@/systems/sea'

/** Boya de deriva: flotador naranja con mástil y luz (roja sin leer, verde leída). */
function Buoy({ x, z, read }: { x: number; z: number; read: boolean }) {
  const ref = useRef<Group>(null)
  const light = useRef<Mesh>(null)
  const orange = sharedToon('#ff7a2e')
  const white = sharedToon('#f2f2ea')
  const dark = sharedToon('#33363d')
  const lamp = read ? sharedToon('#7dff8a', { emissive: '#3dff5a', emissiveIntensity: 2 }) : sharedToon('#ff6a5a', { emissive: '#ff3b2e', emissiveIntensity: 2.2 })
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = seaState.time
    g.position.y = ISLAND.seaLevel + waveHeight(x, z, t) - 0.3
    g.rotation.x = Math.sin(t * 1.1 + x) * 0.12
    g.rotation.z = Math.cos(t * 0.9 + z) * 0.12
    if (light.current) light.current.visible = Math.sin(clock.elapsedTime * 4 + x) > (read ? -1 : 0.3)
  })
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh material={orange} castShadow>
        <cylinderGeometry args={[0.8, 0.9, 1.2, 10]} />
      </mesh>
      <mesh material={white} position-y={0.35}>
        <cylinderGeometry args={[0.82, 0.82, 0.25, 10]} />
      </mesh>
      <mesh material={dark} position-y={1.6}>
        <cylinderGeometry args={[0.07, 0.09, 2.2, 6]} />
      </mesh>
      <mesh material={orange} position-y={2.3}>
        <coneGeometry args={[0.35, 0.6, 4]} />
      </mesh>
      <mesh ref={light} material={lamp} position-y={2.75} userData={{ noOutline: true }}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
    </group>
  )
}

const CLOUDS = 140
const RAIN_SHAFTS = 9
const BOLT_SEGMENTS = 9

/** Textura de lluvia: rayas verticales que se desvanecen hacia abajo (se desplaza en v). */
function rainTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  g.clearRect(0, 0, 64, 256)
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 64
    const y = Math.random() * 256
    const len = 20 + Math.random() * 50
    g.strokeStyle = `rgba(200,210,225,${0.25 + Math.random() * 0.45})`
    g.lineWidth = 1 + Math.random() * 1.5
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x - 3, y + len)
    g.stroke()
  }
  const tex = new CanvasTexture(c)
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** Mancha oscura del mar bajo la tormenta (degradado radial). */
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64)
  grd.addColorStop(0, 'rgba(10,18,30,0.75)')
  grd.addColorStop(0.6, 'rgba(10,18,30,0.45)')
  grd.addColorStop(1, 'rgba(10,18,30,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

/**
 * La tormenta perpetua entre las dos islas, para que se lea de lejos: un
 * cumulonimbo negro con yunque que gira despacio, cortinas de lluvia que caen
 * hasta el mar, rayos que bajan en zigzag e iluminan las nubes por dentro y
 * el mar oscurecido debajo. No le afecta la niebla (se ve desde la playa).
 */
function StormWall() {
  const clouds = useRef<InstancedMesh>(null)
  const spin = useRef<Group>(null)
  const bolt = useRef<Group>(null)
  const boltMeshes = useRef<Mesh[]>([])
  const glow = useRef<Sprite>(null)
  const p = routePoint(STORM_AT + 0.11)
  const radius = ROUTE_HALF_WIDTH + 40
  const { geo, mat, rain, rainMat, shadow, haze, puffs, shafts, boltMat, glowMat } = useMemo(() => {
    // Cumulonimbo: base ancha y oscura, torre en el centro y un yunque plano arriba.
    const puffs: { x: number; y: number; z: number; s: number; flat: number; shade: number }[] = []
    for (let i = 0; i < CLOUDS; i++) {
      const layer = i / CLOUDS
      const a = Math.random() * Math.PI * 2
      let r: number
      let y: number
      let s: number
      let flat = 0.6
      if (layer < 0.45) {
        // Base: anillo ancho y bajo.
        r = radius * (0.3 + Math.random() * 0.75)
        y = 24 + Math.random() * 14
        s = 14 + Math.random() * 12
      } else if (layer < 0.78) {
        // Torre: estrecha y alta.
        r = radius * Math.random() * 0.5
        y = 40 + Math.random() * 60
        s = 16 + Math.random() * 14
        flat = 0.85
      } else {
        // Yunque: se abre arriba, plano.
        r = radius * (0.2 + Math.random() * 1.0)
        y = 100 + Math.random() * 16
        s = 16 + Math.random() * 14
        flat = 0.35
      }
      puffs.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r * 0.75, s, flat, shade: Math.min(1, (y - 20) / 100) })
    }
    const shafts = Array.from({ length: RAIN_SHAFTS }, (_, i) => {
      const a = (i / RAIN_SHAFTS) * Math.PI * 2 + Math.random() * 0.5
      const r = radius * (0.25 + Math.random() * 0.6)
      return { x: Math.cos(a) * r, z: Math.sin(a) * r * 0.75, w: 30 + Math.random() * 30, rot: Math.random() * Math.PI, speed: 0.6 + Math.random() * 0.5 }
    })
    const mat = createToonMaterial({ color: '#ffffff', bands: 2, fog: false, emissive: new Color('#9fb4ff'), emissiveIntensity: 0 })
    const rain = rainTexture()
    rain.repeat.set(3, 1)
    return {
      geo: new IcosahedronGeometry(1, 1),
      mat,
      rain,
      rainMat: new MeshBasicMaterial({ map: rain, color: '#8d9bb0', transparent: true, opacity: 0.75, side: DoubleSide, depthWrite: false, fog: false }),
      shadow: new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, fog: false }),
      haze: new MeshBasicMaterial({ map: radialTexture(true), color: '#2b3343', transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false, fog: false }),
      puffs,
      shafts,
      boltMat: new MeshBasicMaterial({ color: '#f4f7ff', fog: false, toneMapped: false }),
      glowMat: new SpriteMaterial({ map: radialTexture(), color: '#cfd9ff', transparent: true, opacity: 0, depthWrite: false, fog: false, blending: AdditiveBlending }),
    }
  }, [radius])
  const dummy = useMemo(() => new Object3D(), [])
  const color = useMemo(() => new Color(), [])
  const placed = useRef(false)
  const st = useRef({ next: 2, t: -1, x: 0, z: 0 })
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1)
    const t = clock.elapsedTime
    const m = clouds.current
    if (m) {
      puffs.forEach((c, i) => {
        dummy.position.set(c.x, c.y + Math.sin(t * 0.25 + i * 2) * 1.2, c.z)
        const breathe = 1 + Math.sin(t * 0.3 + i) * 0.05
        dummy.scale.set(c.s * 1.3 * breathe, c.s * c.flat * breathe, c.s * breathe)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
        if (!placed.current) {
          // Base casi negra; arriba, gris pizarra con el borde más claro.
          color.set('#1c2230').lerp(new Color('#6b7488'), c.shade)
          m.setColorAt(i, color)
        }
      })
      m.instanceMatrix.needsUpdate = true
      if (!placed.current && m.instanceColor) m.instanceColor.needsUpdate = true
      placed.current = true
    }
    if (spin.current) spin.current.rotation.y += dt * 0.012
    rain.offset.y -= dt * 0.9
    // Rayos: un zigzag de la base de la nube al mar, con destello dentro de las nubes.
    const s = st.current
    s.next -= dt
    if (s.next <= 0) {
      s.next = 1.2 + Math.random() * 3.5
      s.t = 0
      const a = Math.random() * Math.PI * 2
      const r = radius * Math.random() * 0.7
      s.x = Math.cos(a) * r
      s.z = Math.sin(a) * r * 0.75
      // Zigzag nuevo.
      let x = s.x
      let y = 26
      let z = s.z
      const step = 26 / BOLT_SEGMENTS
      boltMeshes.current.forEach((seg) => {
        const nx = x + (Math.random() - 0.5) * 6
        const nz = z + (Math.random() - 0.5) * 6
        const ny = y - step
        const dx = nx - x
        const dy = ny - y
        const dz = nz - z
        const len = Math.hypot(dx, dy, dz)
        seg.position.set((x + nx) / 2, (y + ny) / 2, (z + nz) / 2)
        seg.scale.set(1, len, 1)
        seg.rotation.set(Math.atan2(Math.hypot(dx, dz), dy), Math.atan2(dx, dz), 0, 'YXZ')
        x = nx
        y = ny
        z = nz
      })
      const d = Math.hypot(player.position.x - p.x, player.position.z - p.z)
      if (d < 500) thunder(Math.max(0, 0.55 - d / 600), d / 340)
    }
    if (s.t >= 0) s.t += dt
    const on = s.t >= 0 && s.t < 0.4 && Math.sin(s.t * 55) > -0.3
    if (bolt.current) bolt.current.visible = on
    if (glow.current) glow.current.position.set(s.x, 34, s.z)
    glowMat.opacity = on ? 0.9 : 0
    mat.emissiveIntensity = on ? 0.55 : 0
    if (s.t > 0.4) s.t = -1
  })
  return (
    <group position={[p.x, ISLAND.seaLevel, p.z]}>
      <group ref={spin}>
        <instancedMesh ref={clouds} args={[geo, mat, CLOUDS]} frustumCulled={false} />
        {shafts.map((sh, i) => (
          <group key={i} position={[sh.x, 14, sh.z]} rotation-y={sh.rot}>
            {[0, Math.PI / 2].map((r) => (
              <mesh key={r} material={rainMat} rotation-y={r}>
                <planeGeometry args={[sh.w, 30]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      {/* Cortina de lluvia lejana: oscura abajo, se desvanece hacia la nube */}
      <mesh material={haze} position-y={15} scale={[1, 1, 0.75]} rotation-x={Math.PI}>
        <cylinderGeometry args={[radius * 0.85, radius * 0.85, 32, 24, 1, true]} />
      </mesh>
      {/* Mar oscuro bajo la tormenta */}
      <mesh material={shadow} position-y={0.4} rotation-x={-Math.PI / 2} scale={[radius * 2.6, radius * 2.2, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={bolt} visible={false}>
        {Array.from({ length: BOLT_SEGMENTS }, (_, i) => (
          <mesh key={i} material={boltMat} ref={(m) => { if (m) boltMeshes.current[i] = m }}>
            <cylinderGeometry args={[0.35, 0.35, 1, 4]} />
          </mesh>
        ))}
      </group>
      <sprite ref={glow} material={glowMat} scale={[110, 90, 1]} />
    </group>
  )
}

/** Lo del mar abierto: las boyas de deriva y la tormenta entre islas. */
export function SeaRoute() {
  const buoys = useGameStore((s) => s.buoys)
  return (
    <>
      {BUOYS.map((b) => (
        <Buoy key={b.id} x={b.x} z={b.z} read={!!buoys[b.id]} />
      ))}
      <StormWall />
    </>
  )
}
