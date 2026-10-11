import { useEffect, useRef } from 'react'
import { CRASH_SITE } from '@/config/world'
import { POIS } from '@/config/pois'
import { cave, CAVE_OUTSIDE } from '@/config/cave'
import { useGameStore } from '@/store/gameStore'
import { cameraRig } from '@/systems/cameraRig'
import { player } from '@/systems/player'

/** Medio campo de la brújula (radianes visibles a cada lado). */
const HALF_FOV = Math.PI / 2

const CARDINALS: [string, number][] = [
  ['N', 0],
  ['NE', Math.PI / 4],
  ['E', Math.PI / 2],
  ['SE', (3 * Math.PI) / 4],
  ['S', Math.PI],
  ['SO', (-3 * Math.PI) / 4],
  ['O', -Math.PI / 2],
  ['NO', -Math.PI / 4],
]

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
/** Rumbo de una dirección del mundo (0 = norte = -Z, sentido horario). */
const bearing = (dx: number, dz: number) => Math.atan2(dx, -dz)

/**
 * Brújula en la parte superior: puntos cardinales y marcadores de la nave y
 * de las mochilas caídas, con distancia. Se actualiza sin re-render de React.
 */
export function Compass() {
  const strip = useRef<HTMLDivElement>(null)
  const boxes = useGameStore((s) => s.droppedBoxes)
  const discovered = useGameStore((s) => s.discovered)
  const looted = useGameStore((s) => s.looted)
  const finds = useGameStore((s) => s.finds)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const el = strip.current
      if (!el) return
      // La cámara mira hacia -forward del yaw: forward = (-sin, -cos).
      const heading = bearing(-Math.sin(cameraRig.yaw), -Math.cos(cameraRig.yaw))
      // Dentro de la cueva las distancias se miden desde su entrada.
      const px = cave.active ? CAVE_OUTSIDE.x : player.position.x
      const pz = cave.active ? CAVE_OUTSIDE.z : player.position.z
      el.querySelectorAll<HTMLElement>('[data-bearing]').forEach((node) => {
        let b = Number(node.dataset.bearing)
        if (node.dataset.x) {
          const dx = Number(node.dataset.x) - px
          const dz = Number(node.dataset.z) - pz
          b = bearing(dx, dz)
          const dist = node.querySelector<HTMLElement>('.cmp-dist')
          if (dist) dist.textContent = `${Math.round(Math.hypot(dx, dz))} m`
        }
        const rel = wrap(b - heading)
        const visible = Math.abs(rel) < HALF_FOV
        // Los marcadores fuera de vista se quedan pegados al borde para indicar hacia dónde girar.
        const clamped = node.dataset.x ? Math.max(-HALF_FOV, Math.min(HALF_FOV, rel)) : rel
        node.style.left = `${50 + (clamped / HALF_FOV) * 50}%`
        node.style.opacity = visible ? '1' : node.dataset.x ? '0.55' : '0'
      })
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const hidden = useGameStore((s) => s.mode !== 'active' && s.mode !== 'recharging')
  if (hidden) return null
  return (
    <div className="hud-compass" ref={strip}>
      <div className="cmp-center" />
      {CARDINALS.map(([label, b]) => (
        <span key={label} className={`cmp-card ${label.length === 1 ? 'major' : ''}`} data-bearing={b}>
          {label}
        </span>
      ))}
      <span className="cmp-marker ship" data-bearing="0" data-x={CRASH_SITE.x} data-z={CRASH_SITE.z}>
        <span className="cmp-icon">🚀</span>
        <span className="cmp-dist" />
      </span>
      {POIS.filter((p) => discovered[p.id]).map((p) => (
        <span key={p.id} className={`cmp-marker poi ${looted[p.id] ? 'done' : ''}`} data-bearing="0" data-x={p.x} data-z={p.z}>
          <span className="cmp-icon">{p.icon}</span>
          <span className="cmp-dist" />
        </span>
      ))}
      {finds
        .filter((f) => f.kind === 'buried')
        .map((f) => (
          <span key={f.id} className="cmp-marker poi" data-bearing="0" data-x={f.x} data-z={f.z}>
            <span className="cmp-icon">⛏️</span>
            <span className="cmp-dist" />
          </span>
        ))}
      {boxes.map((b) => (
        <span key={b.id} className="cmp-marker box" data-bearing="0" data-x={b.position[0]} data-z={b.position[2]}>
          <span className="cmp-icon">🎒</span>
          <span className="cmp-dist" />
        </span>
      ))}
    </div>
  )
}

