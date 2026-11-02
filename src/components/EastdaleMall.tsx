import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import mallAsset from "@/assets/models/eastdale-mall.glb.asset.json";
import { MALL } from "@/lib/game";
import { GRAPHICS } from "@/lib/graphics";
import { useSurfaceMaps } from "@/components/CitySurfaces";

export function EastdaleMall() {
  const { scene } = useGLTF(mallAsset.url);
  const surfaces = useSurfaceMaps();
  const model = useMemo(() => {
    const copy = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(copy);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = new THREE.Vector3(
      (MALL.halfX * 2) / size.x,
      MALL.height / size.y,
      (MALL.halfZ * 2) / size.z,
    );
    copy.scale.copy(scale);
    copy.position.set(-center.x * scale.x, 0.24 - bounds.min.y * scale.y, -center.z * scale.z);
    copy.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(
        (original) => {
          const material = original.clone() as THREE.MeshStandardMaterial;
          material.roughness = 0.75;
          material.envMapIntensity = GRAPHICS.environmentIntensity;
          if (surfaces) material.normalMap = surfaces.masonry.normalMap;
          return material;
        },
      );
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    return copy;
  }, [scene, surfaces]);
  const sign = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#244f52";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#f2b53a";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 1004, 172);
      ctx.fillStyle = "#f8eed6";
      ctx.font = "bold 92px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(MALL.name.toUpperCase(), 512, 104, 950);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
  useEffect(
    () => () => {
      sign.dispose();
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        }
      });
    },
    [model, sign],
  );
  return (
    <group name="eastdale-mall" position={[MALL.x, 0, MALL.z]}>
      <primitive object={model} />
      <mesh position={[0, MALL.height - 0.3, MALL.halfZ + 0.12]}>
        <planeGeometry args={[11, 2.05]} />
        <meshStandardMaterial
          map={sign}
          emissiveMap={sign}
          emissiveIntensity={0.35}
          emissive="white"
          roughness={0.6}
        />
      </mesh>
      <mesh position={[0, 1.9, MALL.halfZ + 0.05]}>
        <boxGeometry args={[2.4, 3.3, 0.08]} />
        <meshStandardMaterial color="#9ccacf" metalness={0.3} roughness={0.2} />
      </mesh>
    </group>
  );
}
