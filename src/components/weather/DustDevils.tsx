import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, PointsMaterial, type Points } from 'three'
import { getGame } from '@/store/gameStore'
import { hourOfDay } from '@/store/slices/clockSlice'
import { ISLAND, OASIS } from '@/config/world'
import { upgradeEffects } from '@/config/upgrades'
import { player } from '@/systems/player'
import { wind } from '@/systems/wind'
import { getHeight } from '@/utils/terrain/heightfield'

const DEVILS = 2
const PER = 120
const HEIGHT = 12
/** Radio (m) en el que el remolino ensucia los sensores. */
const HIT_RADIUS = 3

function puff() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  g.addColorStop(0, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  return new CanvasTexture(c)
}

/**
 * Remolinos de polvo: en días calurosos (despejado o ventoso) cruzan el
 * desierto con el viento. Si el robot se mete dentro, se le ensucian los sensores.
 */
export function DustDevils() {
  const ref = useRef<Points>(null)
  const { geometry, devils } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(DEVILS * PER * 3), 3))
    return { geometry: g, devils: Array.from({ length: DEVILS }, () => ({ x: 0, z: 0, life: 0, next: 10 + Math.random() * 30, warned: false })) }
  }, [])
  const material = useMemo(
    () => new PointsMaterial({ color: '#c49660', size: 2.4, map: puff(), transparent: true, depthWrite: false, opacity: 0.95 }),
    [],
  )
  useFrame(({ clock }, delta) => {
    const pts = ref.current
    if (!pts) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const game = getGame()
    const hour = hourOfDay(game.totalHours)
    const weather = game.weather
    const allowed = hour > 10 && hour < 18 && (weather === 'clear' || weather === 'windy')
    const maxActive = weather === 'windy' ? 2 : 1
    const arr = (geometry.getAttribute('position') as BufferAttribute).array as Float32Array
    let active = 0
    for (let d = 0; d < DEVILS; d++) {
      const dv = devils[d]
      if (dv.life > 0) {
        dv.life -= dt
        active++
        // Avanza con el viento y serpentea un poco.
        const sp = 2 + wind.strength * 4
        dv.x += (wind.dirX * sp + Math.sin(t * 0.7 + d) * 1.2) * dt
        dv.z += (wind.dirZ * sp + Math.cos(t * 0.5 + d) * 1.2) * dt
        const inOasis = Math.hypot(dv.x - OASIS.x, dv.z - OASIS.z) < OASIS.radius
        const inSea = ISLAND.enabled && getHeight(dv.x, dv.z) < ISLAND.seaLevel + 0.3
        if (inOasis || inSea || Math.hypot(dv.x - player.position.x, dv.z - player.position.z) > 90) dv.life = 0
        // ¿El robot está dentro?
        const dist = Math.hypot(dv.x - player.position.x, dv.z - player.position.z)
        if (dist < HIT_RADIUS && game.mode === 'active') {
          game.addSensorDirt(dt * 0.14 * upgradeEffects(game.upgrades).dirt)
          if (!dv.warned) {
            dv.warned = true
            game.notify('🌪️ ¡Remolino! Arena en los sensores', 'warn')
          }
        }
      } else if (allowed && active < maxActive && t > dv.next) {
        // Nace delante del robot, a media distancia y viento arriba.
        const a = Math.atan2(-wind.dirX, -wind.dirZ) + (Math.random() - 0.5) * 1.6
        const r = 30 + Math.random() * 20
        dv.x = player.position.x + Math.sin(a) * r
        dv.z = player.position.z + Math.cos(a) * r
        dv.life = 25 + Math.random() * 20
        dv.warned = false
        dv.next = t + 20 + Math.random() * 40
        active++
      }
      const alive = dv.life > 0
      const fade = alive ? Math.min(1, dv.life / 3) : 0
      const gy = alive ? getHeight(dv.x, dv.z) : -999
      for (let i = 0; i < PER; i++) {
        const k = (d * PER + i) * 3
        const f = i / PER
        const y = ((f + t * 0.35 * (1 + (i % 3) * 0.2)) % 1) * HEIGHT
        const rad = (0.5 + (y / HEIGHT) * 3.2) * fade
        const ang = t * 7 + i * 2.39 - y * 0.5
        arr[k] = dv.x + Math.cos(ang) * rad
        arr[k + 1] = alive ? gy + y : -999
        arr[k + 2] = dv.z + Math.sin(ang) * rad
      }
    }
    pts.visible = active > 0
    geometry.getAttribute('position').needsUpdate = true
  })
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
