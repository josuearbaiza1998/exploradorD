/**
 * Eventos raros del cielo nocturno (se deciden una vez por noche):
 *  - Lluvia de estrellas en noches despejadas; algunas bolas de fuego caen
 *    en la isla y dejan meteoritos.
 *  - Aurora tras una tormenta eléctrica que termina de noche.
 */
export const skyEvents = {
  /** Noche (ver `nightId`) con lluvia de estrellas, o -1. */
  meteorNight: -1,
  /** Noche con aurora, o -1. */
  auroraNight: -1,
  /** Última noche para la que ya se tiró el dado. */
  decided: -1,
  /** Segundos hasta la próxima bola de fuego posible. */
  nextFire: 25,
  /** Bolas de fuego que ya cayeron esta noche. */
  fireballs: 0,
  /** Intensidad visible actual 0..1 (la escriben los componentes). */
  meteors: 0,
  aurora: 0,
}

/** Probabilidad de lluvia de estrellas en una noche despejada. */
export const METEOR_CHANCE = 0.3
export const MAX_FIREBALLS = 3

/** Número de noche: cambia a las 12:00, así una noche no se parte a medianoche. */
export const nightId = (totalHours: number) => Math.floor((totalHours - 12) / 24)
