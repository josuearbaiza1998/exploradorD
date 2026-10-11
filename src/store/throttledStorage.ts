import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage con escritura diferida: el reloj actualiza la tienda cada
 * frame y no queremos serializar a disco 60 veces por segundo.
 * Guarda como máximo cada `intervalMs` y siempre al ocultar/cerrar la página.
 */
let frozen = false

/** Deja de guardar (para reiniciar la partida sin que se vuelva a escribir antes de recargar). */
export function freezeStorage() {
  frozen = true
}

export function createThrottledStorage(intervalMs = 2000): StateStorage {
  const pending = new Map<string, string>()
  let timer: number | null = null

  const safeStorage = (): Storage | null => {
    try {
      return window.localStorage
    } catch {
      return null
    }
  }

  const flush = () => {
    timer = null
    const storage = safeStorage()
    if (!storage) return
    for (const [key, value] of pending) {
      try {
        storage.setItem(key, value)
      } catch {
        // Almacenamiento lleno o bloqueado: la partida sigue sin guardar.
      }
    }
    pending.clear()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  }

  return {
    getItem: (key) => {
      try {
        return pending.get(key) ?? safeStorage()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    setItem: (key, value) => {
      if (frozen) return
      pending.set(key, value)
      if (timer === null) timer = window.setTimeout(flush, intervalMs)
    },
    removeItem: (key) => {
      pending.delete(key)
      try {
        safeStorage()?.removeItem(key)
      } catch {
        /* ignorar */
      }
    },
  }
}
