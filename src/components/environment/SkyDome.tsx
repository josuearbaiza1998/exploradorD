import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, type Mesh } from 'three'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'

/**
 * Cúpula de cielo estilizada: degradado de dos colores con un disco de
 * sol/luna de borde duro (coherente con el cell-shading). Un único draw call
 * y un shader mínimo, mucho más barato en móvil que un cielo atmosférico.
 */
export function SkyDome() {
  const ref = useRef<Mesh>(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new Color() },
          uHorizon: { value: new Color() },
          uSunDir: { value: environment.lightDir.clone() },
          uSunColor: { value: new Color() },
          uIsDay: { value: 1 },
          uSunVisible: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // siempre al fondo
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uTop;
          uniform vec3 uHorizon;
          uniform vec3 uSunDir;
          uniform vec3 uSunColor;
          uniform float uIsDay;
          uniform float uSunVisible;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            // Bandas suaves cuantizadas => cielo "pintado".
            float t = smoothstep(0.0, 0.42, h);
            t = floor(t * 5.0) / 5.0 * 0.4 + t * 0.6;
            vec3 col = mix(uHorizon, uTop, t);
            float d = dot(normalize(vDir), normalize(uSunDir));
            float size = mix(0.9985, 0.9975, uIsDay);
            float disc = step(size, d) * uSunVisible;
            float halo = smoothstep(0.97, 0.995, d) * 0.25 * uSunVisible;
            vec3 discCol = mix(vec3(0.92, 0.95, 1.0), uSunColor * 1.4, uIsDay);
            col = mix(col, discCol, disc) + uSunColor * halo * uIsDay;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )

  useFrame(({ camera }) => {
    const u = material.uniforms
    const p = environment.palette
    // El clima tiñe el cielo (cielo ocre en tormenta, gris en lluvia).
    const amount = weatherState.tintAmount
    ;(u.uTop.value as Color).copy(p.skyTop).lerp(environment.weatherTint, amount * 0.85)
    ;(u.uHorizon.value as Color).copy(p.skyHorizon).lerp(environment.weatherTint, amount)
    ;(u.uSunColor.value as Color).copy(p.sunColor)
    u.uSunDir.value.copy(environment.lightDir)
    u.uIsDay.value = environment.isDay ? 1 : 0
    u.uSunVisible.value = 1 - Math.min(1, weatherState.tintAmount * 1.2)
    // La cúpula acompaña a la cámara: nunca se alcanza el borde del cielo.
    ref.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  )
}
