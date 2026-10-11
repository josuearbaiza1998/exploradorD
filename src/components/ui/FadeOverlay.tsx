import { useUiStore } from '@/store/uiStore'

/** Fundido a negro corto (entrar/salir de la cueva). */
export function FadeOverlay() {
  const key = useUiStore((s) => s.fadeKey)
  if (!key) return null
  return <div key={key} className="fade-overlay" />
}
