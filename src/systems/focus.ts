import { Vector3 } from 'three'
import { SPAWN } from '@/config/world'

/**
 * Punto de interés de la cámara/jugador. Lo leen el gestor de chunks y la
 * cámara de sombras. En la Fase 3 lo escribirá el controlador del robot;
 * por ahora lo escribe la cámara orbital de inspección.
 */
export const focus = new Vector3(SPAWN.x, 0, SPAWN.z)
