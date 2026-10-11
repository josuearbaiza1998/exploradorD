import { useRef, type PointerEvent } from 'react'
import { input } from '@/systems/input'

/**
 * Zona invisible del lado derecho: arrastrar el dedo gira la cámara.
 * Soporta multitáctil junto al joystick (cada zona sigue su propio pointerId).
 */
export function LookPad() {
  const pointerId = useRef<number | null>(null)
  const last = useRef({ x: 0, y: 0 })

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return
    pointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return
    input.lookDelta.x += e.clientX - last.current.x
    input.lookDelta.y += e.clientY - last.current.y
    last.current = { x: e.clientX, y: e.clientY }
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerId === pointerId.current) pointerId.current = null
  }

  return (
    <div
      className="look-pad"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  )
}
