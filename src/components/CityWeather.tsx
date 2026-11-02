import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { rainIntensity } from "@/lib/game";
import { GRAPHICS } from "@/lib/graphics";
import { sceneTime } from "@/components/City3D";

/** One bounded draw call; no particle meshes, allocations or React updates per frame. */
export function CityWeather() {
  const group = useRef<THREE.LineSegments>(null);
  const { clock, camera, scene } = useThree();
  const drops = useMemo(() => {
    const positions = new Float32Array(GRAPHICS.rainParticles * 6);
    const width = GRAPHICS.rainBoxWidth;
    for (let i = 0; i < positions.length; i += 6) {
      const x = Math.random() * width - width / 2;
      const y = Math.random() * GRAPHICS.rainBoxHeight - GRAPHICS.rainBoxHeight / 2;
      const z = Math.random() * width - width / 2;
      positions[i] = x;
      positions[i + 1] = y;
      positions[i + 2] = z;
      positions[i + 3] = x + 0.08;
      positions[i + 4] = y + 0.7;
      positions[i + 5] = z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.LineBasicMaterial({
      color: GRAPHICS.rainColor, transparent: true, opacity: 0,
      depthWrite: false, toneMapped: false,
    });
    return { geometry, material, positions };
  }, []);
  useEffect(() => () => {
    drops.geometry.dispose();
    drops.material.dispose();
  }, [drops]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    Object.assign(window, { __weather: {
      setTime: (seconds: number) => { if (Number.isFinite(seconds) && seconds >= 0) { clock.elapsedTime = seconds; sceneTime.seconds = seconds; } },
      get state() {
        let road: { roughness: number; metalness: number } | undefined;
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.name === "city-asphalt") {
            road = { roughness: object.material.roughness, metalness: object.material.metalness };
          }
        });
        return {
        time: clock.elapsedTime, intensity: rainIntensity(clock.elapsedTime),
        visible: group.current?.visible, center: group.current?.position.toArray(),
        camera: camera.position.toArray(), particles: GRAPHICS.rainParticles, road,
      }; },
    } });
    return () => { Reflect.deleteProperty(window, "__weather"); };
  }, [clock, camera, scene]);
  // Runs after the chase camera and before the composer (priority 1).
  useFrame(({ camera, clock }, delta) => {
    const streaks = group.current;
    if (!streaks) return;
    const intensity = rainIntensity(clock.elapsedTime);
    streaks.visible = intensity > 0;
    streaks.position.copy(camera.position);
    if (!streaks.visible) return;
    drops.material.opacity = intensity * 0.28;
    const step = GRAPHICS.rainSpeed * Math.min(delta, 0.05);
    for (let i = 0; i < drops.positions.length; i += 6) {
      let y = (drops.positions[i + 1] ?? 0) - step;
      if (y < -GRAPHICS.rainBoxHeight / 2) y += GRAPHICS.rainBoxHeight;
      drops.positions[i + 1] = y;
      drops.positions[i + 4] = y + 0.7;
    }
    const position = drops.geometry.getAttribute("position");
    position.needsUpdate = true;
  }, 0.5);
  return <lineSegments ref={group} geometry={drops.geometry} material={drops.material} visible={false} frustumCulled={false} dispose={null} />;
}