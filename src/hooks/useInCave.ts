import { useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { cave } from '@/config/cave'

/** ¿El robot está en la cueva? Re-renderiza solo al entrar o salir (dentro del Canvas). */
export function useInCave() {
  const [inside, setInside] = useState(cave.active)
  useFrame(() => {
    if (cave.active !== inside) setInside(cave.active)
  })
  return inside
}
