import { useLayoutEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from '@react-three/fiber'
import { Group, Matrix4, Quaternion, Vector3, type Object3D } from 'three'

/** Matriz del hueso en el espacio de `root` (tomarla en una pose de referencia). */
export function boneInRoot(bone: Object3D, root: Object3D): Matrix4 {
  root.updateWorldMatrix(true, true)
  return new Matrix4().copy(root.matrixWorld).invert().multiply(bone.matrixWorld)
}

/**
 * Cuelga objetos de un hueso de un modelo animado.
 * Con `align`, los hijos se escriben en metros y coordenadas de `root` tal
 * como estaba en la pose de referencia `rest` (cómodo para mochilas,
 * gafas…) y luego siguen al hueso. Sin `align`, solo se corrige la escala:
 * origen y ejes son los del hueso.
 */
export function BoneAttachment({ bone, rest, align = true, children }: {
  bone: Object3D | undefined
  rest: Matrix4 | undefined
  align?: boolean
  children: ReactNode
}) {
  const group = useMemo(() => Object.assign(new Group(), { name: 'bone-attachment' }), [])
  const inner = useMemo(() => new Group(), [])
  useLayoutEffect(() => {
    if (!bone || !rest) return
    const p = new Vector3()
    const q = new Quaternion()
    const s = new Vector3()
    rest.decompose(p, q, s)
    group.scale.setScalar(1 / (s.x || 1))
    if (align) {
      group.quaternion.copy(q).invert()
      inner.position.copy(p).negate()
    } else {
      group.quaternion.identity()
      inner.position.set(0, 0, 0)
    }
    group.add(inner)
    bone.add(group)
    return () => {
      group.removeFromParent()
    }
  }, [bone, rest, align, group, inner])
  return createPortal(children, inner)
}
