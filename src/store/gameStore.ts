import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createThrottledStorage } from './throttledStorage'
import { createClockSlice, type ClockSlice } from './slices/clockSlice'
import { createInventorySlice, type InventorySlice } from './slices/inventorySlice'
import { createRobotSlice, type RobotSlice } from './slices/robotSlice'

export type GameState = ClockSlice & RobotSlice & InventorySlice

/**
 * Tienda global del juego (Zustand), dividida en slices:
 *  - clock: tiempo in-game (día/noche, recarga).
 *  - robot: batería, sensores, modo (activo/emergencia/regreso/recarga).
 *  - inventory: inventario y cajas caídas con sus coordenadas.
 *
 * Rendimiento: los sistemas por frame usan getState()/setState() (sin
 * re-render) y la UI se suscribe con selectores redondeados para
 * re-renderizar solo cuando cambia algo visible.
 *
 * Se guarda en localStorage: al recargar la página la caja sigue donde cayó.
 */
export const useGameStore = create<GameState>()(
  persist(
    (...a) => ({
      ...createClockSlice(...a),
      ...createRobotSlice(...a),
      ...createInventorySlice(...a),
    }),
    {
      name: 'exploradord-save',
      version: 1,
      storage: createJSONStorage(() => createThrottledStorage()),
      partialize: (s) => ({
        totalHours: s.totalHours,
        battery: s.battery,
        sensorDirt: s.sensorDirt,
        inventory: s.inventory,
        droppedBoxes: s.droppedBoxes,
        lastPosition: s.lastPosition,
      }),
      // Si se cerró la partida en mitad de una emergencia, al volver se arranca
      // en la nave con la batería mínima para no quedar bloqueado.
      merge: (persisted, current) => {
        const p = persisted as Partial<GameState>
        const merged = { ...current, ...p }
        if ((merged.battery ?? 100) <= 5) merged.battery = 25
        return merged
      },
    },
  ),
)

export const getGame = useGameStore.getState
