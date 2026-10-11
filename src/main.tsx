import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Solo en desarrollo: acceso desde la consola para depurar (window.__game).
if (import.meta.env.DEV) {
  void Promise.all([import('./store/gameStore'), import('./systems/player')]).then(([store, p]) => {
    Object.assign(window, { __game: { getGame: store.getGame, player: p.player, teleport: p.teleportPlayer } })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
