import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BLOCK_HALF,
  DOWNTOWN_PARK,
  FOUNTAIN,
  LOTS,
  STADIUM,
  WORLD_HALF,
  nightAmount,
  type Lot,
} from "@/lib/game";
import { GRAPHICS } from "@/lib/graphics";
import { TreeModel } from "@/components/CityModels";
import mLogo from "@/assets/stadium/biscuits_m_logo.png.asset.json";
import mBlue from "@/assets/stadium/biscuits_m_blue.jpg.asset.json";
import wordmark from "@/assets/stadium/biscuits_wordmark.png.asset.json";
import montgomery from "@/assets/stadium/biscuits_montgomery.jpg.asset.json";

const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** Night window glow is shared by every downtown emissive material. */
function useNightGlow(materials: THREE.MeshStandardMaterial[], day: number, night: number) {
  useFrame(({ clock }) => {
    const n = nightAmount(clock.elapsedTime);
    for (const m of materials) m.emissiveIntensity = day + n * night;
  });
}

export function Downtown({ roadMaterial }: { roadMaterial: THREE.Material }) {
  return (
    <group name="downtown">
      <RingRoad roadMaterial={roadMaterial} />
      <Fountain />
      <Park />
      <Towers />
      <Storefronts />
      <Suspense fallback={null}>
        <Stadium />
      </Suspense>
    </group>
  );
}

// ---------- Fountain roundabout ----------
function RingRoad({ roadMaterial }: { roadMaterial: THREE.Material }) {
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(FOUNTAIN.roadInner, FOUNTAIN.roadOuter, 80);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position"),
      uv = g.getAttribute("uv");
    for (let i = 0; i < uv.count; i++)
      uv.setXY(
        i,
        (pos.getX(i) + FOUNTAIN.x) / (WORLD_HALF * 2 + 40) + 0.5,
        0.5 - (pos.getZ(i) + FOUNTAIN.z) / (WORLD_HALF * 2 + 40),
      );
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const radius = (FOUNTAIN.roadInner + FOUNTAIN.roadOuter) / 2;
  return (
    <group>
      <mesh
        position={[FOUNTAIN.x, 0.008, FOUNTAIN.z]}
        geometry={geometry}
        material={roadMaterial}
        receiveShadow
      />
      {Array.from({ length: 48 }, (_, i) => {
        const a = (i * Math.PI * 2) / 48;
        if (Math.abs(Math.sin(a)) < 0.24 || Math.abs(Math.cos(a)) < 0.24) return null;
        return (
          <mesh
            key={i}
            position={[FOUNTAIN.x + Math.cos(a) * radius, 0.025, FOUNTAIN.z + Math.sin(a) * radius]}
            rotation={[-Math.PI / 2, 0, -a]}
          >
            <planeGeometry args={[0.16, 0.75]} />
            <meshBasicMaterial color="#e8d9a8" />
          </mesh>
        );
      })}
    </group>
  );
}

function Fountain() {
  const island = useMemo(
    () =>
      canvasTexture(1024, 1024, (g) => {
        const c = 512,
          s = 512 / FOUNTAIN.roadInner;
        g.fillStyle = "#a8a297";
        g.fillRect(0, 0, 1024, 1024);
        // Painted plaza band, after the colourful street mural around Court Square.
        const colors = ["#f2c230", "#43c463", "#e0407a", "#222222", "#f2c230", "#f08a2c"];
        for (let i = 0; i < 28; i++) {
          g.beginPath();
          g.moveTo(c, c);
          g.arc(c, c, 7.8 * s, (i / 28) * Math.PI * 2, ((i + 1) / 28) * Math.PI * 2);
          g.closePath();
          g.fillStyle = colors[Math.floor(rnd() * colors.length)]!;
          g.fill();
        }
        g.beginPath();
        g.arc(c, c, 6.6 * s, 0, Math.PI * 2);
        g.fillStyle = "#b9b2a5";
        g.fill();
        g.beginPath();
        g.arc(c, c, 6.2 * s, 0, Math.PI * 2);
        g.fillStyle = "#5a3b28";
        g.fill();
        for (let i = 0; i < 3000; i++) {
          g.fillStyle = rnd() > 0.5 ? "#6b4630" : "#47301f";
          const a = rnd() * Math.PI * 2,
            r = rnd() * 6.2 * s;
          g.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 3, 3);
        }
      }),
    [],
  );
  const streaks = useMemo(() => {
    const t = canvasTexture(64, 256, (g) => {
      g.clearRect(0, 0, 64, 256);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(235,250,255,${0.25 + rnd() * 0.6})`;
        g.fillRect(rnd() * 64, rnd() * 256, 1 + rnd() * 2, 20 + rnd() * 60);
      }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    return t;
  }, []);
  const water = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2fcf9c",
        emissive: "#0d6b55",
        emissiveIntensity: 0.4,
        roughness: 0.08,
        metalness: 0.2,
      }),
    [],
  );
  const patina = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3f5d52",
        metalness: 0.55,
        roughness: 0.45,
        envMapIntensity: GRAPHICS.environmentIntensity,
      }),
    [],
  );
  const posts = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * 6.0, 0.8, Math.sin(a) * 6.0);
      posts.current?.setMatrixAt(i, m);
    }
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame((_, delta) => {
    streaks.offset.y -= Math.min(delta, 0.05) * 1.4;
  });
  useEffect(
    () => () => {
      island.dispose();
      streaks.dispose();
      water.dispose();
      patina.dispose();
    },
    [island, streaks, water, patina],
  );
  const curtain = (r1: number, r2: number, top: number, bottom: number) => (
    <mesh position={[0, (top + bottom) / 2, 0]}>
      <cylinderGeometry args={[r1, r2, top - bottom, 32, 1, true]} />
      <meshBasicMaterial
        map={streaks}
        transparent
        opacity={0.75}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
  return (
    <group name="court-square-fountain" position={[FOUNTAIN.x, 0, FOUNTAIN.z]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[FOUNTAIN.roadInner, FOUNTAIN.roadInner, 0.24, 80]} />
        <meshStandardMaterial color="#9c968c" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.246, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[FOUNTAIN.roadInner, 80]} />
        <meshStandardMaterial map={island} roughness={0.9} />
      </mesh>
      {/* basin */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[FOUNTAIN.basin, FOUNTAIN.basin + 0.1, 0.7, 48, 1, true]} />
        <meshStandardMaterial color="#cfc8ba" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[FOUNTAIN.basin, 0.16, 8, 64]} />
        <meshStandardMaterial color="#e2dccf" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.72, 0]} rotation-x={-Math.PI / 2} material={water}>
        <circleGeometry args={[FOUNTAIN.basin - 0.05, 48]} />
      </mesh>
      {/* wrought-iron fence */}
      <instancedMesh ref={posts} args={[undefined, undefined, 90]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.1, 4]} />
        <meshStandardMaterial color="#141414" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      {[0.5, 1.3].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[6.0, 0.035, 6, 96]} />
          <meshStandardMaterial color="#141414" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* tiered bronze fountain */}
      <group>
        <mesh position={[0, 1.2, 0]} material={patina} castShadow>
          <cylinderGeometry args={[1.0, 1.4, 1.0, 8]} />
        </mesh>
        <mesh position={[0, 2.4, 0]} material={patina} castShadow>
          <cylinderGeometry args={[0.45, 0.75, 1.5, 8]} />
        </mesh>
        <mesh position={[0, 3.35, 0]} material={patina} castShadow>
          <cylinderGeometry args={[2.7, 0.9, 0.6, 8]} />
        </mesh>
        <mesh position={[0, 4.3, 0]} material={patina} castShadow>
          <cylinderGeometry args={[0.28, 0.42, 1.4, 8]} />
        </mesh>
        <mesh position={[0, 5.15, 0]} material={patina} castShadow>
          <cylinderGeometry args={[1.5, 0.55, 0.45, 8]} />
        </mesh>
        <mesh position={[0, 5.8, 0]} material={patina} castShadow>
          <cylinderGeometry args={[0.18, 0.3, 0.9, 8]} />
        </mesh>
        {/* figure on top with a raised arm */}
        <mesh position={[0, 6.65, 0]} material={patina} castShadow>
          <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
        </mesh>
        <mesh position={[0, 7.25, 0]} material={patina}>
          <sphereGeometry args={[0.16, 10, 10]} />
        </mesh>
        <mesh position={[0.2, 7.3, 0]} rotation-z={-0.5} material={patina}>
          <cylinderGeometry args={[0.05, 0.05, 0.7, 6]} />
        </mesh>
        {/* cherubs */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2,
            upper = i % 2 === 0,
            r = upper ? 1.9 : 1.25,
            y = upper ? 3.85 : 1.95;
          return (
            <group key={i} position={[Math.cos(a) * r, y, Math.sin(a) * r]}>
              <mesh material={patina}>
                <sphereGeometry args={[0.22, 10, 10]} />
              </mesh>
              <mesh position={[0, 0.32, 0]} material={patina}>
                <sphereGeometry args={[0.14, 10, 10]} />
              </mesh>
            </group>
          );
        })}
        {curtain(2.7, 3.2, 3.5, 0.75)}
        {curtain(1.5, 1.9, 5.3, 3.65)}
        <mesh position={[0, 7.9, 0]}>
          <coneGeometry args={[0.12, 1.2, 8, 1, true]} />
          <meshBasicMaterial color="#e6f8ff" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---------- Park across the street ----------
function Park() {
  const lamp = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fff2c8", emissive: "#ffd98a" }),
    [],
  );
  useNightGlow([lamp], 0.1, 2.5);
  const trees: [number, number][] = [
    [-4.6, -4.6],
    [4.6, -4.6],
    [-4.6, 4.2],
    [4.6, 4.2],
    [-1.8, -5.2],
    [5.2, 0.6],
  ];
  return (
    <group name="downtown-park" position={[DOWNTOWN_PARK.x, 0, DOWNTOWN_PARK.z]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_HALF * 2, 0.24, BLOCK_HALF * 2]} />
        <meshStandardMaterial color="#9c968c" />
      </mesh>
      <mesh position={[0, 0.3, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_HALF * 2 - 1.2, 0.1, BLOCK_HALF * 2 - 1.2]} />
        <meshStandardMaterial color="#5f9a4a" roughness={1} />
      </mesh>
      {[0, Math.PI / 2].map((r) => (
        <mesh key={r} position={[0, 0.36, 0]} rotation-y={r} receiveShadow>
          <boxGeometry args={[BLOCK_HALF * 2 - 1.2, 0.02, 1.4]} />
          <meshStandardMaterial color="#d6c9a8" roughness={1} />
        </mesh>
      ))}
      {/* gazebo */}
      <mesh position={[0, 0.5, 0]} receiveShadow>
        <cylinderGeometry args={[2.2, 2.3, 0.3, 8]} />
        <meshStandardMaterial color="#e8e2d6" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.9, 1.7, Math.sin(a) * 1.9]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 2.2, 6]} />
            <meshStandardMaterial color="#f4f0e6" />
          </mesh>
        );
      })}
      <mesh position={[0, 3.3, 0]} castShadow>
        <coneGeometry args={[2.6, 1.2, 8]} />
        <meshStandardMaterial color="#3e6b5a" roughness={0.6} />
      </mesh>
      {/* benches */}
      {[
        [0, 3.2, 0],
        [0, -3.2, 0],
        [3.2, 0, Math.PI / 2],
        [-3.2, 0, Math.PI / 2],
      ].map(([x, z, r], i) => (
        <group key={i} position={[x!, 0.35, z!]} rotation-y={r}>
          <mesh position={[1.6, 0.35, 0]} castShadow>
            <boxGeometry args={[1.6, 0.08, 0.45]} />
            <meshStandardMaterial color="#8a5a34" />
          </mesh>
          <mesh position={[1.6, 0.65, -0.2]}>
            <boxGeometry args={[1.6, 0.4, 0.06]} />
            <meshStandardMaterial color="#8a5a34" />
          </mesh>
        </group>
      ))}
      {/* lamps */}
      {[
        [-1.2, -1.2],
        [1.2, 1.2],
        [-1.2, 5.5],
        [1.2, -5.5],
      ].map(([x, z], i) => (
        <group key={i} position={[x! * (i < 2 ? 4 : 1), 0.35, z! * (i < 2 ? 4 : 1)]}>
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 2.8, 6]} />
            <meshStandardMaterial color="#1b1b1b" />
          </mesh>
          <mesh position={[0, 2.9, 0]} material={lamp}>
            <sphereGeometry args={[0.2, 10, 10]} />
          </mesh>
        </group>
      ))}
      <Suspense fallback={null}>
        {trees.map(([x, z]) => (
          <TreeModel key={`${x},${z}`} x={x} z={z} />
        ))}
      </Suspense>
    </group>
  );
}

// ---------- Skyscrapers ----------
function facadeTextures() {
  const cols = 4,
    rows = 4;
  const map = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#e8ecef";
    g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const shade = 30 + Math.floor(rnd() * 40);
        g.fillStyle = `rgb(${shade},${shade + 20},${shade + 45})`;
        g.fillRect(c * 64 + 5, r * 64 + 8, 54, 48);
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.fillRect(c * 64 + 5, r * 64 + 8, 54, 10);
      }
  });
  const glow = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (rnd() > 0.45) {
          g.fillStyle = rnd() > 0.3 ? "#ffd894" : "#cfe6ff";
          g.fillRect(c * 64 + 5, r * 64 + 8, 54, 48);
        }
  });
  for (const t of [map, glow]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, glow };
}

const TOWER_W = 10;
const FLOOR_TILE = 12; // world height covered by one 4-floor tile

function Towers() {
  const base = useMemo(facadeTextures, []);
  const towers = useMemo(() => LOTS.filter((l) => l.kind === "tower"), []);
  const materials = useMemo(
    () =>
      towers.map((l, i) => {
        const map = base.map.clone(),
          glow = base.glow.clone();
        const w = i % 3 === 0 ? TOWER_W - 1 : TOWER_W;
        for (const t of [map, glow]) {
          t.repeat.set(w / 10, l.h / FLOOR_TILE);
          t.offset.set(0, i * 0.37);
          t.needsUpdate = true;
        }
        return new THREE.MeshStandardMaterial({
          color: l.color,
          map,
          emissiveMap: glow,
          emissive: "#ffffff",
          emissiveIntensity: 0.05,
          metalness: 0.5,
          roughness: 0.28,
          envMapIntensity: GRAPHICS.environmentIntensity,
        });
      }),
    [base, towers],
  );
  useNightGlow(materials, 0.05, 1.3);
  useEffect(
    () => () => {
      base.map.dispose();
      base.glow.dispose();
      for (const m of materials) {
        m.map?.dispose();
        m.emissiveMap?.dispose();
        m.dispose();
      }
    },
    [base, materials],
  );
  return (
    <group name="downtown-towers">
      {towers.map((l, i) => (
        <Tower key={l.address} lot={l} material={materials[i]!} index={i} />
      ))}
    </group>
  );
}

function Tower({ lot, material, index }: { lot: Lot; material: THREE.Material; index: number }) {
  const w = index % 3 === 0 ? TOWER_W - 1 : TOWER_W;
  const style = index % 4;
  return (
    <group position={[lot.cx, 0, lot.cz]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_HALF * 2, 0.24, BLOCK_HALF * 2]} />
        <meshStandardMaterial color="#b3ada2" />
      </mesh>
      <mesh position={[0, lot.h / 2 + 0.24, 0]} material={material} castShadow receiveShadow>
        <boxGeometry args={[w, lot.h, w]} />
      </mesh>
      {/* lobby canopy + entrance */}
      <mesh position={[0, 3.2, w / 2 + 0.6]} castShadow>
        <boxGeometry args={[5, 0.25, 1.4]} />
        <meshStandardMaterial color="#2b2f36" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.6, w / 2 + 0.02]}>
        <planeGeometry args={[3.4, 2.8]} />
        <meshStandardMaterial color="#9fc4d6" metalness={0.3} roughness={0.15} />
      </mesh>
      {style === 0 && (
        <>
          <mesh position={[0, lot.h + 3.24, 0]} material={material} castShadow>
            <boxGeometry args={[w * 0.65, 6, w * 0.65]} />
          </mesh>
          <mesh position={[0, lot.h + 9, 0]}>
            <cylinderGeometry args={[0.08, 0.2, 5.5, 6]} />
            <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.3} />
          </mesh>
        </>
      )}
      {style === 1 && (
        <mesh position={[0, lot.h + 2.7, 0]} rotation-y={Math.PI / 4} castShadow>
          <coneGeometry args={[w * 0.66, 5, 4]} />
          <meshStandardMaterial color="#4a6c7a" metalness={0.6} roughness={0.3} />
        </mesh>
      )}
      {style === 2 && (
        <mesh position={[0, lot.h + 0.6, 0]} castShadow>
          <boxGeometry args={[w + 0.5, 0.8, w + 0.5]} />
          <meshStandardMaterial color="#3a3f47" />
        </mesh>
      )}
      {style === 3 && (
        <>
          <mesh position={[0, lot.h + 2.2, 0]} material={material} castShadow>
            <boxGeometry args={[w * 0.8, 4, w * 0.8]} />
          </mesh>
          <mesh position={[0, lot.h + 5.4, 0]} material={material} castShadow>
            <boxGeometry args={[w * 0.5, 2.4, w * 0.5]} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ---------- Ordinary storefronts around downtown ----------
const SHOP_NAMES = [
  "Riverside Books",
  "Dexter Deli",
  "Corner Cafe",
  "Hank's Hardware",
  "Court Sq Pharmacy",
  "Alley Records",
  "Biscuit Bakery",
];
const AWNINGS = ["#b8433a", "#2f6a4f", "#24456e", "#c48a2a", "#6b3f78", "#3a7b8a", "#a3532f"];

function Storefronts() {
  const lots = useMemo(() => LOTS.filter((l) => l.kind === "storefront"), []);
  const textures = useMemo(
    () =>
      lots.map((_, i) => ({
        awning: canvasTexture(128, 64, (g) => {
          for (let s = 0; s < 8; s++) {
            g.fillStyle = s % 2 ? "#f4efe2" : AWNINGS[i % AWNINGS.length]!;
            g.fillRect(s * 16, 0, 16, 64);
          }
        }),
        sign: canvasTexture(512, 96, (g) => {
          g.fillStyle = "#1f2226";
          g.fillRect(0, 0, 512, 96);
          g.fillStyle = "#f5e2b0";
          g.font = "bold 52px Georgia, serif";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(SHOP_NAMES[i % SHOP_NAMES.length]!, 256, 50, 480);
        }),
      })),
    [lots],
  );
  useEffect(
    () => () => {
      for (const t of textures) {
        t.awning.dispose();
        t.sign.dispose();
      }
    },
    [textures],
  );
  return (
    <group name="downtown-storefronts">
      {lots.map((l, i) => (
        <group key={i} position={[l.cx, 0, l.cz]}>
          <mesh position={[0, 2.75, 5.15]} rotation-x={0.45} castShadow>
            <planeGeometry args={[7.2, 1.4]} />
            <meshStandardMaterial
              map={textures[i]!.awning}
              side={THREE.DoubleSide}
              roughness={0.9}
            />
          </mesh>
          <mesh position={[0, 3.75, 4.57]}>
            <planeGeometry args={[5.2, 0.95]} />
            <meshStandardMaterial
              map={textures[i]!.sign}
              emissiveMap={textures[i]!.sign}
              emissive="#ffffff"
              emissiveIntensity={0.3}
            />
          </mesh>
          {[-2.5, 2.5].map((x) => (
            <mesh key={x} position={[x, 1.2, 4.58]}>
              <planeGeometry args={[2, 1.6]} />
              <meshStandardMaterial color="#a9cbd8" metalness={0.3} roughness={0.15} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ---------- Riverwalk Stadium ----------
function Stadium() {
  const logos = useTexture([mLogo.url, wordmark.url, mBlue.url, montgomery.url]);
  useMemo(() => {
    for (const t of logos) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  }, [logos]);
  const [logoM, logoWord, logoBlue, logoMont] = logos as [
    THREE.Texture,
    THREE.Texture,
    THREE.Texture,
    THREE.Texture,
  ];
  const wall = useMemo(() => {
    const t = canvasTexture(512, 256, (g) => {
      g.fillStyle = "#9c4a36";
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = "rgba(60,25,15,0.35)";
      for (let y = 0; y < 256; y += 12) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(512, y);
        g.stroke();
      }
      g.fillStyle = "#2b1a14";
      for (let x = 0; x < 512; x += 128) {
        g.beginPath();
        g.moveTo(x + 24, 200);
        g.lineTo(x + 24, 130);
        g.arc(x + 64, 130, 40, Math.PI, 0);
        g.lineTo(x + 104, 200);
        g.fill();
      }
      g.fillStyle = "#e6dccb";
      g.fillRect(0, 0, 512, 16);
      g.fillRect(0, 236, 512, 20);
    });
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(5, 1);
    return t;
  }, []);
  const sign = useMemo(
    () =>
      canvasTexture(1024, 320, (g) => {
        g.fillStyle = "#13294b";
        g.fillRect(0, 0, 1024, 320);
        g.strokeStyle = "#f2b53a";
        g.lineWidth = 12;
        g.strokeRect(12, 12, 1000, 296);
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#f8eed6";
        g.font = "bold 104px Georgia, serif";
        g.fillText(STADIUM.name.toUpperCase(), 512, 120, 960);
        g.fillStyle = "#f2b53a";
        g.font = "italic bold 70px Georgia, serif";
        g.fillText(STADIUM.subtitle, 512, 232, 900);
      }),
    [],
  );
  const lamp = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#fffbe8", emissive: "#fff6d0" }),
    [],
  );
  useNightGlow([lamp], 0.2, 3);
  useEffect(
    () => () => {
      wall.dispose();
      sign.dispose();
      lamp.dispose();
    },
    [wall, sign, lamp],
  );
  const R = STADIUM.radius,
    H = STADIUM.height;
  // Logo banners around the round outer wall (angle measured from the +z front).
  const banners: { a: number; tex: THREE.Texture; w: number; h: number }[] = [
    { a: Math.PI / 2, tex: logoM, w: 3, h: 3 },
    { a: -Math.PI / 2, tex: logoBlue, w: 3, h: 3 },
    { a: Math.PI * 0.78, tex: logoMont, w: 3.8, h: 2.9 },
    { a: -Math.PI * 0.78, tex: logoM, w: 3, h: 3 },
  ];
  return (
    <group name="riverwalk-stadium" position={[STADIUM.x, 0, STADIUM.z]}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[BLOCK_HALF * 2, 0.24, BLOCK_HALF * 2]} />
        <meshStandardMaterial color="#b3ada2" />
      </mesh>
      {/* outer wall */}
      <mesh position={[0, H / 2 + 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, H, 48, 1, true]} />
        <meshStandardMaterial map={wall} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      <mesh position={[0, H + 0.3, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[R, 0.15, 6, 64]} />
        <meshStandardMaterial color="#e6dccb" />
      </mesh>
      {/* stands + field */}
      <mesh position={[0, H / 2 + 0.6, 0]} receiveShadow>
        <cylinderGeometry args={[R - 0.15, 3.6, H - 0.6, 48, 1, true]} />
        <meshStandardMaterial color="#2c4f86" side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.35, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[3.7, 40]} />
        <meshStandardMaterial color="#4f9a3e" roughness={1} />
      </mesh>
      <mesh position={[0, 0.37, -0.6]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshStandardMaterial color="#b9845a" roughness={1} />
      </mesh>
      {/* light towers */}
      {[0.25, 0.75, 1.25, 1.75].map((k) => {
        const a = k * Math.PI;
        return (
          <group key={k} position={[Math.sin(a) * (R + 0.4), 0, Math.cos(a) * (R + 0.4)]}>
            <mesh position={[0, 6, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.18, 12, 6]} />
              <meshStandardMaterial color="#c4c8cc" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[0, 12.2, 0]} rotation-y={a} material={lamp}>
              <boxGeometry args={[1.8, 0.9, 0.25]} />
            </mesh>
          </group>
        );
      })}
      {banners.map((b, i) => (
        <mesh
          key={i}
          position={[Math.sin(b.a) * (R + 0.06), H / 2 + 0.9, Math.cos(b.a) * (R + 0.06)]}
          rotation-y={b.a}
        >
          <planeGeometry args={[b.w, b.h]} />
          <meshStandardMaterial map={b.tex} roughness={0.7} />
        </mesh>
      ))}
      {/* front entrance facade facing the fountain */}
      <group position={[0, 0, R - 0.4]}>
        <mesh position={[0, 4.6, 0.6]} castShadow>
          <boxGeometry args={[11.5, 8.8, 1.2]} />
          <meshStandardMaterial map={wall} roughness={0.9} />
        </mesh>
        <mesh position={[0, 6.6, 1.22]}>
          <planeGeometry args={[10.4, 3.25]} />
          <meshStandardMaterial
            map={sign}
            emissiveMap={sign}
            emissive="#ffffff"
            emissiveIntensity={0.35}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[-3.6, 2.8, 1.22]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshStandardMaterial map={logoWord} roughness={0.7} />
        </mesh>
        <mesh position={[3.6, 2.8, 1.22]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshStandardMaterial map={logoBlue} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.6, 1.22]}>
          <planeGeometry args={[3, 2.8]} />
          <meshStandardMaterial color="#1a1512" />
        </mesh>
      </group>
    </group>
  );
}
