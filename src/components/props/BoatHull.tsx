import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { MATERIALS, sharedToon } from '@/materials/toonMaterials'
import { deckGeometry, gunwaleAt, hullGeometry, hullHalfBeam, HULL, sailGeometry } from './boatGeometry'

const DECK_Y = 1.9
const MAST_Z = -3.6
const MAST_BASE = 3.9
const MAST_TOP = 14.5
const BOOM_Y = 6.4
const SAIL_FOOT = 6.4
/** Puente de mando sobre el fuselaje, donde va el robot (BOAT.deck). */
const BRIDGE = { y: 4.6, z: 0.8 }

/**
 * Lo que convierte la nave en barco: casco de tablones en V con proa afilada,
 * cubierta, barandilla, puente de mando con timón y un mástil con vela de
 * lona remendada. Todas las piezas se tocan entre sí (nada suelto).
 */
export function BoatHull() {
  const geo = useMemo(
    () => ({
      hull: hullGeometry(),
      band: hullGeometry(0, 0.14, 0.04),
      bottom: hullGeometry(0.55, 1, 0.02),
      deck: deckGeometry(DECK_Y),
      sail: sailGeometry(MAST_TOP - BOOM_Y - 0.6, SAIL_FOOT),
    }),
    [],
  )
  const wood = sharedToon('#8a5a34', { side: DoubleSide, flatShading: true })
  const plank = sharedToon('#b48654')
  const cloth = sharedToon('#efe6d2', { side: DoubleSide, bands: 2 })
  const patch = sharedToon('#e0702c', { side: DoubleSide })
  const rope = sharedToon('#d6c08a')

  // Barandilla: postes sobre la borda y pasamanos entre ellos.
  const rail = useMemo(() => {
    const posts: { x: number; y: number; z: number }[] = []
    for (let z = -10.2; z <= 7.4; z += 2.2) {
      for (const side of [-1, 1]) posts.push({ x: side * (hullHalfBeam(z) * 0.97 - 0.12), y: gunwaleAt(z), z })
    }
    return posts
  }, [])
  const railSegs = useMemo(() => {
    const segs: { x: number; y: number; z: number; len: number; yaw: number; pitch: number }[] = []
    for (const side of [-1, 1]) {
      const ps = rail.filter((p) => Math.sign(p.x) === side)
      for (let i = 0; i < ps.length - 1; i++) {
        const a = ps[i]
        const b = ps[i + 1]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        segs.push({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2 + 0.7,
          z: (a.z + b.z) / 2,
          len: Math.hypot(dx, dy, dz),
          yaw: Math.atan2(dx, dz),
          pitch: -Math.atan2(dy, Math.hypot(dx, dz)),
        })
      }
    }
    return segs
  }, [rail])

  return (
    <group>
      {/* Casco: tablones, cinta naranja en la borda y fondo oscuro bajo la flotación */}
      <mesh geometry={geo.hull} material={wood} castShadow receiveShadow />
      <mesh geometry={geo.band} material={MATERIALS.shipAccent} />
      <mesh geometry={geo.bottom} material={MATERIALS.shipDark} />
      {/* Cubierta */}
      <mesh geometry={geo.deck} material={plank} receiveShadow />
      {/* Roda: el tajamar de la proa */}
      <mesh material={wood} position={[0, (gunwaleAt(HULL.bow) + HULL.keel) / 2 + 0.6, HULL.bow - 0.15]} castShadow>
        <boxGeometry args={[0.28, gunwaleAt(HULL.bow) - HULL.keel - 0.6, 0.4]} />
      </mesh>
      {/* Barandilla */}
      {rail.map((p, i) => (
        <mesh key={i} material={wood} position={[p.x, p.y + 0.35, p.z]}>
          <boxGeometry args={[0.12, 0.8, 0.12]} />
        </mesh>
      ))}
      {railSegs.map((s, i) => (
        <mesh key={i} material={plank} position={[s.x, s.y, s.z]} rotation={[s.pitch, s.yaw, 0, 'YXZ']}>
          <boxGeometry args={[0.1, 0.1, s.len + 0.1]} />
        </mesh>
      ))}
      {/* Puente de mando sobre el fuselaje, con patas hasta la cubierta y timón */}
      <group position={[0, BRIDGE.y, BRIDGE.z]}>
        <mesh material={plank} position-y={-0.08} castShadow receiveShadow>
          <boxGeometry args={[2.8, 0.16, 2.6]} />
        </mesh>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} material={wood} position={[sx * 1.25, -(BRIDGE.y - DECK_Y) / 2 - 0.1, sz * 1.15]}>
              <boxGeometry args={[0.16, BRIDGE.y - DECK_Y, 0.16]} />
            </mesh>
          )),
        )}
        {/* Timón: pedestal y rueda con cabillas delante del robot */}
        <mesh material={wood} position={[0, 0.5, 1.05]}>
          <boxGeometry args={[0.22, 1, 0.22]} />
        </mesh>
        <group position={[0, 1.05, 0.92]}>
          <mesh material={wood}>
            <torusGeometry args={[0.42, 0.05, 5, 12]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} material={wood} rotation-z={(i * Math.PI) / 4}>
              <boxGeometry args={[1.05, 0.05, 0.05]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Mástil, cofa, botavara y vela de lona remendada */}
      <group position={[0, 0, MAST_Z]}>
        <mesh material={wood} position-y={(MAST_BASE + MAST_TOP) / 2} castShadow>
          <cylinderGeometry args={[0.13, 0.2, MAST_TOP - MAST_BASE, 7]} />
        </mesh>
        <mesh material={wood} position-y={MAST_BASE + 0.15}>
          <cylinderGeometry args={[0.38, 0.45, 0.3, 7]} />
        </mesh>
        <mesh material={wood} position={[0, BOOM_Y, -SAIL_FOOT / 2]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.09, 0.09, SAIL_FOOT + 0.2, 6]} />
        </mesh>
        <mesh geometry={geo.sail} material={cloth} position={[0.02, BOOM_Y + 0.08, -0.15]} castShadow />
        {/* Remiendo naranja (tela del paracaídas de la nave) */}
        <mesh material={patch} position={[0.38, BOOM_Y + 1.6, -1.6]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[1.4, 1.1]} />
        </mesh>
        {/* Estay de proa: del tope del mástil a la roda */}
        <Stay from={[0, MAST_TOP - 0.3, 0]} to={[0, gunwaleAt(HULL.bow) + 0.2, HULL.bow - 0.4 - MAST_Z]} material={rope} />
        {/* Obenques a cada banda */}
        {[-1, 1].map((sx) => (
          <Stay key={sx} from={[0, MAST_TOP - 2, 0]} to={[sx * (hullHalfBeam(MAST_Z) - 0.15), gunwaleAt(MAST_Z), 0]} material={rope} />
        ))}
      </group>
    </group>
  )
}

/** Cabo recto entre dos puntos (en el espacio del grupo padre). */
function Stay({ from, to, material }: { from: [number, number, number]; to: [number, number, number]; material: ReturnType<typeof sharedToon> }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz)
  const yaw = Math.atan2(dx, dz)
  const pitch = Math.atan2(Math.hypot(dx, dz), dy)
  return (
    <mesh
      material={material}
      position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
      rotation={[pitch, yaw, 0, 'YXZ']}
      userData={{ noOutline: true }}
    >
      <cylinderGeometry args={[0.03, 0.03, len, 4]} />
    </mesh>
  )
}
