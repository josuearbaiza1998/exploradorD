import { CHUNK_SIZE, ISLAND } from '@/config/world'
import { PROP_LAYERS } from '@/config/propLayers'
import { HARVEST } from '@/config/harvest'
import { ROD_ATTRACT, ROD_CHARGE, ROD_PROTECT, STRUCTURES } from '@/config/structures'
import { getGame } from '@/store/gameStore'
import { getLayerChunk } from '@/systems/propPlacement'
import { propKey } from '@/systems/interaction/interactables'
import { player } from '@/systems/player'
import { environment } from '@/systems/environmentState'
import { getHeight } from '@/utils/terrain/heightfield'

/** Capas que arden si les cae un rayo cerca. */
const FLAMMABLE = PROP_LAYERS.filter((l) => l.id === 'dryShrubs' || l.id === 'smallTrees' || l.id === 'palms')
const ROD_TOP = 5.4
let fulguriteId = 0

export type StrikeResult = { x: number; y: number; z: number; hit: 'rod' | 'robot' | 'ground' }

/**
 * Decide dónde cae un rayo que iba a caer en (gx, gz) y aplica sus efectos:
 *  - Un pararrayos cercano lo atrae y carga los bancos de baterías.
 *  - En lo alto y sin protección, puede alcanzar al robot.
 *  - En tierra deja fulgurita y quema la vegetación seca de alrededor.
 */
export function resolveStrike(gx: number, gz: number, close: boolean): StrikeResult {
  const game = getGame()
  const px = player.position.x
  const pz = player.position.z
  const rods = game.structures.filter((s) => s.type === 'lightningRod')
  const rod = rods.find((r) => Math.hypot(r.x - gx, r.z - gz) < ROD_ATTRACT)
  if (rod && Math.random() < 0.7) {
    chargeFromRod(rod.x, rod.z)
    return { x: rod.x, y: getHeight(rod.x, rod.z) + ROD_TOP, z: rod.z, hit: 'rod' }
  }
  const protectedByRod = rods.some((r) => Math.hypot(r.x - px, r.z - pz) < ROD_PROTECT)
  const exposed = game.mode === 'active' && !environment.sheltered && !environment.inCave && player.position.y > 22 && !protectedByRod
  if (exposed && close && Math.random() < 0.35) {
    game.addBattery(-12)
    game.notify('⚡ ¡Te alcanzó un rayo en lo alto! En tormenta, mejor bajar de las cumbres.', 'warn')
    return { x: px, y: player.position.y + 2, z: pz, hit: 'robot' }
  }
  const gy = getHeight(gx, gz)
  if (gy > ISLAND.seaLevel + 0.3 && Math.hypot(gx - px, gz - pz) < 140) {
    game.addFinds([{ id: `fulg-${Date.now()}-${fulguriteId++}`, kind: 'fulgurite', x: gx, z: gz, until: game.totalHours + 48 }])
    if (burnAround(gx, gz, 3.5) && Math.hypot(gx - px, gz - pz) < 60) game.notify('🔥 Un rayo quemó la vegetación cercana y dejó fulgurita', 'info')
  }
  return { x: gx, y: Math.max(gy, ISLAND.seaLevel), z: gz, hit: 'ground' }
}

/** Arbustos y árboles alrededor del impacto se queman (rebrotan con el tiempo). */
function burnAround(x: number, z: number, r: number): boolean {
  const game = getGame()
  let burned = false
  const cx0 = Math.floor((x - r) / CHUNK_SIZE)
  const cx1 = Math.floor((x + r) / CHUNK_SIZE)
  const cz0 = Math.floor((z - r) / CHUNK_SIZE)
  const cz1 = Math.floor((z + r) / CHUNK_SIZE)
  for (const layer of FLAMMABLE) {
    const regrow = HARVEST[layer.harvest!]?.regrowHours ?? 48
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = getLayerChunk(layer, cx, cz)
        for (let i = 0; i < list.length; i++) {
          const e = list[i].elements
          if ((e[12] - x) ** 2 + (e[14] - z) ** 2 > r * r) continue
          const key = propKey(layer.id, cx, cz, i)
          if (key in game.harvested) continue
          game.markHarvested(key, game.totalHours + regrow)
          burned = true
        }
      }
    }
  }
  return burned
}

/** Un rayo capturado: carga los bancos de baterías cercanos o, si no hay, al robot. */
function chargeFromRod(x: number, z: number) {
  const game = getGame()
  const cap = STRUCTURES.batteryBank.bankCapacity ?? 60
  const reach = STRUCTURES.lightningRod.chargeRadius ?? 10
  const banks = game.structures.filter((s) => s.type === 'batteryBank' && Math.hypot(s.x - x, s.z - z) < reach)
  for (const b of banks) game.setBankCharge(b.id, Math.min(cap, (game.bankCharge[b.id] ?? 0) + ROD_CHARGE))
  const near = Math.hypot(player.position.x - x, player.position.z - z) < reach
  if (banks.length) game.notify(`⚡ El pararrayos capturó un rayo: +${ROD_CHARGE} % en ${banks.length > 1 ? 'los bancos' : 'el banco'}`, 'gain')
  else if (near) {
    game.addBattery(ROD_CHARGE * 0.6)
    game.notify('⚡ El pararrayos capturó un rayo y te dio energía', 'gain')
  }
}
