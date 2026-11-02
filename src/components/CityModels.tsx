import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import vanAsset from "@/assets/models/delivery-van.glb.asset.json";
import treeAsset from "@/assets/models/tree-default.glb.asset.json";
import { GRAPHICS } from "@/lib/graphics";
import { useSurfaceMaps } from "@/components/CitySurfaces";

export function useCityModels() {
  useGLTF(vanAsset.url);
  useGLTF(treeAsset.url);
}

export function DeliveryModel({ upgraded, tint }: { upgraded: boolean; tint?: string }) {
  const { scene } = useGLTF(vanAsset.url);
  const surfaces = useSurfaceMaps();
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(
        (original) => {
          const material = original.clone() as THREE.MeshStandardMaterial;
          const wheel = object.name.startsWith("wheel");
          material.roughness = wheel ? 0.85 : GRAPHICS.paintRoughness;
          material.metalness = wheel ? 0.05 : 0.45;
          material.envMapIntensity = GRAPHICS.environmentIntensity;
          if (!wheel && surfaces) {
            material.normalMap = surfaces.paint.normalMap;
            material.roughnessMap = surfaces.paint.roughnessMap;
            material.roughness = 1;
          }
          if (upgraded && (object.name === "body" || object.name === "door"))
            material.color.set("#191b20");
          else if (tint && (object.name === "body" || object.name === "door"))
            material.color.set(tint);
          return material;
        },
      );
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    return copy;
  }, [scene, upgraded, surfaces, tint]);
  return (
    <group>
      <primitive object={model} scale={1.3} />
      {[-0.98, 0.98].flatMap((x) =>
        [-1.32, 1.32].map((z) => (
          <mesh key={`${x},${z}`} position={[x, 0.46, z]} rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.23, 0.23, 0.05, 12]} />
            <meshStandardMaterial
              color="#b9bec5"
              metalness={0.95}
              roughness={GRAPHICS.metalRoughness}
              envMapIntensity={GRAPHICS.environmentIntensity}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

export function TreeModel({ x, z }: { x: number; z: number }) {
  const { scene } = useGLTF(treeAsset.url);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((object) => {
      if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    });
    return copy;
  }, [scene]);
  return <primitive object={model} position={[x, 0.3, z]} scale={2.1} />;
}
