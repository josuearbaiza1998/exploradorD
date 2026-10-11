import { useEffect, useRef, type PointerEvent } from 'react'
import { player } from '@/systems/player'
import { input } from '@/systems/input'

const RADIUS = 56
const DEADZONE = 0.12

/**
 * Joystick flotante (estilo Minecraft Bedrock móvil): aparece donde tocas
 * dentro de la mitad izquierda. Manipula el DOM por refs => cero re-renders.
 */
export function VirtualJoystick() {
  const zone = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0 })

  // Anillo de sprint: se llena con el stick al máximo y brilla al activarse.
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const el = base.current
      if (!el) return
      el.style.setProperty('--sprint', String(player.sprintCharge))
      el.classList.toggle('sprinting', player.sprinting)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const setVisual = (show: boolean, bx = 0, by = 0, kx = 0, ky = 0) => {
    if (!base.current || !knob.current) return
    base.current.style.opacity = show ? '1' : '0.35'
    if (show) {
      base.current.style.left = `${bx}px`
      base.current.style.top = `${by}px`
    } else {
      base.current.style.left = ''
      base.current.style.top = ''
    }
    knob.current.style.transform = `translate(${kx}px, ${ky}px)`
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null || !zone.current) return
    pointerId.current = e.pointerId
    zone.current.setPointerCapture(e.pointerId)
    const rect = zone.current.getBoundingClientRect()
    origin.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    input.joystick.active = true
    setVisual(true, origin.current.x, origin.current.y)
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current || !zone.current) return
    const rect = zone.current.getBoundingClientRect()
    let dx = e.clientX - rect.left - origin.current.x
    let dy = e.clientY - rect.top - origin.current.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    const mag = Math.min(len / RADIUS, 1)
    const scaled = mag < DEADZONE ? 0 : (mag - DEADZONE) / (1 - DEADZONE)
    // Dirección unitaria (dx/dy ya están recortados al radio: dividir por su propia longitud).
    const clampedLen = Math.hypot(dx, dy)
    const nx = clampedLen > 0 ? dx / clampedLen : 0
    const ny = clampedLen > 0 ? dy / clampedLen : 0
    input.joystick.x = nx * scaled
    input.joystick.y = -ny * scaled // pantalla hacia arriba = adelante
    setVisual(true, origin.current.x, origin.current.y, dx, dy)
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    input.joystick.active = false
    input.joystick.x = 0
    input.joystick.y = 0
    setVisual(false)
  }

  return (
    <div
      ref={zone}
      className="joystick-zone"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div ref={base} className="joystick-base">
        <div ref={knob} className="joystick-knob" />
      </div>
    </div>
  )
}
