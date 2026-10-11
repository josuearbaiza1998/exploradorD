import { CanvasTexture } from 'three'

/** Degradado radial (centro opaco → bordes transparentes), sin archivos. */
export function radialTexture(stretch = false) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  const g = stretch ? ctx.createLinearGradient(0, 0, 0, 64) : ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(stretch ? 0.3 : 0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

