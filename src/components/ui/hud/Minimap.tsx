import { useEffect, useRef, useState } from 'react'
import { Color } from 'three'
import { CRASH_SITE, ISLAND, OASIS } from '@/config/world'
import { POIS } from '@/config/pois'
import { cave, CAVE_OUTSIDE } from '@/config/cave'
import { getGame } from '@/store/gameStore'
import { useSettings } from '@/store/settingsStore'
import { cameraRig } from '@/systems/cameraRig'
import { player } from '@/systems/player'
import { scavengers } from '@/systems/scavengers'
import { explored, exploredVersion, MAP_EXTENT, MAP_GRID } from '@/systems/exploredMap'
import { getHeight, getSlope, OASIS_WATER_LEVEL } from '@/utils/terrain/heightfield'
import { terrainColor } from '@/utils/terrain/terrainColor'

const BASE = 160
/** Metros visibles a cada lado en el minimapa pequeño. */
const VIEW = 70
const SEA = '#2a8fa8'

/** Imagen de la isla (se calcula una vez, colores del propio terreno con relieve). */
let baseCanvas: HTMLCanvasElement | null = null
function baseMap(): HTMLCanvasElement {
  if (baseCanvas) return baseCanvas
  const c = document.createElement('canvas')
  c.width = c.height = BASE
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(BASE, BASE)
  const col = new Color()
  const step = (MAP_EXTENT * 2) / BASE
  for (let j = 0; j < BASE; j++) {
    for (let i = 0; i < BASE; i++) {
      const x = -MAP_EXTENT + (i + 0.5) * step
      const z = -MAP_EXTENT + (j + 0.5) * step
      const y = getHeight(x, z)
      const k = (j * BASE + i) * 4
      if (y < ISLAND.seaLevel) {
        const deep = Math.min(1, (ISLAND.seaLevel - y) / 8)
        col.set('#4cc3d4').lerp(new Color('#1d6c86'), deep)
      } else if (y < OASIS_WATER_LEVEL && Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.radius * 1.2) {
        col.set('#45d6df')
      } else {
        terrainColor(x, y, z, getSlope(x, z, 1), col)
        // Relieve: luz desde el noroeste.
        const shade = (getHeight(x - step, z - step) - getHeight(x + step, z + step)) / (step * 2)
        col.multiplyScalar(Math.max(0.55, Math.min(1.35, 1 + shade * 0.6)))
      }
      img.data[k] = Math.min(255, col.r * 255)
      img.data[k + 1] = Math.min(255, col.g * 255)
      img.data[k + 2] = Math.min(255, col.b * 255)
      img.data[k + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  baseCanvas = c
  return c
}

/** Niebla: celdas sin explorar en oscuro (bordes suaves al escalar). */
const fogCanvas = document.createElement('canvas')
fogCanvas.width = fogCanvas.height = MAP_GRID
let fogVersion = -1
function fogMap() {
  if (fogVersion === exploredVersion.v) return fogCanvas
  fogVersion = exploredVersion.v
  const ctx = fogCanvas.getContext('2d')!
  const img = ctx.createImageData(MAP_GRID, MAP_GRID)
  for (let k = 0; k < explored.length; k++) {
    img.data[k * 4] = 18
    img.data[k * 4 + 1] = 22
    img.data[k * 4 + 2] = 32
    img.data[k * 4 + 3] = explored[k] ? 0 : 235
  }
  ctx.putImageData(img, 0, 0)
  return fogCanvas
}

/**
 * Minimapa: solo muestra lo que el robot ya ha visto (el resto es niebla),
 * con la nave, los lugares descubiertos y las cajas caídas. Tocarlo abre el
 * mapa de toda la isla. Se puede apagar desde el menú.
 */
export function Minimap() {
  const on = useSettings((s) => s.minimap)
  const [big, setBig] = useState(false)
  if (!on) return null
  return (
    <>
      {!big && <MapCanvas big={false} onClick={() => setBig(true)} />}
      {big && (
        <div className="map-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setBig(false)}>
          <MapCanvas big onClick={() => setBig(false)} />
        </div>
      )}
    </>
  )
}

function MapCanvas({ big, onClick }: { big: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const draw = () => {
      const css = canvas.clientWidth
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const S = Math.round(css * dpr)
      if (canvas.width !== S) canvas.width = canvas.height = S
      const ctx = canvas.getContext('2d')!
      const inside = cave.active
      const px = inside ? CAVE_OUTSIDE.x : player.position.x
      const pz = inside ? CAVE_OUTSIDE.z : player.position.z
      const V = big ? MAP_EXTENT : VIEW
      const cx = big ? 0 : px
      const cz = big ? 0 : pz
      const toX = (x: number) => ((x - cx + V) / (2 * V)) * S
      const toY = (z: number) => ((z - cz + V) / (2 * V)) * S
      ctx.fillStyle = SEA
      ctx.fillRect(0, 0, S, S)
      // Isla y niebla: recorte de las imágenes según la vista.
      const src = (img: HTMLCanvasElement, n: number) => {
        const u = ((cx - V + MAP_EXTENT) / (2 * MAP_EXTENT)) * n
        const v = ((cz - V + MAP_EXTENT) / (2 * MAP_EXTENT)) * n
        const w = ((2 * V) / (2 * MAP_EXTENT)) * n
        ctx.drawImage(img, u, v, w, w, 0, 0, S, S)
      }
      ctx.imageSmoothingEnabled = true
      src(baseMap(), BASE)
      src(fogMap(), MAP_GRID)

      const game = getGame()
      const r = S * (big ? 0.022 : 0.05)
      // Nave.
      ctx.fillStyle = '#ff8a3d'
      ctx.strokeStyle = '#1b1b1b'
      ctx.lineWidth = r * 0.3
      ctx.beginPath()
      ctx.arc(toX(CRASH_SITE.x), toY(CRASH_SITE.z), r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Lugares descubiertos.
      ctx.font = `${r * 2.2}px system-ui`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const p of POIS) if (game.discovered[p.id]) ctx.fillText(p.icon, toX(p.x), toY(p.z))
      // Estructuras.
      ctx.fillStyle = '#9fe7ff'
      for (const st of game.structures) ctx.fillRect(toX(st.x) - r * 0.4, toY(st.z) - r * 0.4, r * 0.8, r * 0.8)
      // Cajas caídas: parpadean.
      if (Math.sin(performance.now() / 180) > 0) {
        ctx.fillStyle = '#ffcc33'
        for (const b of game.droppedBoxes) {
          ctx.beginPath()
          ctx.arc(toX(b.position[0]), toY(b.position[2]), r * 0.8, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
      // Carroñeros cercanos (puntos rojos).
      ctx.fillStyle = '#ff4a2e'
      for (const sc of scavengers) {
        if (!sc.active || inside) continue
        ctx.beginPath()
        ctx.arc(toX(sc.x), toY(sc.z), r * 0.55, 0, Math.PI * 2)
        ctx.fill()
      }
      // Cono de la cámara y flecha del robot.
      const ax = toX(px)
      const ay = toY(pz)
      const fx = -Math.sin(cameraRig.yaw)
      const fz = -Math.cos(cameraRig.yaw)
      const cone = r * (big ? 6 : 4.5)
      const ang = Math.atan2(fz, fx)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.arc(ax, ay, cone, ang - 0.6, ang + 0.6)
      ctx.closePath()
      ctx.fill()
      const h = player.heading
      ctx.save()
      ctx.translate(ax, ay)
      ctx.rotate(Math.atan2(Math.cos(h), Math.sin(h)))
      ctx.fillStyle = '#3ad0ff'
      ctx.strokeStyle = '#0b1a24'
      ctx.lineWidth = r * 0.3
      ctx.beginPath()
      ctx.moveTo(r * 1.5, 0)
      ctx.lineTo(-r, r)
      ctx.lineTo(-r * 0.4, 0)
      ctx.lineTo(-r, -r)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      // Norte.
      ctx.font = `bold ${r * 1.8}px system-ui`
      ctx.fillStyle = '#fff'
      ctx.fillText('N', S / 2, r * 1.6)
      if (inside) {
        ctx.fillStyle = 'rgba(10,14,24,0.6)'
        ctx.fillRect(0, S * 0.4, S, S * 0.2)
        ctx.fillStyle = '#cfe0ff'
        ctx.fillText('En la cueva', S / 2, S / 2)
      }
    }
    draw()
    const id = window.setInterval(draw, big ? 200 : 120)
    return () => window.clearInterval(id)
  }, [big])

  return (
    <canvas
      ref={ref}
      className={big ? 'map-big' : 'minimap'}
      onPointerDown={(e) => {
        e.stopPropagation()
        onClick()
      }}
    />
  )
}
