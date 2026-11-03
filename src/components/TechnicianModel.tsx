import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import base from "@/assets/models/technician-base.glb.asset.json";
import { TECHNICIAN_STYLE, type Technician } from "@/lib/match";

function Part({ position, size, color, rotation = [0, 0, 0] }: { position: [number, number, number]; size: [number, number, number]; color: string; rotation?: [number, number, number] }) {
  return <mesh position={position} rotation={rotation} castShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>;
}
export function TechnicianModel({ name, celebrate = false, seated = false }: { name: Technician; celebrate?: boolean; seated?: boolean }) {
  const { scene } = useGLTF(base.url);
  const root = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const style = TECHNICIAN_STYLE[name];
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.castShadow = obj.receiveShadow = true;
      const color = obj.name === "head" ? "#d9ac87" : obj.name.startsWith("leg") ? style.pants : style.shirt;
      obj.material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    });
    const bounds = new THREE.Box3().setFromObject(clone);
    const height = bounds.max.y - bounds.min.y;
    clone.scale.setScalar(2.4 / height);
    clone.position.y = -bounds.min.y * (2.4 / height);
    if (seated) {
      for (const side of ["left", "right"]) {
        const leg = clone.getObjectByName(`leg-${side}`);
        if (leg) leg.rotation.x = -Math.PI / 2;
      }
    }
    return clone;
  }, [scene, style, seated]);
  useEffect(() => { elapsed.current = 0; }, [celebrate, name]);
  useEffect(() => () => { model.traverse((obj) => { if (obj instanceof THREE.Mesh) { const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach((m) => m.dispose()); } }); }, [model]);
  useFrame((state, delta) => {
    elapsed.current += Math.min(delta, 0.05);
    if (root.current) {
      root.current.position.y = celebrate ? Math.abs(Math.sin(elapsed.current * 9)) * 0.22 : 0;
      root.current.rotation.y = celebrate ? Math.sin(elapsed.current * 7) * 0.14 : Math.sin(state.clock.elapsedTime * 0.7) * 0.035;
    }
    for (const [side, direction] of [["left", 1], ["right", -1]] as const) {
      const arm = model.getObjectByName(`arm-${side}`);
      if (arm) arm.rotation.z = celebrate ? direction * (1.7 + Math.sin(elapsed.current * 10) * 0.2) : direction * 0.06;
    }
    state.gl.domElement.parentElement?.setAttribute("data-technician-ready", name);
  });
  const cap = name === "Taylor" || name === "RJ";
  const glasses = name === "Matt" || name === "Kevin";
  const collar = name === "Taylor" || name === "Slade" || name === "Kevin";
  return <group ref={root} scale={name === "Opy" ? 1.1 : 1}>
    <primitive object={model} />
    <Part position={[0, 2.37, -0.02]} size={[0.72, 0.13, 0.64]} color={style.hair} />
    <Part position={[0, 2.15, -0.29]} size={[0.72, 0.38, 0.1]} color={style.hair} />
    {style.beard && <Part position={[0, name === "Kevin" ? 1.92 : 1.89, 0.32]} size={[0.52, name === "Kevin" ? 0.05 : 0.19, 0.08]} color={style.beard} />}
    <Part position={[0, 2.05, 0.36]} size={[0.12, 0.12, 0.1]} color="#d2a27d" />
    {[-0.17, 0.17].map((x) => <Part key={`eye${x}`} position={[x, 2.14, 0.365]} size={[0.055, 0.045, 0.02]} color="#252729" />)}
    {glasses && <group>{[-0.17, 0.17].map((x) => <mesh key={x} position={[x, 2.14, 0.36]}><boxGeometry args={[0.26, 0.14, 0.035]} /><meshStandardMaterial color="#252729" transparent={name === "Matt"} opacity={name === "Matt" ? 0.7 : 1} metalness={0.25} /></mesh>)}<Part position={[0, 2.14, 0.37]} size={[0.12, 0.025, 0.03]} color="#252729" /></group>}
    {cap && <><Part position={[0, 2.4, 0]} size={[0.78, 0.17, 0.68]} color={name === "RJ" ? "#794f36" : "#324c61"} /><Part position={[0, 2.33, 0.42]} size={[0.76, 0.05, 0.34]} color={name === "RJ" ? "#794f36" : "#324c61"} /></>}
    {name === "Matt" && <><Part position={[0, 2.07, -0.38]} size={[0.15, 0.45, 0.15]} color={style.hair} />{[-0.19, 0.19].map((x) => <Part key={x} position={[x, 1.27, 0.285]} size={[0.065, 0.64, 0.03]} color="#463b32" />)}<Part position={[0.18, 1.99, 0.51]} size={[0.3, 0.025, 0.035]} color="#68402c" /><mesh position={[0.36, 2.02, 0.51]}><cylinderGeometry args={[0.06, 0.04, 0.12, 10]} /><meshStandardMaterial color="#68402c" /></mesh><PipeSmoke /></>}
    {name === "Opy" && Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2.4) * 0.32, 2.42 + (i % 3) * 0.035, Math.cos(i * 2.4) * 0.27]}><sphereGeometry args={[0.12, 8, 6]} /><meshStandardMaterial color={style.hair} /></mesh>)}
    {collar && <>{[-1, 1].map((sign) => <Part key={sign} position={[sign * 0.13, 1.57, 0.3]} size={[0.18, 0.14, 0.04]} color={style.shirt} rotation={[0, 0, sign * 0.4]} />)}{name === "Kevin" && [1.1, 1.25, 1.4].map((y) => <Part key={y} position={[0, y, 0.3]} size={[0.025, 0.025, 0.02]} color="#665d4b" />)}</>}
    {name === "Taylor" && <><Backpack x={0} y={1.25} z={-0.4} /><Part position={[-0.52, 0.77, 0.08]} size={[0.42, 0.32, 0.18]} color="#594638" /><Part position={[-0.52, 0.96, 0.08]} size={[0.17, 0.065, 0.1]} color="#2d3034" /></>}
    {name === "Slade" && <><Part position={[-0.52, 0.8, 0.06]} size={[0.4, 0.27, 0.23]} color="#bd4e3b" /><Part position={[-0.52, 0.96, 0.06]} size={[0.17, 0.065, 0.1]} color="#d4d3c9" /></>}
    {name === "RJ" && <group position={[-0.52, 0.93, 0.13]}><mesh><cylinderGeometry args={[0.065, 0.065, 0.35, 12]} /><meshPhysicalMaterial color="#d8e4e4" transparent opacity={0.4} roughness={0.1} /></mesh><mesh position={[0, -0.085, 0]}><cylinderGeometry args={[0.058, 0.058, 0.17, 12]} /><meshStandardMaterial color="#45281b" /></mesh><Part position={[0, 0.19, 0]} size={[0.09, 0.06, 0.09]} color="#c94c3b" /><Part position={[0, 0, 0.063]} size={[0.11, 0.09, 0.01]} color="#c94c3b" /></group>}
    {name === "Opy" && <group position={[-0.54, 0.82, 0.1]} rotation-z={0.15}><Part position={[0, 0, 0]} size={[0.07, 0.62, 0.07]} color="#b94d36" /><Part position={[0.04, 0.36, 0]} size={[0.22, 0.1, 0.12]} color="#a7adb0" /><Part position={[0.12, 0.28, 0]} size={[0.07, 0.18, 0.12]} color="#a7adb0" /></group>}
    {name === "Kevin" && <><Backpack x={-0.55} y={0.67} z={0.03} />{[-0.27, 0.27].map((x) => <Part key={x} position={[x, 0.54, 0.13]} size={[0.15, 0.22, 0.14]} color={style.pants} />)}</>}
    {[-0.18, 0.18].map((x) => <Part key={`shoe${x}`} position={[x, 0.055, 0.05]} size={[0.32, 0.11, 0.47]} color="#383b3d" />)}
  </group>;
}
function Backpack({ x, y, z }: { x: number; y: number; z: number }) {
  return <group position={[x, y, z]}><Part position={[0, 0, 0]} size={[0.48, 0.57, 0.24]} color="#536348" /><Part position={[0, -0.12, 0.14]} size={[0.34, 0.2, 0.08]} color="#738065" /><Part position={[0, 0.32, 0]} size={[0.15, 0.08, 0.08]} color="#303b30" />{[-0.17, 0.17].map((offset) => <Part key={offset} position={[offset, 0.04, -0.15]} size={[0.04, 0.54, 0.05]} color="#303b30" />)}</group>;
}
function PipeSmoke() {
  const smoke = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { smoke.current?.children.forEach((child, i) => { const t = (clock.elapsedTime * 0.6 + i / 3) % 1; child.position.set(0.36 + t * 0.12, 2.13 + t * 0.5, 0.51); child.scale.setScalar(0.025 + t * 0.05); }); });
  return <group ref={smoke}>{[0, 1, 2].map((i) => <mesh key={i}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#d0d6d4" transparent opacity={0.22} depthWrite={false} /></mesh>)}</group>;
}