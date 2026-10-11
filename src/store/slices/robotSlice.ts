import type { StateCreator } from 'zustand'
import { ROBOT } from '@/config/robot'
import { clamp } from '@/utils/math'
import type { GameState } from '../gameStore'

/**
 * Modos del robot:
 *  - active: control normal.
 *  - emergency: batería crítica; suelta la caja y se detiene un instante.
 *  - returning: piloto automático hacia la nave (y fundido a negro).
 *  - recharging: en la plataforma de la nave, cargando durante unas horas in-game.
 */
export type RobotMode = 'active' | 'emergency' | 'returning' | 'recharging'

export type RobotSlice = {
  battery: number
  /** Suciedad de sensores 0 (limpio) .. 1 (casi ciego). */
  sensorDirt: number
  mode: RobotMode
  /** Segundos reales desde que empezó el modo actual (para las transiciones). */
  modeTime: number
  recharge: { startHours: number; startBattery: number } | null
  /** Última posición conocida (para guardar la partida). */
  lastPosition: [number, number, number] | null

  setBattery: (value: number) => void
  addBattery: (delta: number) => void
  addSensorDirt: (delta: number) => void
  cleanSensors: (amount?: number) => void
  setMode: (mode: RobotMode) => void
  tickModeTime: (realDelta: number) => void
  startRecharge: () => void
  finishRecharge: () => void
  savePosition: (p: [number, number, number]) => void
}

export const createRobotSlice: StateCreator<GameState, [], [], RobotSlice> = (set, get) => ({
  battery: ROBOT.batteryMax,
  sensorDirt: 0,
  mode: 'active',
  modeTime: 0,
  recharge: null,
  lastPosition: null,

  setBattery: (value) => set({ battery: clamp(value, 0, ROBOT.batteryMax) }),
  addBattery: (delta) => set((s) => ({ battery: clamp(s.battery + delta, 0, ROBOT.batteryMax) })),
  addSensorDirt: (delta) => set((s) => ({ sensorDirt: clamp(s.sensorDirt + delta, 0, 1) })),
  cleanSensors: (amount = 1) => set((s) => ({ sensorDirt: clamp(s.sensorDirt - amount, 0, 1) })),
  setMode: (mode) => set({ mode, modeTime: 0 }),
  tickModeTime: (realDelta) => set((s) => ({ modeTime: s.modeTime + realDelta })),
  startRecharge: () =>
    set({
      mode: 'recharging',
      modeTime: 0,
      recharge: { startHours: get().totalHours, startBattery: get().battery },
      timeBoost: ROBOT.rechargeTimeScale,
    }),
  finishRecharge: () => set({ mode: 'active', modeTime: 0, recharge: null, battery: ROBOT.batteryMax, timeBoost: 1 }),
  savePosition: (lastPosition) => set({ lastPosition }),
})
