import { createToonMaterial } from './toonMaterials'

/**
 * Material del terreno: toon con colores por vértice y normales suaves, más
 * detalle dibujado en el shader solo sobre la arena (atributo `sand`): ondas
 * de viento en trazos finos y un granulado de puntitos cerca de la cámara.
 * No busca realismo: son líneas limpias, como pintadas a mano.
 */
export function createTerrainMaterial() {
  const mat = createToonMaterial({ vertexColors: true })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float sand;
        varying float vSand;
        varying vec3 vTerrainPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSand = sand;
        vTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vSand;
        varying vec3 vTerrainPos;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 p = vTerrainPos.xz;
          float dist = length(vTerrainPos - cameraPosition);
          // Ondas de viento: trazos curvos paralelos, por manchas, que se desvanecen a lo lejos.
          float warp = sin(p.x * 0.045 + sin(p.y * 0.031) * 2.0) * 3.5 + sin(p.y * 0.06 + 1.7) * 2.0;
          float wave = (p.x * 0.55 + p.y * 0.83) * 1.15 + warp;
          float line = smoothstep(0.84, 0.92, sin(wave));
          float lit = smoothstep(0.84, 0.92, sin(wave + 0.55)) * (1.0 - line);
          float patchy = smoothstep(-0.1, 0.45, sin(p.x * 0.021 + 1.3) * sin(p.y * 0.017 + 0.4) + 0.25);
          float near = 1.0 - smoothstep(40.0, 85.0, dist);
          float k = vSand * patchy * near;
          diffuseColor.rgb *= 1.0 - line * 0.11 * k + lit * 0.05 * k;
          // Granulado: puntitos claros y oscuros muy cerca.
          vec2 gp = p * 1.6;
          vec2 cell = floor(gp);
          float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
          vec2 off = vec2(fract(h * 7.31), fract(h * 3.17)) * 0.5 + 0.25;
          float speck = 1.0 - smoothstep(0.07, 0.11, length(fract(gp) - off));
          float grain = speck * (step(0.8, h) * 0.08 - step(h, 0.12) * 0.07);
          diffuseColor.rgb *= 1.0 + grain * vSand * (1.0 - smoothstep(14.0, 32.0, dist));
        }`,
      )
  }
  return mat
}
