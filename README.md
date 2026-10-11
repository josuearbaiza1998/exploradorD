# Explorador D

Juego móvil 3D (horizontal) de supervivencia robótica en un planeta desértico.
React Three Fiber + Drei + TypeScript + Vite, estilo lowpoly con cell-shading.

## Desarrollo

```bash
npm install
npm run dev      # servidor local (también accesible desde el móvil en la misma red)
npm run build    # typecheck + build de producción en /dist (lo que usa Vercel)
```

Vercel detecta Vite automáticamente: build `npm run build`, salida `dist`.

## Controles

- Móvil: joystick flotante en la mitad izquierda, arrastrar en la derecha para girar la cámara, botón de salto.
- Escritorio (pruebas): WASD/flechas, Shift para correr, Espacio para saltar, arrastrar con el ratón a la derecha.

## Estructura

```
src/
  App.tsx                    Composición raíz (canvas + UI)
  assets/models.ts           Registro de .glb: cambia null por la ruta y listo
  config/                    world.ts (POIs, colinas, chunks, isla) · palette.ts
  components/
    common/                  ModelSlot e InstancedProp (placeholder hoy, useGLTF mañana)
    environment/             DayNightCycle, Lighting, SkyDome
    terrain/                 Terrain (gestor de chunks), TerrainChunk, Sea
    props/                   CrashedShip, SmokeColumn, Oasis, Vegetation, RobotPlaceholder
    player/                  Robot (controlador), RobotModel, ThirdPersonCamera
    scene/                   GameCanvas, World
    ui/                      controls/ (joystick, LookPad, botones), TimeDebugPanel (temporal), RotateDeviceHint
  hooks/useVisibleChunks.ts  Qué chunks deben existir alrededor del foco
  materials/                 Gradient map de cortes duros, fábrica toon, viento en shader
  systems/                   Reloj, día/noche, viento, foco, input, player, cameraRig,
                             physics/ (characterMotor + colisionadores estáticos)
  utils/                     Ruido, PRNG, scatter por chunk, heightfield, geometrías
```

## Hoja de ruta

- **Fase 1 (hecha):** proyecto, terreno por chunks con regla del triángulo, nave con humo, oasis, toon + día/noche.
- **Fase 2 (hecha):** controlador en tercera persona con joysticks virtuales + cámara de seguimiento, sin motor de físicas (motor cinemático intercambiable).
- **Fase 3:** store de Zustand: batería, sensores, inventario, caja caída, modo reposo y recarga en la nave.
- **Fase 4:** interacción y crafteo escalonado (romper árboles pequeños, hacha futurista, scavenging en la nave).
- **Fase 5:** clima con gameplay: polvo, tormentas de arena, lluvia, suciedad de sensores (UI diegética), frío nocturno.
- **Fase 6:** energía y refugios (paneles solares, construcción), y terreno infinito por chunks.
