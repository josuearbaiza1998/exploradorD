import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createThrottledStorage } from './throttledStorage'
import { createClockSlice, type ClockSlice } from './slices/clockSlice'
import { createInventorySlice, type InventorySlice } from './slices/inventorySlice'
import { createRobotSlice, type RobotSlice } from './slices/robotSlice'
import { createWorldSlice, type WorldSlice } from './slices/worldSlice'
import { createWeatherSlice, type WeatherSlice } from './slices/weatherSlice'
import { createStructuresSlice, type StructuresSlice } from './slices/structuresSlice'

export type GameState = ClockSlice & RobotSlice & InventorySlice & WorldSlice & WeatherSlice & StructuresSlice

/**
 * Tienda global del juego (Zustand), dividida en slices:
 *  - clock: tiempo in-game (día/noche, recarga).
 *  - robot: batería, sensores, modo (activo/emergencia/regreso/recarga).
 *  - inventory: inventario y cajas caídas con sus coordenadas.
 *  - weather: estado del clima y cuándo cambia.
 *  - structures: paneles solares, bancos de baterías y refugios construidos.
 *  - world: recursos recolectados (y cuándo rebrotan) y puntos de chatarra.
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
      ...createWorldSlice(...a),
      ...createWeatherSlice(...a),
      ...createStructuresSlice(...a),
    }),
    {
      name: 'exploradord-save',
      version: 2,
      // v1 → v2: se añaden recursos recolectados; el resto del guardado es compatible.
      migrate: (persisted) => persisted as GameState,
      storage: createJSONStorage(() => createThrottledStorage()),
      partialize: (s) => ({
        totalHours: s.totalHours,
        battery: s.battery,
        sensorDirt: s.sensorDirt,
        inventory: s.inventory,
        droppedBoxes: s.droppedBoxes,
        lastPosition: s.lastPosition,
        harvested: s.harvested,
        salvageUses: s.salvageUses,
        weather: s.weather,
        previousWeather: s.previousWeather,
        weatherSince: s.weatherSince,
        weatherUntil: s.weatherUntil,
        structures: s.structures,
        bankCharge: s.bankCharge,
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
