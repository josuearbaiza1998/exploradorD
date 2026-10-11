import { useEffect } from 'react'
import { input } from '@/systems/input'

const MAP: Record<string, keyof typeof input.keys> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
}

/** Teclado para probar en escritorio: WASD/flechas, Shift correr, Espacio saltar. */
export function useKeyboardInput() {
  useEffect(() => {
    const set = (e: KeyboardEvent, value: boolean) => {
      const key = MAP[e.code]
      if (key) input.keys[key] = value
      if (e.code === 'Space' && value && !e.repeat) input.jumpQueued = true
    }
    const down = (e: KeyboardEvent) => set(e, true)
    const up = (e: KeyboardEvent) => set(e, false)
    const blur = () => Object.keys(input.keys).forEach((k) => (input.keys[k as keyof typeof input.keys] = false))
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])
}
