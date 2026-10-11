import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, ShaderMaterial, Vector3, type Mesh } from 'three'
import { getGame } from '@/store/gameStore'
import { environment } from '@/systems/environmentState'
import { weatherState } from '@/systems/weatherState'

/**
 * Cúpula de cielo estilizada: degradado de dos colores con un disco de
 * sol/luna de borde duro (coherente con el cell-shading). Un único draw call
 * y un shader mínimo, mucho más barato en móvil que un cielo atmosférico.
 */
export function SkyDome() {
  const ref = useRef<Mesh>(null)
  const shooting = useRef({ t: -1, next: 8 })
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
          uNight: { value: 0 },
          uTime: { value: 0 },
          uMoonPhase: { value: 0.5 },
          uShootA: { value: new Vector3(0, 1, 0) },
          uShootB: { value: new Vector3(0, 1, 0) },
          uShoot: { value: 0 },
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
          uniform float uNight;
          uniform float uTime;
          uniform float uMoonPhase;
          uniform vec3 uShootA;
          uniform vec3 uShootB;
          uniform float uShoot;
          varying vec3 vDir;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            // Bandas suaves cuantizadas => cielo "pintado".
            float t = smoothstep(0.0, 0.42, h);
            t = floor(t * 5.0) / 5.0 * 0.4 + t * 0.6;
            vec3 col = mix(uHorizon, uTop, t);
            vec3 dir = normalize(vDir);
            // Estrellas: celdas en la dirección de vista, con titileo.
            if (uNight > 0.01 && dir.y > 0.02) {
              vec3 cell = floor(dir * 260.0);
              float r = hash(cell);
              if (r > 0.9965) {
                vec3 c = (cell + 0.5) / 260.0;
                float star = smoothstep(0.0028, 0.0008, length(dir - normalize(c)));
                float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 6.0) + r * 80.0);
                col += vec3(0.95, 0.95, 1.0) * star * tw * uNight * smoothstep(0.02, 0.2, dir.y) * (0.5 + fract(r * 937.0) * 0.8);
              }
              // Estrella fugaz: trazo entre A y la cabeza, con cola que se desvanece.
              if (uShoot > 0.0 && uShoot < 1.0) {
                vec3 head = normalize(mix(uShootA, uShootB, uShoot));
                vec3 tail = normalize(mix(uShootA, uShootB, max(0.0, uShoot - 0.25)));
                vec3 seg = head - tail;
                float k = clamp(dot(dir - tail, seg) / max(dot(seg, seg), 1e-6), 0.0, 1.0);
                float dl = length(dir - (tail + seg * k));
                float fade = k * sin(uShoot * 3.14159);
                col += vec3(1.0, 0.97, 0.85) * smoothstep(0.0022, 0.0, dl) * fade * uNight;
              }
            }
            float d = dot(dir, normalize(uSunDir));
            float size = mix(0.9985, 0.9975, uIsDay);
            float disc = step(size, d) * uSunVisible;
            float halo = smoothstep(0.97, 0.995, d) * 0.25 * uSunVisible;
            vec3 discCol = mix(vec3(0.92, 0.95, 1.0), uSunColor * 1.4, uIsDay);
            // Fases de la luna: terminador sobre el disco (0 nueva, 0.5 llena).
            if (uIsDay < 0.5 && disc > 0.0) {
              vec3 n = normalize(uSunDir);
              vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), n));
              vec3 up = cross(n, right);
              float rad = sqrt(1.0 - size * size);
              float x = dot(dir - n, right) / rad;
              float y = dot(dir - n, up) / rad;
              float sx = sqrt(max(0.0, 1.0 - y * y));
              float xt = sx * cos(uMoonPhase * 6.28318);
              bool lit = uMoonPhase < 0.5 ? x > xt : x < -xt;
              discCol = lit ? discCol : mix(col, vec3(0.25, 0.28, 0.38), 0.5);
            }
            col = mix(col, discCol, disc) + uSunColor * halo * uIsDay;
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }
        `,
      }),
    [],
  )

  useFrame(({ camera, clock }, delta) => {
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
    const clear = 1 - Math.min(1, weatherState.tintAmount * 1.5)
    u.uNight.value = Math.max(0, 1 - p.daylight * 1.6) * clear
    u.uTime.value = clock.elapsedTime
    // Una fase por día de juego: ciclo lunar de 8 días.
    u.uMoonPhase.value = ((Math.floor(getGame().totalHours / 24) % 8) + 4) % 8 / 8
    // Estrellas fugaces de vez en cuando (solo de noche y despejado).
    const sh = shooting.current
    if (sh.t >= 0) {
      sh.t += delta / 0.9
      u.uShoot.value = sh.t
      if (sh.t >= 1) {
        sh.t = -1
        u.uShoot.value = 0
        sh.next = clock.elapsedTime + 6 + Math.random() * 14
      }
    } else if (u.uNight.value > 0.5 && clock.elapsedTime > sh.next) {
      const a = Math.random() * Math.PI * 2
      const el = 0.5 + Math.random() * 0.5
      u.uShootA.value.set(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el))
      const b = a + 0.35 + Math.random() * 0.3
      const el2 = el - 0.2 - Math.random() * 0.15
      u.uShootB.value.set(Math.cos(b) * Math.cos(el2), Math.sin(el2), Math.sin(b) * Math.cos(el2))
      sh.t = 0
    }
    // La cúpula acompaña a la cámara: nunca se alcanza el borde del cielo.
    ref.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[900, 32, 16]} />
    </mesh>
  )
}
