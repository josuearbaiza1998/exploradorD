import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { Matrix4, Mesh, type BufferGeometry, type InstancedMesh, type Material } from 'three'
import { modelPath, type ModelId } from '@/assets/models'

export type PropPart = { geometry: BufferGeometry; material: Material }

type Props = {
  id: ModelId
  /** Partes primitivas temporales (geometría + material toon). */
  fallback: PropPart[]
  /** Matrices de mundo de cada instancia. */
  matrices: Matrix4[]
  /** Material que sustituye a los del .glb (p. ej. toon con viento). */
  overrideMaterial?: Material
  castShadow?: boolean
}

/**
 * Prop instanciado (1 draw call por parte, sin importar cuántas copias).
 * Con .glb registrado, toma sus mallas; si no, usa las primitivas.
 */
export function InstancedProp({ id, fallback, matrices, overrideMaterial, castShadow = true }: Props) {
  const path = modelPath(id)
  const primitive = <InstancedParts parts={fallback} matrices={matrices} castShadow={castShadow} />
  if (!path) return primitive
  return (
    <Suspense fallback={primitive}>
      <GltfInstanced path={path} matrices={matrices} overrideMaterial={overrideMaterial} castShadow={castShadow} />
    </Suspense>
  )
}

function GltfInstanced({ path, matrices, overrideMaterial, castShadow }: {
  path: string
  matrices: Matrix4[]
  overrideMaterial?: Material
  castShadow: boolean
}) {
  const { scene } = useGLTF(path)
  const parts = useMemo(() => {
    const list: PropPart[] = []
    scene.updateMatrixWorld(true)
    scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const geometry = (obj.geometry as BufferGeometry).clone().applyMatrix4(obj.matrixWorld)
        list.push({ geometry, material: overrideMaterial ?? (obj.material as Material) })
      }
    })
    return list
  }, [scene, overrideMaterial])
  return <InstancedParts parts={parts} matrices={matrices} castShadow={castShadow} />
}

function InstancedParts({ parts, matrices, castShadow }: { parts: PropPart[]; matrices: Matrix4[]; castShadow: boolean }) {
  return (
    <>
      {parts.map((part, i) => (
        <InstancedPart key={i} part={part} matrices={matrices} castShadow={castShadow} />
      ))}
    </>
  )
}

function InstancedPart({ part, matrices, castShadow }: { part: PropPart; matrices: Matrix4[]; castShadow: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.count = matrices.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])
  if (matrices.length === 0) return null
  // Capacidad redondeada por bloques: al cargar chunks nuevos el número de
  // instancias cambia a menudo y así no se recrea el buffer en cada cambio.
  const capacity = Math.ceil(matrices.length / 512) * 512
  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[part.geometry, part.material, capacity]}
      castShadow={castShadow}
      receiveShadow
    />
  )
}
