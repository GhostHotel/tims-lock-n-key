import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { LOTS, MALL, PARKING } from "@/lib/game";
import portrait from "@/assets/graffiti_portrait.webp.asset.json";
import bgs from "@/assets/graffiti_bgs.webp.asset.json";
import crayons from "@/assets/graffiti_crayons.webp.asset.json";
import cat from "@/assets/graffiti_cat.webp.asset.json";
import mural from "@/assets/graffiti_mural.webp.asset.json";
import bunny from "@/assets/graffiti_bunny.webp.asset.json";
import storm from "@/assets/graffiti_storm.webp.asset.json";
import caterpillar from "@/assets/graffiti_caterpillar.webp.asset.json";
import icecream from "@/assets/graffiti_icecream.webp.asset.json";
import poster from "@/assets/poster_release.webp.asset.json";

// Each piece is used exactly once; aspect = width / height.
const PIECES = [
  { url: portrait.url, aspect: 366 / 512 },
  { url: bgs.url, aspect: 512 / 410 },
  { url: crayons.url, aspect: 1 },
  { url: cat.url, aspect: 1 },
  { url: mural.url, aspect: 512 / 269 },
  { url: bunny.url, aspect: 365 / 512 },
  { url: storm.url, aspect: 512 / 339 },
  { url: caterpillar.url, aspect: 512 / 341 },
  { url: icecream.url, aspect: 512 / 341 },
];

// Poster building: the block just south of Tim's parking lot, its back wall faces the lot.
const POSTER_LOT = LOTS.find((l) => l.cx === PARKING.x && l.cz === 20);

// Building box (see City3D): 8 wide (x ±4), 7 deep (z -2.5..4.5 around cz), base y 0.3.
const OFFSET = 0.02;

/** Shared spray-paint mask: soft, speckled edges so art reads as painted on the brick. */
function sprayMask() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, s, s);
  const grad = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.56);
  grad.addColorStop(0, "#eee");
  grad.addColorStop(1, "#000");
  g.fillStyle = grad;
  g.fillRect(8, 8, s - 16, s - 16);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(rnd() * 90);
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function StreetArt() {
  const textures = useTexture([...PIECES.map((p) => p.url), poster.url]);
  const mask = useMemo(sprayMask, []);
  useMemo(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
  }, [textures]);

  const spots = useMemo(() => {
    const lots = LOTS.filter((l) => l.client !== MALL.name && (!l.kind || l.kind === "storefront") && l !== POSTER_LOT && l.h >= 4);
    const stride = lots.length / PIECES.length;
    return PIECES.map((p, i) => {
      const lot = lots[Math.floor(i * stride + stride / 2) % lots.length]!;
      const side = i % 2 ? 1 : -1;
      const maxH = lot.h - 0.8;
      let w = 5.4;
      let h = w / p.aspect;
      if (h > maxH) {
        h = maxH;
        w = h * p.aspect;
      }
      return {
        key: i,
        pos: [lot.cx + side * (4 + OFFSET), 0.6 + h / 2, lot.cz + 1] as const,
        rotY: side * (Math.PI / 2),
        w,
        h,
      };
    });
  }, []);

  return (
    <group>
      {spots.map((s) => (
        <mesh key={s.key} position={s.pos} rotation-y={s.rotY}>
          <planeGeometry args={[s.w, s.h]} />
          <meshStandardMaterial
            map={textures[s.key] ?? null}
            alphaMap={mask}
            transparent
            opacity={0.9}
            roughness={1}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
          />
        </mesh>
      ))}
      {POSTER_LOT && (
        <group position={[POSTER_LOT.cx, 0.3 + Math.min(POSTER_LOT.h, 7.6) / 2, POSTER_LOT.cz - 2.5]} rotation-y={Math.PI}>
          {/* Billboard frame, then the crisp poster face just in front of it */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[4.1, 5.9, 0.1]} />
            <meshStandardMaterial color="#1c1b1f" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.105]}>
            <planeGeometry args={[3.8, 5.6]} />
            <meshStandardMaterial map={textures[PIECES.length] ?? null} roughness={0.45} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        </group>
      )}
    </group>
  );
}
