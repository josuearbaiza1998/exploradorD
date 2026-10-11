import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { Outlined } from "@/components/common/Outlined";
import { PALETTE } from "@/config/palette";
import { POIS, pillarRing, type PoiDef } from "@/config/pois";
import {
  MATERIALS,
  createToonMaterial,
  sharedToon,
} from "@/materials/toonMaterials";
import { useGameStore } from "@/store/gameStore";
import { getHeight } from "@/utils/terrain/heightfield";

/** Lugares por descubrir: modelos procedurales con su contenedor. */
export function Pois() {
  return (
    <group name="pois">
      {POIS.map((poi) => (
        <Poi key={poi.id} poi={poi} />
      ))}
    </group>
  );
}

function Poi({ poi }: { poi: PoiDef }) {
  const y = useMemo(() => getHeight(poi.x, poi.z), [poi]);
  const looted = useGameStore((s) => !!s.looted[poi.id]);
  const away = poi.cacheWorld;
  return (
    <>
      {away && (
        <group
          position={[away.x, getHeight(away.x, away.z) - 0.05, away.z]}
          rotation-y={-2.4}
        >
          <Cache looted={looted} glow="#ffb347" />
        </group>
      )}
      <group position={[poi.x, y - 0.05, poi.z]} rotation-y={poi.rotation}>
        <Outlined thickness={0.05}>
          {poi.id === "probeWreck" && <ProbeWreck />}
          {poi.id === "ruins" && <Ruins />}
          {poi.id === "cave" && <Cave />}
          {poi.id === "beacon" && <Beacon />}
        </Outlined>
        {/* El de la cueva está al fondo de su interior (CaveInterior). */}
        {poi.id !== "cave" && !poi.cacheWorld && (
          <group position={[poi.cache[0], 0, poi.cache[1]]}>
            <Cache
              looted={looted}
              glow={poi.id === "ruins" ? "#7fe8ff" : "#ffb347"}
            />
          </group>
        )}
      </group>
    </>
  );
}

/** Contenedor: brilla y su luz late hasta que se abre. */
export function Cache({ looted, glow }: { looted: boolean; glow: string }) {
  const light = useMemo(
    () =>
      createToonMaterial({
        color: glow,
        emissive: glow,
        emissiveIntensity: 1.4,
      }),
    [glow],
  );
  const lid = useRef<Group>(null);
  useFrame(({ clock }) => {
    light.emissiveIntensity = looted
      ? 0.05
      : 1 + Math.sin(clock.elapsedTime * 3) * 0.6;
  });
  return (
    <Outlined thickness={0.03}>
      <mesh
        material={MATERIALS.shipDark}
        position-y={0.3}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[1, 0.6, 0.7]} />
      </mesh>
      <group
        ref={lid}
        position={[0, 0.6, -0.35]}
        rotation-x={looted ? -1.9 : 0}
      >
        <mesh
          material={MATERIALS.shipHull}
          position={[0, 0.06, 0.35]}
          castShadow
        >
          <boxGeometry args={[1.04, 0.12, 0.74]} />
        </mesh>
      </group>
      <mesh material={light} position={[0, 0.42, 0.36]}>
        <boxGeometry args={[0.5, 0.08, 0.02]} />
      </mesh>
    </Outlined>
  );
}

/** Sonda antigua medio enterrada: cuerpo esférico oxidado, antena rota y paneles. */
function ProbeWreck() {
  const rust = sharedToon("#9a5a3a");
  const old = sharedToon("#8c8a80");
  const panel = sharedToon(PALETTE.solarCell, { bands: 2 });
  return (
    <group>
      <mesh
        material={old}
        position={[0, 1.2, 0]}
        rotation={[0.5, 0, 0.3]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[2.2, 1]} />
      </mesh>
      <mesh
        material={rust}
        position={[0.4, 1.9, 1.6]}
        rotation={[0.9, 0, 0.3]}
        castShadow
      >
        <cylinderGeometry args={[1.2, 1.4, 0.6, 8]} />
      </mesh>
      {/* Ojo apagado */}
      <mesh
        material={MATERIALS.shipDark}
        position={[0.9, 1.5, 1.9]}
        rotation-x={1.2}
      >
        <cylinderGeometry args={[0.45, 0.45, 0.3, 10]} />
      </mesh>
      {/* Antena parabólica rota */}
      <mesh
        material={old}
        position={[-1.2, 3.4, -0.6]}
        rotation={[0.7, 0.3, -0.5]}
        castShadow
      >
        <coneGeometry args={[1.2, 0.5, 10, 1, true]} />
      </mesh>
      <mesh
        material={MATERIALS.shipDark}
        position={[-0.9, 2.9, -0.4]}
        rotation-z={-0.5}
      >
        <cylinderGeometry args={[0.08, 0.08, 1.6, 5]} />
      </mesh>
      {/* Paneles solares arrancados */}
      <mesh
        material={panel}
        position={[-3.5, 0.25, -2]}
        rotation={[0.2, 0.5, 0.15]}
        castShadow
      >
        <boxGeometry args={[2.6, 0.1, 1.4]} />
      </mesh>
      <mesh
        material={panel}
        position={[3.6, 0.2, -1.5]}
        rotation={[-0.3, -0.4, 0.4]}
        castShadow
      >
        <boxGeometry args={[2, 0.1, 1.2]} />
      </mesh>
      {/* Patas */}
      {[0, 2.1, 4.2].map((a) => (
        <mesh
          key={a}
          material={rust}
          position={[Math.cos(a) * 1.8, 0.4, Math.sin(a) * 1.8]}
          rotation-z={Math.cos(a) * 0.6}
          castShadow
        >
          <boxGeometry args={[0.2, 1.4, 0.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Anillo de pilares de arenisca (algunos rotos), arco y altar central. */
function Ruins() {
  const stone = MATERIALS.mesa;
  const dark = MATERIALS.mesaBand;
  const pillars = useMemo(() => pillarRing(6.5, 7), []);
  return (
    <group>
      {pillars.map(([x, z], i) => {
        const broken = i % 3 === 1;
        const h = broken ? 1.6 + (i % 2) : 4;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh
              material={i % 2 ? stone : dark}
              position-y={h / 2}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[1.1, h, 1.1]} />
            </mesh>
            {!broken && (
              <mesh material={stone} position-y={h + 0.2} castShadow>
                <boxGeometry args={[1.5, 0.4, 1.5]} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* Arco sobre dos pilares */}
      <mesh
        material={dark}
        position={[
          pillars[0][0] * 0.5 + pillars[6][0] * 0.5,
          4.5,
          pillars[0][1] * 0.5 + pillars[6][1] * 0.5,
        ]}
        rotation-y={
          Math.atan2(
            pillars[6][0] - pillars[0][0],
            pillars[6][1] - pillars[0][1],
          ) +
          Math.PI / 2
        }
        castShadow
      >
        <boxGeometry args={[6.3, 0.6, 1.2]} />
      </mesh>
      {/* Bloques caídos */}
      <mesh
        material={stone}
        position={[3, 0.3, -2]}
        rotation={[0.3, 0.6, 0.1]}
        castShadow
      >
        <boxGeometry args={[1.3, 0.6, 1]} />
      </mesh>
      {/* Altar */}
      <mesh material={dark} position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.4, 1.6, 0.7, 8]} />
      </mesh>
    </group>
  );
}

/** Montículo rocoso con boca oscura y cristales azules en la entrada. */
function Cave() {
  const crystal = useMemo(
    () =>
      createToonMaterial({
        color: "#5fd4ff",
        emissive: "#3ab8ff",
        emissiveIntensity: 0.9,
        flatShading: true,
      }),
    [],
  );
  const black = sharedToon("#0e0b0a");
  return (
    <group>
      <mesh
        material={MATERIALS.rock}
        position={[-4.2, 2.4, -1.5]}
        scale={[3.4, 3, 3.6]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh
        material={MATERIALS.rockBand}
        position={[4.2, 2.2, -1.5]}
        scale={[3.2, 2.8, 3.4]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh
        material={MATERIALS.mesa}
        position={[0, 4.2, -3.5]}
        scale={[5.5, 3.8, 4.5]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      {/* Boca de la cueva */}
      <mesh material={black} position={[0, 1.6, -0.6]} scale={[1.9, 1.7, 1]}>
        <sphereGeometry args={[1, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {[
        [-1.6, 0.4, 0.4, 0.3],
        [1.8, 0.5, 0.2, -0.4],
        [-2.3, 0.3, 1.1, 0.6],
        [2.4, 0.35, 1.3, -0.2],
      ].map(([x, s, z, r], i) => (
        <mesh
          key={i}
          material={crystal}
          position={[x, s, z]}
          rotation-z={r}
          userData={{ noOutline: true }}
        >
          <octahedronGeometry args={[s * 1.4, 0]} />
        </mesh>
      ))}
    </group>
  );
}

/** Torre de baliza con luz roja intermitente y haz visible de lejos. */
function Beacon() {
  const light = useMemo(
    () =>
      createToonMaterial({
        color: "#ff3d3d",
        emissive: "#ff3d3d",
        emissiveIntensity: 2,
        fog: false,
      }),
    [],
  );
  const beam = useMemo(
    () =>
      createToonMaterial({
        color: "#ff6a5a",
        emissive: "#ff4d3d",
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const beamRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const on = Math.sin(clock.elapsedTime * 2.5) > 0;
    light.emissiveIntensity = on ? 2.5 : 0.3;
    if (beamRef.current) beamRef.current.visible = on;
  });
  const legs = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  return (
    <group>
      {legs.map((a) => (
        <mesh
          key={a}
          material={MATERIALS.shipDark}
          position={[Math.cos(a) * 0.9, 3, Math.sin(a) * 0.9]}
          rotation={[Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]}
          castShadow
        >
          <boxGeometry args={[0.16, 6.2, 0.16]} />
        </mesh>
      ))}
      <mesh material={MATERIALS.shipHull} position={[0, 6.3, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 0.6, 8]} />
      </mesh>
      <mesh material={MATERIALS.shipAccent} position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.95, 0.95, 0.2, 8]} />
      </mesh>
      <mesh
        material={light}
        position={[0, 6.9, 0]}
        userData={{ noOutline: true }}
      >
        <icosahedronGeometry args={[0.35, 1]} />
      </mesh>
      <mesh
        ref={beamRef}
        material={beam}
        position={[0, 30, 0]}
        userData={{ noOutline: true }}
        renderOrder={2}
      >
        <cylinderGeometry args={[0.35, 0.35, 46, 6, 1, true]} />
      </mesh>
    </group>
  );
}
