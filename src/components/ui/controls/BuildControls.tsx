import { useEffect, useState } from 'react'
import { STRUCTURES } from '@/config/structures'
import { getGame, useGameStore } from '@/store/gameStore'
import { buildPreview } from '@/systems/buildPreview'

/**
 * Controles del modo construcción: se camina con el joystick para elegir el
 * sitio (la vista previa va delante del robot) y se confirma aquí.
 */
export function BuildControls() {
  const build = useGameStore((s) => s.build)
  const [check, setCheck] = useState(buildPreview.check)

  useEffect(() => {
    if (!build) return
    const id = window.setInterval(() => setCheck(buildPreview.check ? { ...buildPreview.check } : null), 150)
    return () => window.clearInterval(id)
  }, [build])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!getGame().build) return
      if (e.code === 'KeyR') getGame().rotateBuild()
      if (e.code === 'Escape') getGame().cancelBuild()
      if (e.code === 'Enter') place()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!build) return null
  const def = STRUCTURES[build.type]
  return (
    <div className="build-controls">
      <span className={`build-caption ${check?.ok ? '' : 'bad'}`}>
        {def.icon} {def.name} · {check?.ok ? 'Toca ✓ para colocar' : (check?.reason ?? '…')}
      </span>
      <div className="build-buttons">
        <button className="action-btn" aria-label="Cancelar" onClick={() => getGame().cancelBuild()}>
          ✕
        </button>
        <button className="action-btn" aria-label="Girar" onClick={() => getGame().rotateBuild()}>
          ⟳
        </button>
        <button className="action-btn ok" aria-label="Colocar" disabled={!check?.ok} onClick={place}>
          ✓
        </button>
      </div>
    </div>
  )
}

function place() {
  const check = buildPreview.check
  const game = getGame()
  if (!game.build || !check?.ok) return
  const name = STRUCTURES[game.build.type].name
  if (game.placeStructure(check.x, check.z)) game.notify(`${name} construido`, 'info')
}
