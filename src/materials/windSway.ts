import { Vector2, type Material } from 'three'

/**
 * Uniforms de viento compartidos por todos los materiales con balanceo.
 * Se actualizan una vez por frame (ver DayNightCycle), así la vegetación
 * responde a las ráfagas del sistema de viento sin coste en CPU.
 */
export const windUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new Vector2(1, 0) },
  uWindStrength: { value: 0.35 },
}

/**
 * Inyecta balanceo por viento en un material instanciado (vertex shader).
 * `flex` = cuánto se dobla por metro de altura local del modelo.
 */
export function applyWindSway<T extends Material>(material: T, flex = 0.08): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime
    shader.uniforms.uWindDir = windUniforms.uWindDir
    shader.uniforms.uWindStrength = windUniforms.uWindStrength
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform float uWindStrength;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec2 seed = instanceMatrix[3].xz;
        #else
          vec2 seed = vec2(0.0);
        #endif
        float bend = max(transformed.y, 0.0) * ${flex.toFixed(4)};
        float wave = sin(uTime * 1.8 + seed.x * 0.37 + seed.y * 0.23) * 0.6 + 0.4;
        float flutter = sin(uTime * 5.3 + seed.x + transformed.y * 2.0) * 0.15;
        mvPosition.xz += uWindDir * bend * bend * uWindStrength * (wave + flutter) * 3.0;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      )
  }
  material.customProgramCacheKey = () => `wind-${flex}`
  return material
}
