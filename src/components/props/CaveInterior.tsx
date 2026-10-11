import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, MeshBasicMaterial, Object3D, OctahedronGeometry, PointsMaterial, type InstancedMesh, type Points } from 'three'
import { useRef } from 'react'
import { CAVE_BLOCKERS, CAVE_CACHE, CAVE_ORIGIN, CAVE_PATH, caveFloor, caveHeadroom } from '@/config/cave'
import { CAVE_CRYSTAL_WORLD } from '@/systems/interaction/interactables'
import { createToonMaterial } from '@/materials/toonMaterials'
import { useQuality } from '@/store/settingsStore'
import { useGameStore } from '@/store/gameStore'
import { useInCave } from '@/hooks/useInCave'
import { radialTexture } from '@/utils/radialTexture'
import { Cache } from './Pois'

const RING = 14

/** Luz difusa: se suma a lo de detrás y se desvanece en los bordes. */
function glowMaterial(color: string, opacity: number) {
  return new MeshBasicMaterial({ color, map: radialTexture(), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false })
}
const STEP = 0.8

type Sample = { x: number; z: number; nx: number; nz: number; w: number; floor: number }

/** Muestras a lo largo del camino de la cueva (coordenadas de mundo). */
function samplePath(): Sample[] {
  const out: Sample[] = []
  for (let i = 0; i < CAVE_PATH.length - 1; i++) {
    const [ax, az, aw, ay] = CAVE_PATH[i]
    const [bx, bz, bw, by] = CAVE_PATH[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.ceil(len / STEP)
    const tx = (bx - ax) / len
    const tz = (bz - az) / len
    for (let k = 0; k < steps + (i === CAVE_PATH.length - 2 ? 1 : 0); k++) {
      const f = k / steps
      out.push({
        x: CAVE_ORIGIN.x + ax + (bx - ax) * f,
        z: CAVE_ORIGIN.z + az + (bz - az) * f,
        nx: -tz,
        nz: tx,
        w: aw + (bw - aw) * f,
        floor: CAVE_ORIGIN.y + ay + (by - ay) * f,
      })
    }
  }
  return out
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Paredes y techo: un arco rocoso barrido a lo largo del camino, cerrado al fondo. */
function buildShell(samples: Sample[]) {
  const pos: number[] = []
  const idx: number[] = []
  samples.forEach((s, i) => {
    const h = caveHeadroom(s.w)
    for (let j = 0; j <= RING; j++) {
      const a = (j / RING) * Math.PI
      // Bultos solo hacia fuera: el hueco nunca es más estrecho que el camino.
      const bump = 1 + hash(i, j) * 0.18
      const side = Math.cos(a) * (s.w + 0.25) * bump
      const up = Math.sin(a) * h * (0.9 + hash(j, i) * 0.2)
      pos.push(s.x + s.nx * side, s.floor - 0.4 + up, s.z + s.nz * side)
    }
    if (i > 0) {
      const b0 = (i - 1) * (RING + 1)
      const b1 = i * (RING + 1)
      for (let j = 0; j < RING; j++) idx.push(b0 + j, b1 + j, b0 + j + 1, b0 + j + 1, b1 + j, b1 + j + 1)
    }
  })
  // Tapa del fondo.
  const last = samples[samples.length - 1]
  const c = pos.length / 3
  pos.push(last.x, last.floor + caveHeadroom(last.w) * 0.4, last.z - 1.5)
  const b = (samples.length - 1) * (RING + 1)
  for (let j = 0; j < RING; j++) idx.push(b + j, c, b + j + 1)
  // Tramo inferior (entre los dos pies del arco): sin él quedaba un hueco al fondo.
  idx.push(b, b + RING, c)
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Suelo: franja que sigue la altura real del suelo de la cueva. */
function buildFloor(samples: Sample[]) {
  const pos: number[] = []
  const idx: number[] = []
  const W = 6
  samples.forEach((s, i) => {
    for (let j = 0; j <= W; j++) {
      const f = (j / W) * 2 - 1
      const x = s.x + s.nx * f * (s.w + 0.3)
      const z = s.z + s.nz * f * (s.w + 0.3)
      pos.push(x, caveFloor(x, z) - 0.02, z)
    }
    if (i > 0) {
      const b0 = (i - 1) * (W + 1)
      const b1 = i * (W + 1)
      for (let j = 0; j < W; j++) idx.push(b0 + j, b0 + j + 1, b1 + j, b0 + j + 1, b1 + j + 1, b1 + j)
    }
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Racimos de cristales azules pegados a las paredes (y grandes en la cámara final). */
function Crystals({ samples }: { samples: Sample[] }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new OctahedronGeometry(1, 0), [])
  const material = useMemo(() => createToonMaterial({ color: '#7fe3ff', emissive: '#3ab8ff', emissiveIntensity: 1.1, flatShading: true }), [])
  const items = useMemo(() => {
    const d = new Object3D()
    const list: Object3D['matrix'][] = []
    samples.forEach((s, i) => {
      if (i % 3 !== 0) return
      const side = hash(i, 7) > 0.5 ? 1 : -1
      const r = s.w - 0.2
      const x = s.x + s.nx * side * r
      const z = s.z + s.nz * side * r
      const big = i > samples.length - 30
      d.position.set(x, s.floor + 0.2 + hash(i, 3) * (big ? 2 : 0.8), z)
      d.rotation.set(hash(i, 1) * 0.8, hash(i, 2) * 3, side * (0.4 + hash(i, 4) * 0.5))
      const k = (big ? 0.7 : 0.25) + hash(i, 5) * (big ? 0.6 : 0.3)
      d.scale.set(k * 0.6, k * 1.8, k * 0.6)
      d.updateMatrix()
      list.push(d.matrix.clone())
    })
    return list
  }, [samples])
  useFrame(({ clock }) => {
    material.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 1.3) * 0.25
  })
  return (
    <instancedMesh
      ref={(m) => {
        ref.current = m
        if (m) items.forEach((mat, i) => m.setMatrixAt(i, mat))
      }}
      args={[geometry, material, items.length]}
    />
  )
}

/** Interior de la Cueva de cristal: solo existe mientras el robot está dentro. */
export function CaveInterior() {
  const inside = useInCave()
  if (!inside) return null
  return <Interior />
}

function Interior() {
  const samples = useMemo(samplePath, [])
  const shell = useMemo(() => buildShell(samples), [samples])
  const floor = useMemo(() => buildFloor(samples), [samples])
  const rock = useMemo(() => createToonMaterial({ color: '#3d3646', side: DoubleSide, flatShading: true }), [])
  const ground = useMemo(() => createToonMaterial({ color: '#4d4350', flatShading: true }), [])
  const exitGlow = useMemo(() => glowMaterial('#fff0d0', 1), [])
  const looted = useGameStore((s) => !!s.looted.cave)
  // En calidad baja, menos luces puntuales (cada una encarece todos los píxeles).
  const extras = useQuality().extras
  const lights = [8, 34, 62, 92, samples.length - 22, samples.length - 6]
    .map((i) => samples[Math.min(i, samples.length - 1)])
    .filter((_, i) => extras || i === 1 || i === 4)
  const cacheY = caveFloor(CAVE_CACHE.x, CAVE_CACHE.z)
  return (
    <group name="cave-interior">
      <mesh geometry={shell} material={rock} receiveShadow />
      <mesh geometry={floor} material={ground} receiveShadow />
      {/* Luz del exterior en la boca: un resplandor difuso, por ahí se sale */}
      <mesh material={exitGlow} position={[CAVE_ORIGIN.x, CAVE_ORIGIN.y + 2.2, CAVE_ORIGIN.z + 1.4]} renderOrder={3}>
        <planeGeometry args={[11, 8]} />
      </mesh>
      <pointLight position={[CAVE_ORIGIN.x, CAVE_ORIGIN.y + 2, CAVE_ORIGIN.z - 1]} color="#ffd9a0" intensity={8} distance={14} decay={1.5} />
      <Crystals samples={samples} />
      {lights.map((s, i) => (
        <pointLight key={i} position={[s.x, s.floor + (i >= lights.length - 2 ? 4 : 2.2), s.z]} color="#5fd4ff" intensity={extras ? (i >= 4 ? 26 : 12) : 22} distance={extras ? (i >= 4 ? 30 : 18) : 40} decay={1.4} />
      ))}
      <Geode />
      <Pool />
      <HarvestCrystals />
      {extras && <Spores />}
      <group position={[CAVE_CACHE.x, cacheY, CAVE_CACHE.z]} rotation-y={0}>
        <Cache looted={looted} glow="#7fe8ff" />
      </group>
    </group>
  )
}

const local = (lx: number, lz: number) => ({ x: CAVE_ORIGIN.x + lx, z: CAVE_ORIGIN.z + lz })

/** Geoda gigante en el centro de la cámara: un racimo de cristales que late. */
function Geode() {
  const [bx, bz, br] = CAVE_BLOCKERS[0]
  const p = local(bx, bz)
  const y = caveFloor(p.x, p.z)
  const mat = useMemo(() => createToonMaterial({ color: '#9ff0ff', emissive: '#4ac8ff', emissiveIntensity: 1.4, flatShading: true }), [])
  const base = useMemo(() => createToonMaterial({ color: '#2f2a38', flatShading: true }), [])
  useFrame(({ clock }) => {
    mat.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 0.9) * 0.4
  })
  const shards = useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2
        const r = i === 0 ? 0 : br * (0.35 + hash(i, 9) * 0.4)
        return {
          pos: [Math.cos(a) * r, 0.6 + hash(i, 2) * 0.6, Math.sin(a) * r] as [number, number, number],
          rot: [Math.cos(a) * (i ? 0.5 : 0), a, Math.sin(a) * (i ? 0.5 : 0)] as [number, number, number],
          s: (i === 0 ? [0.9, 3.4, 0.9] : [0.45, 1.4 + hash(i, 4) * 1.4, 0.45]) as [number, number, number],
        }
      }),
    [br],
  )
  return (
    <group position={[p.x, y, p.z]}>
      <mesh material={base} scale={[br, 0.6, br]}>
        <icosahedronGeometry args={[1, 0]} />
      </mesh>
      {shards.map((sh, i) => (
        <mesh key={i} material={mat} position={sh.pos} rotation={sh.rot} scale={sh.s}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      <pointLight position={[0, 3, 0]} color="#7fe3ff" intensity={18} distance={20} decay={1.5} />
    </group>
  )
}

/** Lago subterráneo: agua quieta que brilla desde el fondo. */
function Pool() {
  const [bx, bz, br] = CAVE_BLOCKERS[1]
  const p = local(bx, bz)
  const y = caveFloor(p.x, p.z)
  const water = useMemo(() => createToonMaterial({ color: '#1f6f9a', emissive: '#1aa6d8', emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }), [])
  const rim = useMemo(() => createToonMaterial({ color: '#3a3344', flatShading: true }), [])
  useFrame(({ clock }) => {
    water.emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 0.6) * 0.15
  })
  return (
    <group position={[p.x, y, p.z]}>
      <mesh material={rim} rotation-x={-Math.PI / 2} position-y={0.04}>
        <ringGeometry args={[br * 0.92, br * 1.15, 14]} />
      </mesh>
      <mesh material={water} rotation-x={-Math.PI / 2} position-y={0.06}>
        <circleGeometry args={[br * 0.95, 20]} />
      </mesh>
    </group>
  )
}

/** Racimos que se arrancan con el martillo (desaparecen hasta que rebrotan). */
function HarvestCrystals() {
  const harvested = useGameStore((s) => s.harvested)
  const mat = useMemo(() => createToonMaterial({ color: '#b6f4ff', emissive: '#5fd4ff', emissiveIntensity: 1.6, flatShading: true }), [])
  return (
    <>
      {CAVE_CRYSTAL_WORLD.map((c, i) =>
        c.key in harvested ? null : (
          <group key={c.key} position={[c.x, c.y, c.z]} rotation-y={i * 1.9}>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} material={mat} position={[Math.cos(k * 1.6) * 0.3 * (k ? 1 : 0), 0.45, Math.sin(k * 1.6) * 0.3 * (k ? 1 : 0)]} rotation={[k ? 0.45 : 0, k, k ? 0.3 : 0]} scale={[0.22, k ? 0.6 : 0.9, 0.22]}>
                <octahedronGeometry args={[1, 0]} />
              </mesh>
            ))}
          </group>
        ),
      )}
    </>
  )
}

/** Esporas luminosas flotando en la cámara del fondo. */
function Spores() {
  const ref = useRef<Points>(null)
  const N = 90
  const { geometry, seeds } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3))
    const seeds = Array.from({ length: N }, () => {
      const p = local((Math.random() - 0.5) * 22, -72 - Math.random() * 20)
      return { ...p, y: caveFloor(p.x, p.z) + 0.5 + Math.random() * 5, ph: Math.random() * 100 }
    })
    return { geometry: g, seeds }
  }, [])
  const material = useMemo(() => new PointsMaterial({ size: 0.18, color: '#9ff0ff', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const arr = (geometry.getAttribute('position') as BufferAttribute).array as Float32Array
    for (let i = 0; i < N; i++) {
      const s = seeds[i]
      arr[i * 3] = s.x + Math.sin(t * 0.3 + s.ph) * 0.8
      arr[i * 3 + 1] = s.y + Math.sin(t * 0.5 + s.ph * 2) * 0.5
      arr[i * 3 + 2] = s.z + Math.cos(t * 0.25 + s.ph) * 0.8
    }
    geometry.getAttribute('position').needsUpdate = true
  })
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
