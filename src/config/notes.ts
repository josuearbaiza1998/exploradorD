import type { Vec2 } from './world'

/**
 * Registros sueltos por el mapa: tabletas de datos de la expedición anterior
 * (la sonda D-2 y su nave). Cuentan la historia a quien explora.
 */
export type NoteDef = Vec2 & {
  id: string
  title: string
  text: string
  /** Está dentro de la cueva. */
  cave?: true
  /** Soporte: tableta (por defecto), disquete o tuerca grabada. */
  kind?: 'pad' | 'disk' | 'nut'
}

export const NOTES: NoteDef[] = [
  {
    id: 'n1',
    x: 18,
    z: 22,
    title: 'Registro 1 · Aterrizaje',
    text: 'Sonda D-2, día 1. El escudo térmico falló en la entrada. La nave nodriza siguió en órbita. Yo tengo que encontrar una forma de pedir ayuda.',
  },
  {
    id: 'n2',
    x: -32,
    z: -48,
    title: 'Registro 2 · El calor',
    text: 'Al mediodía los circuitos se recalientan si no busco sombra. De noche el frío se come la batería. Aprendí a moverme al amanecer y al atardecer.',
  },
  {
    id: 'n3',
    x: -118,
    z: -12,
    title: 'Registro 3 · Agua',
    text: 'Encontré un oasis. Tras la lluvia brotan flores rosas; su fibra limpia los sensores mejor que cualquier paño.',
  },
  {
    id: 'n4',
    x: 106,
    z: -30,
    title: 'Registro 4 · Los antiguos',
    text: 'Hay columnas talladas hacia el este. Alguien vivió aquí antes que nosotros. En su altar late un cristal con energía pura.',
  },
  {
    id: 'n5',
    x: -96,
    z: -100,
    title: 'Registro 5 · La cueva',
    text: 'La cueva del suroeste baja más de lo que parece. Al fondo brilla algo azul. Llevé la bomba de refrigerante hasta allí para que no se congelara.',
  },
  {
    id: 'n6',
    x: 84,
    z: -135,
    title: 'Registro 6 · La antena',
    text: 'La tormenta arrastró la antena de largo alcance hasta el islote frente al pico. Para llegar al pico hay que trepar la pared de roca, y desde allí cruzar el agua. Yo no tenía con qué.',
  },
  {
    id: 'n8',
    x: 700 - 5,
    z: 700 - 68,
    cave: true,
    title: 'Registro 8 · Cristales',
    text: 'Los cristales de la cueva guardan la energía de las tormentas. Con un martillo se arrancan fragmentos, y con el tiempo vuelven a crecer. Mezclados con la arena que funde un rayo dan una buena celda.',
  },
  {
    id: 'n9',
    x: 161,
    z: -65,
    title: 'Registro 9 · La otra isla',
    text: 'Desde esta playa se ve otra isla al este. De noche parpadea una luz en su cima, siempre al mismo ritmo: no es un fuego, es una baliza. Alguien la encendió. Tengo que encontrar la forma de cruzar.',
  },
  {
    id: 'n10',
    kind: 'disk',
    x: 104,
    z: -74,
    title: 'Disquete · Diagnóstico de la nave',
    text: 'Daño estructural: 87 %. El chasis se dobló en el impacto y no aguantará otro despegue. Casco: estanco. Motor: recuperable. Recomendación del sistema: adaptar como embarcación.',
  },
  {
    id: 'n11',
    kind: 'nut',
    x: -150,
    z: 2,
    title: 'Tuerca grabada · Mareas',
    text: 'Alguien grabó esto en una tuerca con la punta de un clavo: "Al amanecer el mar está en calma. Con viento fuerte las olas rompen alto en la orilla. La corriente del este empuja hacia la isla de la baliza."',
  },
  {
    id: 'n12',
    kind: 'disk',
    x: 60,
    z: 170,
    title: 'Disquete · Bajo el agua',
    text: 'Si se sellan las juntas, las celdas del robot aguantan bajo el agua. Frente a esta playa, en el fondo, hay restos de un cargamento hundido. Bajar gasta batería: hay que volver a la orilla a tiempo.',
  },
  {
    id: 'n13',
    kind: 'disk',
    x: 152,
    z: -57,
    title: 'Disquete · Boyas de deriva',
    text: 'Solté tres boyas para medir las corrientes: una al norte del islote, otra frente a la playa sur y otra al oeste. Si alguien lee sus datos desde el agua, podrá trazar la ruta hacia la isla de la baliza.',
  },
  {
    id: 'n7',
    x: -55,
    z: 128,
    title: 'Registro 7 · Último',
    text: 'Batería al 3 %. Dejo mi chip de navegación en el contenedor. Si otra sonda lo encuentra: la nave que viste caer no volverá a volar, pero su casco flota. Con un motor y una hélice, el mar es el camino.',
  },
]
