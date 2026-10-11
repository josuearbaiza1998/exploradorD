import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, Object3D, OctahedronGeometry, type InstancedMesh } from 'three'
import { useRef } from 'react'
import { CAVE_CACHE, CAVE_ORIGIN, CAVE_PATH, caveFloor, caveHeadroom } from '@/config/cave'
import { createToonMaterial } from '@/materials/toonMaterials'
import { useGameStore } from '@/store/gameStore'
import { useInCave } from '@/hooks/useInCave'
import { Cache } from './Pois'

const RING = 14
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
      const big = i > samples.length - 14
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
  const exitGlow = useMemo(() => createToonMaterial({ color: '#ffe2b0', emissive: '#ffd08a', emissiveIntensity: 1.6, side: DoubleSide }), [])
  const looted = useGameStore((s) => !!s.looted.cave)
  const lights = [8, 30, 52, samples.length - 6].map((i) => samples[Math.min(i, samples.length - 1)])
  const cacheY = caveFloor(CAVE_CACHE.x, CAVE_CACHE.z)
  return (
    <group name="cave-interior">
      <mesh geometry={shell} material={rock} receiveShadow />
      <mesh geometry={floor} material={ground} receiveShadow />
      {/* Luz del exterior en la boca: por ahí se sale */}
      <mesh material={exitGlow} position={[CAVE_ORIGIN.x, CAVE_ORIGIN.y + 1.6, CAVE_ORIGIN.z + 1.2]}>
        <circleGeometry args={[2.6, 12]} />
      </mesh>
      <pointLight position={[CAVE_ORIGIN.x, CAVE_ORIGIN.y + 2, CAVE_ORIGIN.z - 1]} color="#ffd9a0" intensity={8} distance={14} decay={1.5} />
      <Crystals samples={samples} />
      {lights.map((s, i) => (
        <pointLight key={i} position={[s.x, s.floor + 2.2, s.z]} color="#5fd4ff" intensity={i === 3 ? 22 : 10} distance={i === 3 ? 26 : 16} decay={1.4} />
      ))}
      <group position={[CAVE_CACHE.x, cacheY, CAVE_CACHE.z]} rotation-y={0}>
        <Cache looted={looted} glow="#7fe8ff" />
      </group>
    </group>
  )
}
