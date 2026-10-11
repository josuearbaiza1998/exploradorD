/**
 * Ajustes de supervivencia del robot. Las tasas van en "por hora in-game"
 * para que todo escale igual al acelerar el tiempo (1 h in-game = 20 s reales).
 */
export const ROBOT = {
  batteryMax: 100,
  /** Al llegar aquí entra en modo de emergencia. */
  batteryCritical: 5,
  /** Por debajo de esto empiezan los avisos visuales. */
  batteryLow: 20,

  drain: {
    /** Consumo en reposo (%/h). */
    idle: 1,
    /** Consumo extra a velocidad máxima (%/h). */
    moving: 5,
    /** Coste fijo por salto (%). */
    jump: 0.3,
    /** Multiplicador cuando la temperatura baja de 0 °C (frío nocturno). */
    coldMultiplier: 1.6,
  },

  /** Panel solar integrado: carga pasiva a pleno sol (%/h). */
  solarCharge: 1.5,

  /** Horas in-game que tarda la recarga completa en la nave. */
  rechargeHours: 2,
  /** Aceleración del tiempo mientras el robot está en reposo cargando. */
  rechargeTimeScale: 8,

  sensors: {
    /** Suciedad acumulada por hora caminando con viento fuerte (0..1). */
    dirtPerHour: 0.05,
  },

  /** Distancia para poder recoger la caja de inventario. */
  pickupRadius: 2.6,
}
