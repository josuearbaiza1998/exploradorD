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
  ]).then(([store, p, inter, cam]) => {
    Object.assign(window, {
      __game: { getGame: store.getGame, player: p.player, teleport: p.teleportPlayer, salvage: inter.SALVAGE_WORLD, camera: cam.cameraRig },
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
