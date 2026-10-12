import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, DataTexture, DoubleSide, LinearFilter, PlaneGeometry, RedFormat, type Mesh } from 'three'
import { PALETTE } from '@/config/palette'
import { ISLAND } from '@/config/world'
import { focus } from '@/systems/focus'
import { createToonMaterial } from '@/materials/toonMaterials'
import { seaState, seaSurface, updateSea, WAVE_GLSL } from '@/systems/sea'
import { player } from '@/systems/player'
import { getHeight } from '@/utils/terrain/heightfield'

/** Mapa de profundidad del mar alrededor de la isla (para la espuma de la orilla y los bajíos). */
const DEPTH_EXTENT = 270
const DEPTH_RES = 256
const DEPTH_MAX = 8

function bakeDepth() {
  const data = new Uint8Array(DEPTH_RES * DEPTH_RES)
  const step = (DEPTH_EXTENT * 2) / DEPTH_RES
  for (let j = 0; j < DEPTH_RES; j++) {
    for (let i = 0; i < DEPTH_RES; i++) {
      const x = -DEPTH_EXTENT + (i + 0.5) * step
      const z = -DEPTH_EXTENT + (j + 0.5) * step
      const d = (ISLAND.seaLevel - getHeight(x, z)) / DEPTH_MAX
      data[j * DEPTH_RES + i] = Math.round(Math.min(1, Math.max(0, d)) * 255)
    }
  }
  const tex = new DataTexture(data, DEPTH_RES, DEPTH_RES, RedFormat)
  tex.magFilter = tex.minFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

/**
 * Mar estilo cel-shading (a lo Wind Waker): olas suaves que se mueven en el
 * mundo, color turquesa en los bajíos y azul en lo hondo, un borde de espuma
 * blanca en la orilla con líneas que llegan a la playa y remolinos de espuma
 * en mar abierto. Sigue al foco para parecer infinito.
 */
export function Sea() {
  const ref = useRef<Mesh>(null)
  const { geometry, material, uniforms } = useMemo(() => {
    const geometry = new PlaneGeometry(1600, 1600, 160, 160).rotateX(-Math.PI / 2)
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.2 },
      uDepth: { value: bakeDepth() },
      uDepthExtent: { value: DEPTH_EXTENT },
      uDepthMax: { value: DEPTH_MAX },
      uShallow: { value: new Color('#3fd8d0') },
      uDeep: { value: new Color(PALETTE.sea).multiplyScalar(0.8) },
      uFoam: { value: new Color('#ffffff') },
      uUnder: { value: 0 },
      uCamUnder: { value: 0 },
    }
    const material = createToonMaterial({ color: PALETTE.sea, bands: 2, transparent: true, opacity: 0.92, side: DoubleSide })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uAmp;
          uniform sampler2D uDepth;
          uniform float uDepthExtent;
          varying vec2 vSeaXZ;
          varying float vWave;
          ${WAVE_GLSL}`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec2 seaXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
          vec2 duv = seaXZ / (uDepthExtent * 2.0) + 0.5;
          float d0 = (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) ? 1.0 : texture2D(uDepth, duv).r;
          // Junto a la orilla las olas se aplanan (no se meten en la arena).
          float w = waveHeight(seaXZ, uTime, uAmp) * smoothstep(0.0, 0.35, d0);
          transformed.y += w;
          vSeaXZ = seaXZ;
          vWave = w / max(uAmp, 0.01);`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform sampler2D uDepth;
          uniform float uDepthExtent;
          uniform float uDepthMax;
          uniform vec3 uShallow;
          uniform vec3 uDeep;
          uniform vec3 uFoam;
          uniform float uUnder;
          uniform float uCamUnder;
          varying vec2 vSeaXZ;
          varying float vWave;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 duv = vSeaXZ / (uDepthExtent * 2.0) + 0.5;
          bool inMap = duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0;
          float depth = (inMap ? texture2D(uDepth, duv).r : 1.0) * uDepthMax;
          // Bajíos turquesa, hondo azul, en dos tonos con un corte limpio.
          float deepK = smoothstep(1.2, 4.5, depth);
          deepK = floor(deepK * 3.0 + 0.5) / 3.0;
          vec3 water = mix(uShallow, uDeep, deepK);
          // Cresta de la ola un poco más clara.
          water += step(0.55, vWave) * 0.06;
          float foam = 0.0;
          // Borde de espuma pegado a la arena, que respira con las olas.
          float rim = 0.35 + 0.12 * sin(uTime * 1.3 + vSeaXZ.x * 0.15 + vSeaXZ.y * 0.1);
          foam = max(foam, 1.0 - step(rim, depth));
          // Líneas de espuma que llegan a la orilla y se deshacen.
          float wob = sin(vSeaXZ.x * 0.21 + vSeaXZ.y * 0.17) * 0.25;
          float ph = fract(uTime * 0.11 + wob * 0.3);
          float lineAt = (1.0 - ph) * 2.6 + 0.35;
          float line = 1.0 - smoothstep(0.05, 0.11, abs(depth - lineAt));
          foam = max(foam, line * step(0.08, ph) * (1.0 - ph * 0.8) * step(depth, 3.0));
          // Mar abierto: remolinos de espuma en trazos finos.
          vec2 q = vSeaXZ * 0.045;
          float sw = sin(q.x * 3.1 + sin(q.y * 2.3 + uTime * 0.12) * 2.2) * sin(q.y * 2.7 + sin(q.x * 1.9 - uTime * 0.1) * 2.4);
          float swirl = 1.0 - smoothstep(0.012, 0.03, abs(sw - 0.78));
          foam = max(foam, swirl * smoothstep(3.5, 6.0, depth) * 0.85);
          diffuseColor.rgb = mix(water, uFoam, foam);
          // Bajíos más transparentes (se ve la arena); bajo el agua, casi sin velo.
          float a = mix(0.55, 0.92, smoothstep(0.3, 3.0, depth));
          diffuseColor.a = mix(max(a, foam), 0.45, uUnder);
          // Visto desde abajo: un techo de luz verdosa que tapa el cielo.
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.88, 0.9), uCamUnder * 0.6);
          diffuseColor.a = mix(diffuseColor.a, 0.97, uCamUnder);`,
        )
    }
    return { geometry, material, uniforms }
  }, [])

  useFrame(({ camera }, delta) => {
    updateSea(Math.min(delta, 0.1))
    uniforms.uTime.value = seaState.time
    uniforms.uAmp.value = seaState.amp
    // Con el robot sumergido el mar se aclara para seguir viéndolo.
    const under = player.position.y < ISLAND.seaLevel - 0.6 || camera.position.y < ISLAND.seaLevel ? 1 : 0
    uniforms.uUnder.value += (under - uniforms.uUnder.value) * 0.1
    uniforms.uCamUnder.value = camera.position.y < seaSurface(camera.position.x, camera.position.z) ? 1 : 0
    const m = ref.current
    if (!m) return
    // Se mueve en pasos de una celda: así los vértices no "nadan" sobre las olas.
    const cell = 1600 / 160
    m.position.set(Math.round(focus.x / cell) * cell, ISLAND.seaLevel, Math.round(focus.z / cell) * cell)
  })
  if (!ISLAND.enabled) return null
  return <mesh ref={ref} geometry={geometry} material={material} receiveShadow frustumCulled={false} />
}
