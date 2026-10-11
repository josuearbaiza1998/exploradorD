/**
 * Estado de entrada unificado (táctil + teclado). Los controles en pantalla
 * y el teclado ESCRIBEN aquí; el controlador del robot y la cámara LEEN.
 * Así la lógica de juego no sabe ni le importa de dónde vienen las órdenes.
 */
export const input = {
  /** Joystick virtual: x = derecha, y = adelante, magnitud 0..1. */
  joystick: { x: 0, y: 0, active: false },
  /** Teclas de movimiento (escritorio, para pruebas). */
  keys: { forward: false, back: false, left: false, right: false, run: false },
  /** Desplazamiento acumulado de la vista en píxeles (se consume cada frame). */
  lookDelta: { x: 0, y: 0 },
  /** Pulsación de salto pendiente (se consume al usarla). */
  jumpQueued: false,
}

const out = { x: 0, y: 0 }

/** Vector de movimiento final (joystick tiene prioridad sobre teclado). */
export function getMoveVector() {
  if (input.joystick.active) {
    out.x = input.joystick.x
    out.y = input.joystick.y
    return out
  }
  const k = input.keys
  let x = (k.right ? 1 : 0) - (k.left ? 1 : 0)
  let y = (k.forward ? 1 : 0) - (k.back ? 1 : 0)
  const len = Math.hypot(x, y)
  if (len > 0) {
    const mag = k.run ? 1 : 0.6
    x = (x / len) * mag
    y = (y / len) * mag
  }
  out.x = x
  out.y = y
  return out
}

export function consumeLook() {
  const d = { x: input.lookDelta.x, y: input.lookDelta.y }
  input.lookDelta.x = 0
  input.lookDelta.y = 0
  return d
}

export function consumeJump() {
  const j = input.jumpQueued
  input.jumpQueued = false
  return j
}
