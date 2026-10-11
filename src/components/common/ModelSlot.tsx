import { Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { Mesh, type Material } from 'three'
import { modelPath, type ModelId } from '@/assets/models'

type ModelSlotProps = {
  /** Id del modelo en src/assets/models.ts. */
  id: ModelId
  /** Primitiva temporal que se muestra si aún no hay .glb (y mientras carga). */
  placeholder: ReactNode
  /** Si se indica, sustituye los materiales del .glb por este material toon. */
  overrideMaterial?: Material
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * Hueco para un modelo: placeholder hoy, .glb mañana.
 * Envuelve la carga en Suspense para que el resto de la escena no espere.
 */
export function ModelSlot({ id, placeholder, overrideMaterial, castShadow = true, receiveShadow = true }: ModelSlotProps) {
  const path = modelPath(id)
  if (!path) return <>{placeholder}</>
  return (
    <Suspense fallback={placeholder}>
      <GltfModel path={path} overrideMaterial={overrideMaterial} castShadow={castShadow} receiveShadow={receiveShadow} />
    </Suspense>
  )
}

function GltfModel({ path, overrideMaterial, castShadow, receiveShadow }: {
  path: string
  overrideMaterial?: Material
  castShadow: boolean
  receiveShadow: boolean
}) {
  const { scene } = useGLTF(path)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.castShadow = castShadow
        obj.receiveShadow = receiveShadow
        if (overrideMaterial) obj.material = overrideMaterial
      }
    })
    return c
  }, [scene, overrideMaterial, castShadow, receiveShadow])
  return <primitive object={clone} />
}
