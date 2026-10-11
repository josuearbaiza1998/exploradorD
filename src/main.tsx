import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Solo en desarrollo: acceso desde la consola para depurar (window.__game).
if (import.meta.env.DEV) {
  void Promise.all([
    import('./store/gameStore'),
    import('./systems/player'),
    import('./systems/interaction/interactables'),
    import('./systems/cameraRig'),
    import('./systems/skyEvents'),
  ]).then(([store, p, inter, cam, sky]) => {
    Object.assign(window, {
      __game: { getGame: store.getGame, setState: store.useGameStore.setState, player: p.player, teleport: p.teleportPlayer, salvage: inter.SALVAGE_WORLD, camera: cam.cameraRig, sky: sky.skyEvents },
    })
  })
}

// Service worker (solo en producción): necesario para instalar en la pantalla de inicio.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
