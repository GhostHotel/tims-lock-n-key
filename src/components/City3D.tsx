import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, RoundedBox, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import boardHawaii from "@/assets/whiteboard-hawaii.webp.asset.json";
import boardEastside from "@/assets/whiteboard-eastside.webp.asset.json";
import boardDiner from "@/assets/whiteboard-diner.webp.asset.json";
import boardHaunted from "@/assets/whiteboard-haunted-house.png.asset.json";
import boardIsland from "@/assets/whiteboard-island.webp.asset.json";
import boardKite from "@/assets/whiteboard-kite.webp.asset.json";
import * as THREE from "three";
import { StreetArt } from "./StreetArt";
import { TechnicianModel } from "./TechnicianModel";
import { TECHNICIAN_STYLE, type Technician } from "@/lib/match";
import { Downtown } from "./Downtown";
import {
  BLOCK,
  BLOCK_HALF,
  BUSINESS,
  CAR_SPEED,
  GRID,
  JIMMY_RESPAWN,
  JOB_INFO,
  LOTS,
  ROUNDABOUTS,
  MALL,
  BUILDING_COLLIDERS,
  PARKING,
  RIVAL_NAMES,
  ROAD_LINES,
  SHOP_DOOR,
  TIM_POS,
  WHITEBOARD_MS,
  WORLD_HALF,
  AARON_LINES,
  buildingPush,
  drivingSurfaceHeight,
  carXZ,
  lightState,
  makeTraffic,
  nightAmount,
  popsPos,
  randomLine,
  stepCar,
  timSmoking,
  type Car,
  type Job,
} from "@/lib/game";
import { DeliveryModel, TreeModel, useCityModels } from "@/components/CityModels";
import { EastdaleMall } from "@/components/EastdaleMall";
import { SIGNAL_JUNCTIONS, signalFacing, isRedViolation } from "@/lib/game";
import { engine } from "@/lib/sfx";
import { resetGameInput, setDrivingKey, type DrivingInput } from "@/lib/driving-input";
import { timAnimationState } from "@/lib/game";
import { GRAPHICS, sceneTime } from "@/lib/graphics";
import { CityEffects } from "@/components/CityEffects";
import { CityWeather } from "@/components/CityWeather";
import { rainIntensity } from "@/lib/game";
import {
  CityEnvironment,
  CityMaterialDefaults,
  CitySurfaces,
  useSurfaceMaps,
} from "@/components/CitySurfaces";

export type SandboxEvent = "red" | "tim" | "jimmy" | "pops";

export type Input = DrivingInput;

// Driving feel
const ACCEL = 20,
  DRAG = 1.1,
  TURN = 2.6,
  MAX = 14,
  REV = 6,
  VAN_R = 1.1,
  NPC_R = 2.8;
const PARKED = [-6, -2, 2, 6].map((dx) => ({ x: PARKING.x + dx, z: PARKING.z - 3.5 }));

interface Props {
  technician?: Technician | undefined;
  rivalNames?: readonly string[];
  jobs: Job[];
  targetId: number | null;
  paused: boolean;
  freezeScene?: boolean;
  speedMul: number;
  input: React.MutableRefObject<Input>;
  onArrive: (id: number) => void;
  onShop: (at: boolean) => void;
  onEvent: (e: SandboxEvent) => void;
  resetKey: number;
  popsTemper: number;
}

function asphaltTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a3633";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = 40 + Math.random() * 40;
    g.fillStyle = `rgb(${v},${v - 3},${v - 6})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 40);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function masonryTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#d1cdc4";
    ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 5; col++) {
        const shade = 175 + ((row * 13 + col * 7) % 35);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(col * 32 + (row % 2) * 16 + 1, row * 16 + 1, 30, 14);
      }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function City() {
  const surfaces = useSurfaceMaps();
  const tex = useMemo(asphaltTexture, []);
  const roadMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: "city-asphalt",
        map: tex,
        ...surfaces?.asphalt,
        roughness: GRAPHICS.asphaltRoughness,
        metalness: 0,
      }),
    [tex, surfaces],
  );
  const mallRoad = useMemo(() => {
    const geometry = new THREE.RingGeometry(MALL.roadInner, MALL.roadOuter, 80);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(
        i,
        (position.getX(i) + MALL.x) / (WORLD_HALF * 2 + 40) + 0.5,
        0.5 - (position.getZ(i) + MALL.z) / (WORLD_HALF * 2 + 40),
      );
    }
    return geometry;
  }, []);
  useEffect(
    () => () => {
      roadMaterial.dispose();
    },
    [roadMaterial],
  );
  useEffect(
    () => () => {
      mallRoad.dispose();
    },
    [mallRoad],
  );
  const brick = useMemo(masonryTexture, []);
  const dashes = useMemo(() => {
    const d: [number, number, boolean][] = [];
    for (let r = -GRID; r < GRID; r++) {
      const line = r * BLOCK + BLOCK / 2;
      for (let s = -WORLD_HALF; s < WORLD_HALF; s += 4) {
        d.push([line, s, true]);
        d.push([s, line, false]);
      }
    }
    return d.filter(([x, z]) =>
      ROUNDABOUTS.every((ring) => Math.hypot(x - ring.x, z - ring.z) > ring.roadOuter),
    );
  }, []);
  const winMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f4dca0",
        emissive: "#f0b860",
        emissiveIntensity: 0.25,
      }),
    [],
  );
  useFrame(({ clock }) => {
    winMat.emissiveIntensity = 0.25 + nightAmount(clock.elapsedTime) * 1.4;
    const material = roadMaterial;
    if (material) {
      const wet = rainIntensity(clock.elapsedTime) > 0;
      material.roughness = wet ? GRAPHICS.wetAsphaltRoughness : GRAPHICS.asphaltRoughness;
      material.metalness = wet ? GRAPHICS.wetAsphaltMetalness : 0;
      material.userData["wet"] = wet;
    }
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow material={roadMaterial}>
        <planeGeometry args={[WORLD_HALF * 2 + 40, WORLD_HALF * 2 + 40]} />
      </mesh>
      <mesh
        name="eastdale-ring-road"
        position={[MALL.x, 0.008, MALL.z]}
        geometry={mallRoad}
        material={roadMaterial}
        receiveShadow
      />
      <mesh position={[MALL.x, 0.12, MALL.z]} receiveShadow>
        <cylinderGeometry args={[MALL.roadInner, MALL.roadInner, 0.24, 80]} />
        <meshStandardMaterial color="#9c968c" roughness={0.95} />
      </mesh>
      {Array.from({ length: 48 }, (_, i) => {
        const angle = (i * Math.PI * 2) / 48;
        // Leave the four street connections unmarked.
        if (Math.abs(Math.sin(angle)) < 0.24 || Math.abs(Math.cos(angle)) < 0.24) return null;
        const radius = (MALL.roadInner + MALL.roadOuter) / 2;
        return (
          <mesh
            key={`mall-dash-${i}`}
            position={[MALL.x + Math.cos(angle) * radius, 0.025, MALL.z + Math.sin(angle) * radius]}
            rotation={[-Math.PI / 2, 0, -angle]}
          >
            <planeGeometry args={[0.16, 0.75]} />
            <meshBasicMaterial color="#e8d9a8" />
          </mesh>
        );
      })}
      <Suspense fallback={null}>
        <EastdaleMall />
      </Suspense>
      <Suspense fallback={null}>
        <StreetArt />
      </Suspense>
      {dashes.map(([x, z, v], i) => (
        <mesh
          key={i}
          position={[x, 0.02, z]}
          rotation-x={-Math.PI / 2}
          rotation-z={v ? 0 : Math.PI / 2}
        >
          <planeGeometry args={[0.25, 1.6]} />
          <meshBasicMaterial color="#e8d9a8" />
        </mesh>
      ))}
      <Downtown roadMaterial={roadMaterial} />
      {LOTS.filter((l) => l.client !== MALL.name && l.kind !== "tower" && l.kind !== "stadium").map((l, i) => (
        <group key={i} position={[l.cx, 0, l.cz]}>
          <mesh position={[0, 0.12, 0]} receiveShadow>
            <boxGeometry args={[BLOCK_HALF * 2, 0.24, BLOCK_HALF * 2]} />
            <meshStandardMaterial color="#9c968c" />
          </mesh>
          <mesh position={[0, 0.3, 0]} receiveShadow>
            <boxGeometry args={[BLOCK_HALF * 2 - 1.5, 0.1, BLOCK_HALF * 2 - 1.5]} />
            <meshStandardMaterial color="#6f8f55" />
          </mesh>
          <mesh position={[0, l.h / 2 + 0.3, 1]} castShadow receiveShadow>
            <boxGeometry args={[8, l.h, 7]} />
            <meshStandardMaterial
              color={l.color}
              map={brick}
              {...surfaces?.masonry}
              roughness={1}
            />
          </mesh>
          <mesh position={[0, l.h + 0.5, 1]} castShadow>
            <boxGeometry args={[8.6, 0.4, 7.6]} />
            <meshStandardMaterial color="#4a3b33" />
          </mesh>
          <mesh position={[0, 1.2, 4.55]}>
            <boxGeometry args={[1.4, 2, 0.1]} />
            <meshStandardMaterial color="#5b3a26" />
          </mesh>
          {Array.from({ length: Math.floor(l.h / 2.2) }).map((_, f) => (
            <group key={f}>
              {[-2.5, 2.5].map((wx) => (
                <mesh key={wx} position={[wx, 2 + f * 2.2, 4.55]} material={winMat}>
                  <boxGeometry args={[1.4, 1, 0.1]} />
                </mesh>
              ))}
            </group>
          ))}
          <Tree x={-5.5} z={-5} />
          <Tree x={5.5} z={-5.5} />
        </group>
      ))}
      <Shop />
      <ParkingLot />
      <TrafficLights />
      <Tim />
    </group>
  );
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <Suspense fallback={null}>
      <TreeModel x={x} z={z} />
    </Suspense>
  );
}

const BOARD_PICS = [
  boardHawaii,
  boardEastside,
  boardDiner,
  boardHaunted,
  boardIsland,
  boardKite,
].map((a) => a.url);

function Whiteboard() {
  const texs = useTexture(BOARD_PICS) as THREE.Texture[];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setIdx((n) => (n + 1) % BOARD_PICS.length), WHITEBOARD_MS);
    return () => clearInterval(i);
  }, []);
  const tex = texs[idx] ?? texs[0]!;
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <group position={[2.75, 2.45, 1.08]}>
      <mesh>
        <boxGeometry args={[4.5, 2.95, 0.06]} />
        <meshStandardMaterial color="#cfd3d6" metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[4.3, 2.75]} />
        <meshStandardMaterial color="#fbfbf8" />
      </mesh>
      <mesh position={[0, 0.05, 0.045]}>
        <planeGeometry args={[3.9, 2.6]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.55, 0.12]}>
        <boxGeometry args={[4.3, 0.08, 0.2]} />
        <meshStandardMaterial color="#9aa0a4" />
      </mesh>
    </group>
  );
}

function OfficeMan() {
  const head = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (head.current) head.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.35;
  });
  return (
    <group position={[2.75, 0.35, 2.0]}>
      {/* chair */}
      <mesh position={[0, 0.5, -0.1]}>
        <boxGeometry args={[0.8, 0.1, 0.8]} />
        <meshStandardMaterial color="#2a2a2e" />
      </mesh>
      <mesh position={[0, 1.1, -0.5]}>
        <boxGeometry args={[0.8, 1.1, 0.1]} />
        <meshStandardMaterial color="#2a2a2e" />
      </mesh>
      <mesh position={[0, 0.25, -0.1]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      {/* body */}
      <mesh position={[0, 1.05, -0.15]} castShadow>
        <boxGeometry args={[0.65, 0.9, 0.38]} />
        <meshStandardMaterial color="#3d6a8f" />
      </mesh>
      <mesh position={[0, 1.3, 0.04]}>
        <boxGeometry args={[0.18, 0.5, 0.02]} />
        <meshStandardMaterial color="#c8452f" />
      </mesh>
      {/* thighs + shins */}
      {[-0.17, 0.17].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.62, 0.15]}>
            <boxGeometry args={[0.24, 0.22, 0.6]} />
            <meshStandardMaterial color="#3a3530" />
          </mesh>
          <mesh position={[x, 0.3, 0.42]}>
            <boxGeometry args={[0.22, 0.6, 0.22]} />
            <meshStandardMaterial color="#3a3530" />
          </mesh>
        </group>
      ))}
      {/* arms resting on desk */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 1.08, 0.12]} rotation-x={-1.1}>
          <boxGeometry args={[0.18, 0.7, 0.18]} />
          <meshStandardMaterial color="#3d6a8f" />
        </mesh>
      ))}
      <mesh ref={head} position={[0, 1.78, -0.12]} castShadow>
        <sphereGeometry args={[0.27, 16, 12]} />
        <meshStandardMaterial color="#d9a77f" />
      </mesh>
      <mesh position={[0, 1.95, -0.16]}>
        <sphereGeometry args={[0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#3b2a1f" />
      </mesh>
      <Label name="Nate" y={2.35} />
    </group>
  );
}

// Aaron: Nate's brother — long black hair, paces the office wall to wall on the phone,
// with a little chat bubble that pops in and out every 3 seconds.
function Aaron() {
  const g = useRef<THREE.Group>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  useEffect(() => {
    const i = setInterval(() => setBubble((b) => (b ? null : randomLine(AARON_LINES))), 3000);
    return () => clearInterval(i);
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) {
      g.current.position.set(2.75 + Math.sin(t * 0.7) * 1.8, 0.35, 4.3);
      g.current.rotation.y = Math.cos(t * 0.7) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  });
  return (
    <group ref={g}>
      <Body shirt="#7a3f8f" bottom="#2a2a2e" hair="#141414" skin="#e0b48a" />
      <mesh position={[0, 1.55, -0.14]}>
        <boxGeometry args={[0.34, 0.55, 0.12]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <mesh position={[0, 1.15, -0.16]}>
        <boxGeometry args={[0.3, 0.4, 0.1]} />
        <meshStandardMaterial color="#141414" />
      </mesh>
      <Arm x={-0.35} color="#7a3f8f" skin="#e0b48a" rot={-2.5} />
      <Arm x={0.35} color="#7a3f8f" skin="#e0b48a" />
      <mesh position={[-0.15, 1.62, 0.12]}>
        <boxGeometry args={[0.08, 0.16, 0.04]} />
        <meshStandardMaterial color="#1e1e22" />
      </mesh>
      <Label name="Aaron" y={2.25} />
      {bubble && (
        <Html zIndexRange={[20, 0]} position={[0, 1.85, 0]} center distanceFactor={20}>
          <div className="pointer-events-none whitespace-nowrap rounded-lg border border-border bg-card px-2 py-0.5 text-xs text-foreground">
            {bubble}
          </div>
        </Html>
      )}
    </group>
  );
}

function Shop() {
  return (
    <group>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_HALF * 2, 0.24, BLOCK_HALF * 2]} />
        <meshStandardMaterial color="#b5ab9a" />
      </mesh>
      {/* back hall */}
      <mesh position={[0, 2.3, -1]} castShadow receiveShadow>
        <boxGeometry args={[11, 4.2, 4]} />
        <meshStandardMaterial color="#2f4a5c" />
      </mesh>
      {/* shop counter (left front) */}
      <mesh position={[-2.75, 2.3, 3]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 4.2, 4]} />
        <meshStandardMaterial color="#2f4a5c" />
      </mesh>
      <mesh position={[-2.75, 1.7, 5.05]}>
        <boxGeometry args={[4.4, 2.4, 0.1]} />
        <meshStandardMaterial color="#f8e3a8" emissive="#f0b860" emissiveIntensity={0.5} />
      </mesh>
      {/* office (right front, open glass front) */}
      <mesh position={[2.75, 0.3, 3]} receiveShadow>
        <boxGeometry args={[5.5, 0.1, 4]} />
        <meshStandardMaterial color="#8a6a4a" />
      </mesh>
      <mesh position={[5.45, 2.3, 3]} castShadow>
        <boxGeometry args={[0.1, 4.2, 4]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <mesh position={[0.05, 2.3, 3]}>
        <boxGeometry args={[0.1, 4.2, 4]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <mesh position={[2.75, 2.3, 1.02]}>
        <planeGeometry args={[5.3, 4]} />
        <meshStandardMaterial color="#e9e1cf" />
      </mesh>
      <mesh position={[2.75, 4.35, 3]} castShadow>
        <boxGeometry args={[5.5, 0.1, 4]} />
        <meshStandardMaterial color="#2f4a5c" />
      </mesh>
      <mesh position={[2.75, 2.3, 5]}>
        <planeGeometry args={[5.3, 4]} />
        <meshPhysicalMaterial color="#cfe6ee" transparent opacity={0.15} roughness={0} />
      </mesh>
      <pointLight position={[2.75, 3.8, 3.2]} intensity={6} distance={7} color="#fff1d6" />
      <Suspense fallback={null}>
        <Whiteboard />
      </Suspense>
      {/* desk */}
      <mesh position={[2.75, 1.15, 2.85]} castShadow>
        <boxGeometry args={[2.6, 0.08, 1.1]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      {[
        [-1.2, -0.45],
        [1.2, -0.45],
        [-1.2, 0.45],
        [1.2, 0.45],
      ].map(([x, z], i) => (
        <mesh key={i} position={[2.75 + x!, 0.73, 2.85 + z!]}>
          <boxGeometry args={[0.08, 0.8, 0.08]} />
          <meshStandardMaterial color="#4a3320" />
        </mesh>
      ))}
      <mesh position={[3.5, 1.4, 2.7]} rotation-y={-0.3}>
        <boxGeometry args={[0.7, 0.45, 0.04]} />
        <meshStandardMaterial color="#1e1e22" emissive="#4fb3c9" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[2.2, 1.24, 3.0]}>
        <cylinderGeometry args={[0.08, 0.07, 0.18]} />
        <meshStandardMaterial color="#c8452f" />
      </mesh>
      <OfficeMan />
      <Aaron />
      <mesh position={[0, 4.9, 1]} castShadow>
        <boxGeometry args={[11.6, 1, 8.6]} />
        <meshStandardMaterial color="#f2b53a" />
      </mesh>
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh key={i} position={[-4.85 + i * 1.4, 3.6, 5.6]} rotation-x={0.5} castShadow>
          <boxGeometry args={[1.4, 0.08, 2]} />
          <meshStandardMaterial color={i % 2 ? "#f4ead2" : "#c8452f"} />
        </mesh>
      ))}
      <group position={[0, 6.8, 3]} rotation-z={Math.PI / 2}>
        <mesh>
          <torusGeometry args={[0.8, 0.25, 8, 16]} />
          <meshStandardMaterial color="#f2b53a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -2, 0]}>
          <boxGeometry args={[0.35, 2.8, 0.35]} />
          <meshStandardMaterial color="#f2b53a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.4, -3, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.35]} />
          <meshStandardMaterial color="#f2b53a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <Html zIndexRange={[20, 0]} position={[0, 8.8, 3]} center distanceFactor={30}>
        <div className="whitespace-nowrap rounded bg-primary px-2 py-0.5 font-display text-lg tracking-wider text-primary-foreground">
          {BUSINESS}
        </div>
      </Html>
      <mesh position={[SHOP_DOOR.x, 0.03, SHOP_DOOR.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[3.4, 4, 32]} />
        <meshBasicMaterial color="#f2b53a" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function vanDecal() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 192;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f2b53a";
  g.textAlign = "center";
  g.font = "bold 32px sans-serif";
  g.fillText("TIM'S LOCK", 128, 42);
  g.fillText("& KEY", 128, 76);
  // gold key
  g.strokeStyle = "#c9a02c";
  g.lineWidth = 10;
  g.beginPath();
  g.arc(92, 130, 24, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(116, 130);
  g.lineTo(212, 130);
  g.moveTo(192, 130);
  g.lineTo(192, 154);
  g.moveTo(212, 130);
  g.lineTo(212, 154);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Van({
  group,
  upgraded,
  input,
  paused,
  technician,
}: {
  group: React.RefObject<THREE.Group | null>;
  upgraded: boolean;
  input: React.MutableRefObject<Input>;
  paused: boolean;
  technician?: Technician | undefined;
}) {
  const decal = useMemo(vanDecal, []);
  const flame = useRef<THREE.Group>(null);
  const lampMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#fff6d0",
        emissive: "#fff0b0",
        emissiveIntensity: 1,
      }),
    [],
  );
  const beam = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const n = nightAmount(clock.elapsedTime);
    if (flame.current) {
      flame.current.visible = upgraded && !paused && Object.values(input.current).some(Boolean);
      flame.current.scale.setScalar(0.85 + Math.sin(clock.elapsedTime * 45) * 0.15);
    }
    lampMat.emissiveIntensity = 1 + n * 2.5;
    if (beam.current) beam.current.intensity = n * 16;
  });
  return (
    <group ref={group}>
      <Suspense fallback={null}>
        <DeliveryModel upgraded={upgraded} {...(technician ? { tint: TECHNICIAN_STYLE[technician].van } : {})} />
        {technician && <group position={[0.4, 0.45, 0.9]} scale={0.43}><TechnicianModel name={technician} seated /></group>}
      </Suspense>
      {[
        [-0.6, 2.21],
        [0.6, 2.21],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x ?? 0, 0.9, z ?? 0]} material={lampMat}>
          <boxGeometry args={[0.4, 0.25, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0.65, 0.4, -1.95]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.09, 0.09, 0.4, 12]} />
        <meshStandardMaterial color="#92999f" metalness={0.9} roughness={0.2} />
      </mesh>
      <group ref={flame} position={[0.65, 0.4, -2.2]} visible={false}>
        <mesh position={[0, 0, -0.4]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.18, 0.9, 16]} />
          <meshBasicMaterial color="#ff7130" transparent opacity={0.85} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, -0.18]} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.09, 0.5, 16]} />
          <meshBasicMaterial color="#ffed9c" />
        </mesh>
        <pointLight intensity={2} distance={3} color="#ff7130" />
      </group>
      <mesh position={[0, 1.25, -2.16]} rotation-y={Math.PI}>
        <planeGeometry args={[1.7, 1.3]} />
        <meshBasicMaterial map={decal} transparent />
      </mesh>
      <pointLight ref={beam} position={[0, 1, 3.4]} intensity={0} distance={16} color="#ffe9b8" />
    </group>
  );
}

function Marker({ job, target }: { job: Job; target: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const info = JOB_INFO[job.type];
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 3 + Math.sin(clock.elapsedTime * 3 + job.id) * 0.3;
      ref.current.rotation.y += 0.03;
    }
  });
  return (
    <group position={[job.x, 0, job.y]}>
      <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.4, 3, 32]} />
        <meshBasicMaterial color={info.color} transparent opacity={target ? 0.95 : 0.6} />
      </mesh>
      <group ref={ref}>
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.7, 1.4, 4]} />
          <meshStandardMaterial color={info.color} emissive={info.color} emissiveIntensity={0.5} />
        </mesh>
      </group>
      <Html zIndexRange={[20, 0]} position={[0, 5, 0]} center distanceFactor={28}>
        <div
          className={`pointer-events-none rounded-full bg-card px-2 py-0.5 text-xl ${target ? "ring-2 ring-primary" : ""}`}
        >
          {info.icon}
        </div>
      </Html>
    </group>
  );
}

function Sim({
  jobs,
  technician,
  rivalNames = RIVAL_NAMES,
  targetId,
  paused,
  speedMul,
  input,
  onArrive,
  onShop,
  onEvent,
  resetKey,
  popsTemper,
}: Props) {
  const van = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const s = useRef({
    x: 2.75,
    z: 11.5,
    h: Math.PI,
    v: 0,
    atShop: true,
    inter: null as string | null,
    tim: false,
    jimmy: false,
    pops: false,
  });
  const latest = useRef({ jobs, targetId, paused, speedMul, onArrive, onShop, onEvent });
  latest.current = { jobs, targetId, paused, speedMul, onArrive, onShop, onEvent };
  const cars = useMemo(() => makeTraffic(10), []);
  const rivalCars = useMemo<Car[]>(
    () =>
      rivalNames.map((name, i) => ({
        axis: (i ? "x" : "z") as Car["axis"],
        dir: (i ? 1 : -1) as 1 | -1,
        lane: (ROAD_LINES[i] ?? 10) + (i ? 1.6 : -1.6),
        pos: -WORLD_HALF + i * 40,
        v: CAR_SPEED,
        color: TECHNICIAN_STYLE[name as Technician]?.van ?? "#2fa36a",
      })),
    [rivalNames],
  );
  const rivalRefs = useRef<(THREE.Group | null)[]>([]);
  const carRefs = useRef<(THREE.Group | null)[]>([]);
  const jim = useRef({ x: -30, z: 10, next: JIMMY_RESPAWN });
  const jimG = useRef<THREE.Group>(null);
  const popsG = useRef<THREE.Group>(null);
  useEffect(() => {
    s.current.v = 0;
    resetGameInput();
    engine(0);
  }, [paused]);
  useEffect(() => {
    if (resetKey) Object.assign(s.current, { x: 2.75, z: 11.5, h: Math.PI, v: 0 });
  }, [resetKey]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, {
      __city: {
        get state() {
          return { ...s.current };
        },
        teleport: (x: number, z: number, h: number) =>
          Object.assign(s.current, { x, z, h, v: 0, inter: null }),
      },
    });
    return () => {
      Reflect.deleteProperty(window, "__city");
    };
  }, []);
  const { camera, gl } = useThree();
  const ready = useRef(false);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const L = latest.current;
    const st = s.current;
    // NPCs + traffic always run
    if (t > jim.current.next) {
      jim.current.next = t + JIMMY_RESPAWN;
      let x = 0,
        z = 0;
      do {
        const line = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)]!;
        const along = (Math.random() * 2 - 1) * (WORLD_HALF - 15);
        [x, z] = Math.random() < 0.5 ? [line, along] : [along, line];
      } while (Math.hypot(x, z - 5) < 18);
      jim.current.x = x;
      jim.current.z = z;
    }
    if (jimG.current) jimG.current.position.set(jim.current.x, 0, jim.current.z);
    const pp = popsPos(t);
    if (popsG.current) {
      popsG.current.position.set(pp.x, 0, pp.z);
      popsG.current.rotation.y = pp.face;
    }
    cars.forEach((c, i) => {
      stepCar(c, dt, t, st);
      const g = carRefs.current[i];
      if (g) {
        const p = carXZ(c);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = c.axis === "z" ? (c.dir > 0 ? 0 : Math.PI) : (c.dir * Math.PI) / 2;
      }
    });
    rivalCars.forEach((c, i) => {
      stepCar(c, dt, t, st);
      const g = rivalRefs.current[i];
      if (g) {
        const p = carXZ(c);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = c.axis === "z" ? (c.dir > 0 ? 0 : Math.PI) : (c.dir * Math.PI) / 2;
      }
    });
    engine(Math.abs(st.v) / 21);
    const inp = input.current;
    if (!L.paused) {
      const throttle = (inp.up ? 1 : 0) - (inp.down ? 1 : 0);
      const steer = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
      st.v += throttle * ACCEL * dt;
      st.v *= Math.exp(-DRAG * dt);
      st.v = Math.max(-REV, Math.min(MAX * L.speedMul, st.v));
      st.h += steer * TURN * dt * Math.max(-1, Math.min(1, st.v / 5));
      st.x += Math.sin(st.h) * st.v * dt;
      st.z += Math.cos(st.h) * st.v * dt;
      // Only walls are solid; curbs and lawns no longer block corner cuts.
      const p = buildingPush(st.x, st.z, VAN_R);
      if (p) {
        st.x = p.x;
        st.z = p.z;
        const dot = Math.sin(st.h) * p.nx + Math.cos(st.h) * p.nz;
        st.v *= 1 - 0.7 * Math.abs(dot);
      }
      // traffic + parked cars
      for (const o of [...cars.map(carXZ), ...PARKED]) {
        const dx = st.x - o.x,
          dz = st.z - o.z,
          d = Math.hypot(dx, dz);
        if (d < 2.4 && d > 0.001) {
          st.x = o.x + (dx / d) * 2.4;
          st.z = o.z + (dz / d) * 2.4;
          st.v *= -0.3;
        }
      }
      // sandbox encounters
      let inter: string | null = null;
      for (const a of ROAD_LINES)
        for (const b of ROAD_LINES)
          if (Math.abs(st.x - a) < 3 && Math.abs(st.z - b) < 3) inter = `${a},${b}`;
      if (inter !== st.inter) {
        if (inter && Math.abs(st.v) > 2) {
          const axis = Math.abs(Math.sin(st.h)) > Math.abs(Math.cos(st.h)) ? "x" : "z";
          const [x, z] = inter.split(",").map(Number);
          if (isRedViolation(axis, t, x ?? 0, z ?? 0)) L.onEvent("red");
        }
        st.inter = inter;
      }
      const pp = popsPos(t);
      const near = {
        tim: Math.hypot(st.x - TIM_POS.x, st.z - TIM_POS.z) < NPC_R,
        jimmy: Math.hypot(st.x - jim.current.x, st.z - jim.current.z) < NPC_R,
        pops: Math.hypot(st.x - pp.x, st.z - pp.z) < NPC_R,
      };
      for (const k of ["tim", "jimmy", "pops"] as const) {
        if (near[k] && !st[k]) L.onEvent(k);
        st[k] = near[k];
      }
      st.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, st.x));
      st.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, st.z));
      for (const j of L.jobs)
        if (Math.hypot(j.x - st.x, j.y - st.z) < 3.2) {
          st.v = 0;
          L.onArrive(j.id);
          break;
        }
    } else st.v = 0;
    const atShop = Math.hypot(SHOP_DOOR.x - st.x, SHOP_DOOR.z - st.z) < 4.5;
    if (atShop !== st.atShop) {
      st.atShop = atShop;
      L.onShop(atShop);
    }

    if (van.current) {
      van.current.position.set(st.x, drivingSurfaceHeight(st.x, st.z), st.z);
      van.current.rotation.y = st.h;
    }
    const target = L.jobs.find((j) => j.id === L.targetId);
    if (arrow.current) {
      arrow.current.visible = !!target;
      arrow.current.position.set(st.x, 4, st.z);
      if (target) arrow.current.rotation.y = Math.atan2(target.x - st.x, target.y - st.z);
    }
    // chase cam: back off as far as possible without ending up inside a building
    let d = 13;
    const blocked = (x: number, z: number) =>
      BUILDING_COLLIDERS.some(
        (box) => Math.abs(x - box.x) < box.halfX + 0.6 && Math.abs(z - box.z) < box.halfZ + 0.6,
      );
    for (; d > 3; d -= 0.5)
      if (!blocked(st.x - Math.sin(st.h) * d, st.z - Math.cos(st.h) * d)) break;
    const want = new THREE.Vector3(
      st.x - Math.sin(st.h) * d,
      2.6 + d * 0.43,
      st.z - Math.cos(st.h) * d,
    );
    if (!ready.current) camera.position.copy(want);
    else camera.position.lerp(want, 1 - Math.exp(-3 * dt));
    camera.lookAt(st.x - Math.sin(st.h) * -4, 1.8, st.z - Math.cos(st.h) * -4);
    if (!ready.current) {
      ready.current = true;
      gl.domElement.parentElement?.parentElement?.setAttribute("data-scene-ready", "1");
    }
  });

  return (
    <>
      <Van group={van} upgraded={speedMul > 1} input={input} paused={paused} technician={technician} />
      <group ref={arrow}>
        <mesh rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.5, 1.4, 3]} />
          <meshStandardMaterial color="#f2b53a" emissive="#f2b53a" emissiveIntensity={0.6} />
        </mesh>
      </group>
      {jobs.map((j) => (
        <Marker key={j.id} job={j} target={j.id === targetId} />
      ))}
      {cars.map((c, i) => (
        <TrafficCar
          key={i}
          color={c.color}
          gref={(g) => {
            carRefs.current[i] = g;
          }}
        />
      ))}
      {rivalCars.map((c, i) => (
        <group
          key={`r${i}`}
          ref={(g) => {
            rivalRefs.current[i] = g;
          }}
        >
          <Suspense fallback={null}>
            <DeliveryModel upgraded={false} tint={c.color} />
          </Suspense>
          <Label name={rivalNames[i] ?? "Technician"} y={3.4} color="bg-primary text-primary-foreground" />
        </group>
      ))}
      <group ref={jimG}>
        <Jimmy />
      </group>
      <group ref={popsG}>
        <Pops temper={popsTemper} />
      </group>
    </>
  );
}

const DAY_SKY = new THREE.Color("#b9d4e2");
const NIGHT_SKY = new THREE.Color("#131c33");

// Day/night: one full cycle per DAY_LENGTH seconds — sky, fog, sun and street glow all follow it.
function Sky() {
  const { scene, gl, camera } = useThree();
  const shadowTime = useRef(0);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const bg = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    scene.background = bg;
    scene.fog = new THREE.Fog(bg.getHex(), 50, 120);
  }, [scene, bg]);
  useFrame(({ clock }, dt) => {
    const n = nightAmount(clock.elapsedTime);
    bg.copy(DAY_SKY).lerp(NIGHT_SKY, n);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(bg);
    if (hemi.current) hemi.current.intensity = 0.8 - n * 0.4;
    if (sun.current) {
      sun.current.intensity = 2.2 - n * 1.9;
      sun.current.color.set(n > 0.5 ? "#9db4e0" : "#ffd8a0");
      const phase = (clock.elapsedTime / 240) * Math.PI * 2;
      const focusX = Math.round(camera.position.x / 4) * 4,
        focusZ = Math.round(camera.position.z / 4) * 4;
      sun.current.position.set(
        focusX + Math.cos(phase) * 28,
        20 + Math.abs(Math.sin(phase)) * 24,
        focusZ + Math.sin(phase) * 24,
      );
      sun.current.target.position.set(focusX, 0, focusZ);
      sun.current.target.updateMatrixWorld();
      shadowTime.current += dt;
      if (shadowTime.current >= GRAPHICS.shadowInterval) {
        shadowTime.current = 0;
        gl.shadowMap.needsUpdate = true;
      }
    }
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={["#ffe6c0", "#5a4a3a", 0.7]} />
      <directionalLight
        ref={sun}
        position={[30, 40, 15]}
        intensity={2.2}
        color="#ffd8a0"
        castShadow
        shadow-mapSize={[GRAPHICS.shadowMap, GRAPHICS.shadowMap]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.06}
        shadow-radius={GRAPHICS.shadowRadius}
        shadow-camera-left={-GRAPHICS.shadowRange}
        shadow-camera-right={GRAPHICS.shadowRange}
        shadow-camera-top={GRAPHICS.shadowRange}
        shadow-camera-bottom={-GRAPHICS.shadowRange}
        shadow-camera-near={1}
        shadow-camera-far={100}
      />
    </>
  );
}

export function City3D(props: Props) {
  const paused = useRef(props.paused);
  paused.current = props.paused;
  useEffect(() => {
    const set = (v: boolean) => (e: KeyboardEvent) => {
      if (setDrivingKey(e.code, v, e.repeat, paused.current)) e.preventDefault();
    };
    const dn = set(true),
      upk = set(false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", upk);
    const hidden = () => {
      if (document.hidden) resetGameInput();
    };
    window.addEventListener("blur", resetGameInput);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      resetGameInput();
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", upk);
      window.removeEventListener("blur", resetGameInput);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [props.input]);

  return (
    <Canvas
      frameloop={props.freezeScene ? "never" : "always"}
      shadows="soft"
      dpr={GRAPHICS.pixelRatio}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
      }}
      camera={{ fov: 55, position: [-10, 8, 13] }}
    >
      <SteadySceneClock />
      <Sky />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer
          intensity={1}
          color="#ffb070"
          position={[-5, 1, -1]}
          rotation-y={Math.PI / 2}
          scale={[20, 1, 1]}
        />
      </Environment>
      <Suspense fallback={null}>
        <CityEnvironment />
      </Suspense>
      <Suspense fallback={null}>
        <CitySurfaces>
          <LoadedCity {...props} />
          <CityMaterialDefaults />
        </CitySurfaces>
      </Suspense>
      <CityWeather />
      <CityEffects />
    </Canvas>
  );
}

function LoadedCity(props: Props) {
  useCityModels();
  // Finish model loading before any projected labels mount, avoiding nested root cleanup races.
  return (
    <>
      <City />
      <Sim {...props} />
    </>
  );
}

function Label({ name, y = 2.6, color = "bg-card" }: { name: string; y?: number; color?: string }) {
  return (
    <Html zIndexRange={[20, 0]} occlude position={[0, y, 0]} center distanceFactor={22}>
      <div
        className={`pointer-events-none whitespace-nowrap rounded px-2 py-0.5 font-display text-sm tracking-wide text-foreground ${color}`}
      >
        {name}
      </div>
    </Html>
  );
}

function Ring({ color }: { color: string }) {
  return (
    <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[2.3, 2.8, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
}

function Body({
  shirt,
  bottom,
  shorts,
  skin = "#e0a982",
  hair,
  shoes = "#f2f2f2",
  hunch = 0,
}: {
  shirt: string;
  bottom: string;
  shorts?: boolean;
  skin?: string;
  hair: string;
  shoes?: string;
  hunch?: number;
}) {
  return (
    <group>
      {[-0.13, 0.13].map((x) => (
        <group key={x}>
          <mesh position={[x, shorts ? 0.75 : 0.5, 0]} castShadow>
            <boxGeometry args={[0.2, shorts ? 0.32 : 0.82, 0.22]} />
            <meshStandardMaterial color={bottom} />
          </mesh>
          {shorts && (
            <mesh position={[x, 0.38, 0]}>
              <boxGeometry args={[0.15, 0.45, 0.15]} />
              <meshStandardMaterial color={skin} />
            </mesh>
          )}
          {shorts && (
            <mesh position={[x, 0.17, 0]}>
              <boxGeometry args={[0.16, 0.14, 0.16]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
          )}
          <mesh position={[x, 0.05, 0.05]}>
            <boxGeometry args={[0.2, 0.1, 0.32]} />
            <meshStandardMaterial color={shoes} />
          </mesh>
        </group>
      ))}
      <group rotation-x={hunch} position={[0, 0.9, 0]}>
        <mesh position={[0, 0.33, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.28, 4, 10]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.2, 14, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 0.95, -0.02]}>
          <sphereGeometry args={[0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={hair} />
        </mesh>
      </group>
    </group>
  );
}

function Arm({
  x,
  color,
  skin = "#e0a982",
  rot = 0,
  children,
  aref,
}: {
  x: number;
  color: string;
  skin?: string;
  rot?: number;
  children?: React.ReactNode;
  aref?: React.Ref<THREE.Group>;
}) {
  return (
    <group ref={aref ?? null} position={[x, 1.48, 0]} rotation-x={rot}>
      <mesh position={[0, -0.12, 0]}>
        <capsuleGeometry args={[0.085, 0.12, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <capsuleGeometry args={[0.065, 0.25, 4, 8]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {children}
    </group>
  );
}

// Tim: grey-brown hair, glasses, white goatee, lime tee, khaki cargo shorts, white sneakers.
function Tim() {
  const arm = useRef<THREE.Group>(null),
    cig = useRef<THREE.Mesh>(null),
    smoke = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime,
      on = timSmoking(t);
    timAnimationState.smoking = on;
    timAnimationState.elapsed = t;
    if (arm.current) arm.current.rotation.x = on ? -2.2 + Math.sin(t * 0.7) * 0.35 : 0;
    if (cig.current) cig.current.visible = on;
    if (smoke.current) {
      smoke.current.visible = on;
      smoke.current.children.forEach((c, i) => {
        const p = (t * 0.4 + i / 4) % 1;
        c.position.set(0.15 + p * 0.3, p * 1.4, 0.25);
        c.scale.setScalar(0.08 + p * 0.25);
        ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - p);
      });
    }
  });
  return (
    <group position={[TIM_POS.x, 0.24, TIM_POS.z]} rotation-y={0.5}>
      <Ring color="#9be03a" />
      <Body shirt="#9be03a" bottom="#a08a64" shorts hair="#7d6e5e" />
      <mesh position={[0, 1.67, 0.17]}>
        <boxGeometry args={[0.36, 0.06, 0.03]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0, 1.6, 0.18]}>
        <boxGeometry args={[0.12, 0.1, 0.06]} />
        <meshStandardMaterial color="#e8e6e0" />
      </mesh>
      <Arm x={-0.35} color="#9be03a" />
      <Arm x={0.35} color="#9be03a" aref={arm}>
        <mesh ref={cig} position={[0, -0.64, 0.06]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.015, 0.015, 0.16]} />
          <meshStandardMaterial color="#f8f6f0" emissive="#ff6020" emissiveIntensity={0.2} />
        </mesh>
      </Arm>
      <group ref={smoke} position={[0, 1.7, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#dddddd" transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
      <Label name="Tim" />
    </group>
  );
}

function Jimmy() {
  const club = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (club.current) club.current.rotation.z = Math.sin(clock.elapsedTime * 2) * 0.5;
  });
  return (
    <group>
      <Ring color="#e8603c" />
      <Body shirt="#f08bb0" bottom="#2c3e6b" hair="#4a3524" shoes="#ffffff" />
      <mesh position={[0, 1.88, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.1, 14]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 1.84, 0.2]}>
        <boxGeometry args={[0.3, 0.03, 0.2]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Arm x={-0.35} color="#f08bb0" />
      <Arm x={0.35} color="#f08bb0" rot={-0.3}>
        <group ref={club} position={[0, -0.6, 0]}>
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.1]} />
            <meshStandardMaterial color="#bfc4c8" metalness={0.8} />
          </mesh>
          <mesh position={[0.06, -1.05, 0]}>
            <boxGeometry args={[0.18, 0.08, 0.1]} />
            <meshStandardMaterial color="#555b60" metalness={0.8} />
          </mesh>
        </group>
      </Arm>
      <Label name="Jimmy ⛳" />
    </group>
  );
}

function Pops({ temper }: { temper: number }) {
  return (
    <group>
      <Ring color={temper > 50 ? "#d4483b" : "#f2b53a"} />
      <Body
        shirt="#7a5a3c"
        bottom="#6d6a66"
        hair="#d8d8d4"
        shoes="#3a2a20"
        skin="#d9a98a"
        hunch={0.25}
      />
      <Arm x={-0.35} color="#7a5a3c" skin="#d9a98a" />
      <Arm x={0.35} color="#7a5a3c" skin="#d9a98a" rot={-0.25}>
        <mesh position={[0, -0.85, 0.05]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9]} />
          <meshStandardMaterial color="#4a3320" />
        </mesh>
      </Arm>
      <Label name={`Pops ${temper > 50 ? "😠" : "🙂"}`} />
    </group>
  );
}

function TrafficCar({ color, gref }: { color: string; gref: (g: THREE.Group | null) => void }) {
  return (
    <group ref={gref}>
      <RoundedBox
        args={[1.7, 0.7, 3.6]}
        radius={0.18}
        smoothness={2}
        position={[0, 0.65, 0]}
        castShadow
      >
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 1.25, -0.2]} castShadow>
        <boxGeometry args={[1.5, 0.55, 1.9]} />
        <meshStandardMaterial color="#2a3a48" metalness={0.5} roughness={0.2} />
      </mesh>
      {[
        [-0.85, 1.2],
        [0.85, 1.2],
        [-0.85, -1.2],
        [0.85, -1.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x!, 0.35, z!]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 10]} />
          <meshStandardMaterial color="#1e1c1b" />
        </mesh>
      ))}
    </group>
  );
}

function ParkingLot() {
  return (
    <group position={[PARKING.x, 0, PARKING.z]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_HALF * 2, 0.12, BLOCK_HALF * 2]} />
        <meshStandardMaterial color="#4a4744" roughness={0.95} />
      </mesh>
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={x} position={[x, 0.13, -3.5]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.15, 4.5]} />
          <meshBasicMaterial color="#f4f0e4" />
        </mesh>
      ))}
      {PARKED.map((p, i) => (
        <group key={i} position={[p.x - PARKING.x, 0.1, p.z - PARKING.z]}>
          <TrafficCar color={["#3f6fb0", "#e8e2d4", "#5a8f5a", "#d4483b"][i]!} gref={() => {}} />
        </group>
      ))}
      <mesh position={[-6, 1.5, 6]}>
        <boxGeometry args={[0.12, 3, 0.12]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      <mesh position={[-6, 3, 6]}>
        <boxGeometry args={[1.2, 1.2, 0.08]} />
        <meshStandardMaterial color="#2f5fa8" />
      </mesh>
      <Html zIndexRange={[20, 0]} position={[-6, 3, 6.1]} center distanceFactor={22}>
        <div className="pointer-events-none font-display text-xl text-primary-foreground">P</div>
      </Html>
    </group>
  );
}

function Head({
  mats,
  rotationY,
}: {
  mats: {
    red: THREE.MeshStandardMaterial;
    yellow: THREE.MeshStandardMaterial;
    green: THREE.MeshStandardMaterial;
  };
  rotationY: number;
}) {
  return (
    <group rotation-y={rotationY}>
      <mesh position={[0, 4.3, 0.28]}>
        <boxGeometry args={[0.55, 1.7, 0.35]} />
        <meshStandardMaterial color="#1c1c20" />
      </mesh>
      <mesh position={[0, 4.85, 0.47]} material={mats.red}>
        <circleGeometry args={[0.2, 16]} />
      </mesh>
      <mesh position={[0, 4.3, 0.47]} material={mats.yellow}>
        <circleGeometry args={[0.2, 16]} />
      </mesh>
      <mesh position={[0, 3.75, 0.47]} material={mats.green}>
        <circleGeometry args={[0.2, 16]} />
      </mesh>
    </group>
  );
}

function TrafficLights() {
  const mats = useMemo(() => {
    const mk = (c: string) =>
      new THREE.MeshStandardMaterial({
        color: "#141619",
        emissive: c,
        emissiveIntensity: 0.02,
        side: THREE.FrontSide,
      });
    return {
      z: { red: mk("#e83a2a"), yellow: mk("#f2b53a"), green: mk("#3ad06a") },
      x: { red: mk("#e83a2a"), yellow: mk("#f2b53a"), green: mk("#3ad06a") },
    };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const ax of ["z", "x"] as const) {
      const s = lightState(ax, t);
      mats[ax].red.color.set(s === "red" ? "#e83a2a" : "#241719");
      mats[ax].yellow.color.set(s === "yellow" ? "#f2b53a" : "#242117");
      mats[ax].green.color.set(s === "green" ? "#3ad06a" : "#17241b");
      mats[ax].red.emissiveIntensity = s === "red" ? 1.8 : 0.05;
      mats[ax].yellow.emissiveIntensity = s === "yellow" ? 1.8 : 0.05;
      mats[ax].green.emissiveIntensity = s === "green" ? 1.8 : 0.05;
    }
  });
  const spots = SIGNAL_JUNCTIONS;
  return (
    <group>
      {spots.map(({ x, z }) => (
        <group key={`${x},${z}`} position={[x, 0, z]}>
          <mesh position={[4.2, 2.6, -4.2]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, 5.2, 12]} />
            <meshStandardMaterial color="#2a2a2e" />
          </mesh>
          <mesh position={[0, 5.1, 0]} rotation-y={Math.PI / 4}>
            <boxGeometry args={[12, 0.12, 0.12]} />
            <meshStandardMaterial color="#2a2a2e" />
          </mesh>
          {([1, -1] as const).map((dir) => (
            <group key={dir} position={[dir * 4.2, 0, -dir * 4.2]}>
              <Head mats={mats.z} rotationY={signalFacing("z", dir)} />
              <Head mats={mats.x} rotationY={signalFacing("x", -dir as 1 | -1)} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Scene time survives dialogs, paused frames and canvas remounts, and never jumps. */
function SteadySceneClock() {
  useFrame(({ clock }, delta) => {
    sceneTime.seconds += Math.min(delta, 0.05);
    clock.elapsedTime = sceneTime.seconds;
  }, -100);
  return null;
}
