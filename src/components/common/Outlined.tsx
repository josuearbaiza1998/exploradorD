import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Mesh, SkinnedMesh, Vector3, type Group } from 'three'
import { ensureOutlineNormals, outlineMaterial } from '@/materials/outline'

/**
 * Añade contorno de cómic a todas las mallas hijas (una sola vez al montar).
 * Para mallas con esqueleto, el contorno comparte el esqueleto y se anima igual.
 */
export function Outlined({ children, thickness = 0.03, color }: { children: ReactNode; thickness?: number; color?: string }) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const added: Mesh[] = []
    const meshes: Mesh[] = []
    root.traverse((o) => {
      if (o instanceof Mesh && !o.userData.isOutline && !o.userData.noOutline) meshes.push(o)
    })
    // El grosor se da en unidades del grupo; se convierte a unidades locales
    // de cada malla (los .glb suelen traer escalas anidadas).
    root.updateWorldMatrix(true, true)
    const rootScale = root.getWorldScale(new Vector3()).x
    const ms = new Vector3()
    for (const m of meshes) {
      ensureOutlineNormals(m.geometry)
      const local = (thickness * rootScale) / (m.getWorldScale(ms).x || 1)
      const mat = outlineMaterial(Number(local.toPrecision(3)), color)
      let outline: Mesh
      if (m instanceof SkinnedMesh) {
        const s = new SkinnedMesh(m.geometry, mat)
        s.bind(m.skeleton, m.bindMatrix)
        s.morphTargetInfluences = m.morphTargetInfluences
        s.morphTargetDictionary = m.morphTargetDictionary
        outline = s
      } else {
        outline = new Mesh(m.geometry, mat)
      }
      outline.userData.isOutline = true
      outline.castShadow = false
      outline.receiveShadow = false
      outline.position.copy(m.position)
      outline.quaternion.copy(m.quaternion)
      outline.scale.copy(m.scale)
      m.parent?.add(outline)
      added.push(outline)
    }
    return () => added.forEach((o) => o.removeFromParent())
  })
  return <group ref={ref}>{children}</group>
}
