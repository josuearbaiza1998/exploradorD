import { useEffect, useState } from 'react'

/** Re-render cada `ms` (para datos que viven fuera de React, como la hora). */
export function useTicker(ms: number) {
  const [, set] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => set((n) => n + 1), ms)
    return () => window.clearInterval(id)
  }, [ms])
}
