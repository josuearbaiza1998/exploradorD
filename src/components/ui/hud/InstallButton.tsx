import { useEffect, useState } from 'react'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallPrompt | null = null
const subs = new Set<() => void>()
// Se captura lo antes posible: Chrome lo dispara una vez al cargar.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallPrompt
  subs.forEach((f) => f())
})

const isStandalone = () =>
  window.matchMedia('(display-mode: fullscreen)').matches ||
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

async function enterFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')
    }
  } catch {
    /* el navegador no lo permite (p. ej. Safari en iPhone) */
  }
}

/**
 * Añadir a la pantalla de inicio: en Android/Chrome abre el diálogo de
 * instalación; en iPhone explica los pasos (Safari no permite hacerlo por
 * código). Instalado, el juego se abre a pantalla completa sin barras.
 * Mientras tanto, el botón ⛶ pone pantalla completa en el navegador.
 */
export function InstallButton() {
  const [, force] = useState(0)
  const [help, setHelp] = useState(false)
  useEffect(() => {
    const f = () => force((n) => n + 1)
    subs.add(f)
    window.addEventListener('appinstalled', f)
    return () => {
      subs.delete(f)
      window.removeEventListener('appinstalled', f)
    }
  }, [])

  if (isStandalone()) return null
  const canFullscreen = !!document.documentElement.requestFullscreen

  return (
    <>
      {canFullscreen && (
        <button className="hud-btn" aria-label="Pantalla completa" onClick={enterFullscreen}>
          ⛶
        </button>
      )}
      <button
        className="hud-btn install"
        aria-label="Añadir a la pantalla de inicio"
        onClick={async () => {
          if (deferred) {
            await deferred.prompt()
            await deferred.userChoice
            deferred = null
            force((n) => n + 1)
          } else setHelp(true)
        }}
      >
        📲
      </button>
      {help && (
        <div className="inv-backdrop" onPointerDown={(e) => e.target === e.currentTarget && setHelp(false)}>
          <div className="install-help">
            <h3>Añadir a la pantalla de inicio</h3>
            {isIos() ? (
              <ol>
                <li>Abre esta página en <b>Safari</b>.</li>
                <li>Toca el botón <b>Compartir</b> (cuadro con flecha ⬆️).</li>
                <li>Elige <b>Añadir a pantalla de inicio</b>.</li>
                <li>Abre <b>Explorador D</b> desde el icono: se verá sin barras.</li>
              </ol>
            ) : (
              <ol>
                <li>Abre el menú del navegador (⋮ arriba a la derecha).</li>
                <li>Elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</li>
                <li>Abre <b>Explorador D</b> desde el icono: se verá a pantalla completa.</li>
              </ol>
            )}
            <button className="install-ok" onClick={() => setHelp(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
