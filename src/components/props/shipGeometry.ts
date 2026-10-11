import { ExtrudeGeometry, LatheGeometry, Shape, Vector2, type BufferGeometry } from 'three'

/**
 * Geometrías procedurales de la nave caza (lowpoly). Coordenadas locales de
 * la nave: +Z = morro, +Y = arriba. Se generan una vez y se comparten.
 */

/** Fuselaje: perfil girado alrededor del eje Z, achatado después. */
export function fuselageGeometry(): BufferGeometry {
  // (radio, z) de cola a morro.
  const profile: [number, number][] = [
    [0.01, -10.6],
    [1.7, -10.4],
    [2.2, -8.5],
    [2.6, -4],
    [2.6, 0.5],
    [2.2, 4],
    [1.4, 7.5],
    [0.5, 10],
    [0.01, 11],
  ]
  const g = new LatheGeometry(profile.map(([r, z]) => new Vector2(r, z)), 8)
  // Lathe gira alrededor de Y: tumbarlo para que el eje quede en Z.
  g.rotateX(Math.PI / 2)
  g.rotateZ(Math.PI / 8)
  g.scale(1, 0.72, 1)
  return g.toNonIndexed()
}

/**
 * Ala en flecha (planta trapezoidal) extruida. `broken` recorta la punta en
 * dientes de sierra; `side` = -1 la refleja (ala izquierda) sin invertir caras.
 */
export function wingGeometry(broken = false, side: 1 | -1 = 1): BufferGeometry {
  const s = new Shape()
  // Planta en (x = envergadura, y = cuerda hacia el morro).
  s.moveTo(side * 0, 4)
  if (broken) {
    s.lineTo(side * 3.2, 0.5)
    s.lineTo(side * 3.8, -0.4)
    s.lineTo(side * 3.1, -1.4)
    s.lineTo(side * 4.1, -2.6)
    s.lineTo(side * 3.4, -4.2)
  } else {
    s.lineTo(side * 8.5, -3.2)
    s.lineTo(side * 9.6, -5.4)
    s.lineTo(side * 8.2, -6.2)
  }
  s.lineTo(side * 0, -6)
  s.lineTo(side * 0, 4)
  const g = new ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: false })
  // Shape en XY → ala tumbada en XZ (y = cuerda pasa a z).
  g.rotateX(-Math.PI / 2)
  g.translate(0, -0.19, 0)
  return g.toNonIndexed()
}

/** Deriva de cola: perfil triangular en flecha. */
export function finGeometry(): BufferGeometry {
  const s = new Shape()
  s.moveTo(0, 0)
  s.lineTo(-4.2, 0)
  s.lineTo(-5.6, 3.4)
  s.lineTo(-4.4, 3.4)
  s.lineTo(0, 0)
  const g = new ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false })
  // Shape en XY (x = hacia atrás) → plano YZ.
  g.rotateY(Math.PI / 2)
  g.translate(-0.125, 0, 0)
  return g.toNonIndexed()
}
