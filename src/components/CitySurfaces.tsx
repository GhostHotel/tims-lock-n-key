import { Environment, useTexture } from "@react-three/drei";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import sky from "@/assets/graphics/urban-courtyard.hdr.asset.json";
import asphaltNormal from "@/assets/graphics/asphalt-normal.png.asset.json";
import asphaltRoughness from "@/assets/graphics/asphalt-roughness.jpg.asset.json";
import paintNormal from "@/assets/graphics/paint-normal.png.asset.json";
import paintRoughness from "@/assets/graphics/paint-roughness.jpg.asset.json";
import metalNormal from "@/assets/graphics/metal-normal.png.asset.json";
import metalRoughness from "@/assets/graphics/metal-roughness.jpg.asset.json";
import masonryNormal from "@/assets/graphics/masonry-normal.png.asset.json";
import masonryRoughness from "@/assets/graphics/masonry-roughness.jpg.asset.json";
import { GRAPHICS } from "@/lib/graphics";
import { nightAmount } from "@/lib/game";

interface SurfaceMaps {
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}
interface Surfaces {
  asphalt: SurfaceMaps;
  paint: SurfaceMaps;
  metal: SurfaceMaps;
  masonry: SurfaceMaps;
}
const SurfaceContext = createContext<Surfaces | null>(null);
export const useSurfaceMaps = () => useContext(SurfaceContext);

export function CitySurfaces({ children }: { children: React.ReactNode }) {
  const textures = useTexture([
    asphaltNormal.url,
    asphaltRoughness.url,
    paintNormal.url,
    paintRoughness.url,
    metalNormal.url,
    metalRoughness.url,
    masonryNormal.url,
    masonryRoughness.url,
  ]);
  const surfaces = useMemo(() => {
    const pair = (index: number, repeat: number): SurfaceMaps => {
      const normalMap = textures[index],
        roughnessMap = textures[index + 1];
      if (!normalMap || !roughnessMap) throw new Error("Surface detail maps unavailable");
      for (const texture of [normalMap, roughnessMap]) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat, repeat);
        texture.colorSpace = THREE.NoColorSpace;
        texture.anisotropy = 2;
      }
      return { normalMap, roughnessMap };
    };
    return { asphalt: pair(0, 40), paint: pair(2, 1), metal: pair(4, 1), masonry: pair(6, 3) };
  }, [textures]);
  return <SurfaceContext value={surfaces}>{children}</SurfaceContext>;
}

export function CityEnvironment() {
  const { scene } = useThree();
  useFrame(({ clock }) => {
    scene.environmentIntensity =
      GRAPHICS.environmentIntensity * (1 - nightAmount(clock.elapsedTime) * 0.65);
  });
  return (
    <Environment
      files={sky.url}
      background={false}
      environmentIntensity={GRAPHICS.environmentIntensity}
    />
  );
}

/** Standard-material defaults apply to primitive surfaces, never unlit overlays. */
export function CityMaterialDefaults() {
  const { scene } = useThree();
  const surfaces = useSurfaceMaps();
  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (material.metalness > 0.6 && surfaces) {
          material.normalMap = surfaces.metal.normalMap;
          material.roughnessMap = surfaces.metal.roughnessMap;
          material.roughness = 1;
          material.envMapIntensity = 0.8;
          material.needsUpdate = true;
        }
      }
    });
  }, [scene, surfaces]);
  return null;
}
