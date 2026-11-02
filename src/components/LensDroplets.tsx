import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BlendFunction, Effect } from "postprocessing";
import { Uniform, Vector2 } from "three";
import { rainIntensity } from "@/lib/game";

// Sparse 6×4 screen-space droplet matrix. No blur, refraction, extra texture reads or CSS filter.
const fragment = `
uniform float wetness;
uniform float rainTime;
uniform vec2 lensSize;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 grid = uv * vec2(6.0, 4.0);
  vec2 cell = floor(grid);
  float seed = hash(cell);
  vec2 center = vec2(0.22 + seed * 0.55, 0.25 + hash(cell + 9.0) * 0.5);
  vec2 local = fract(grid) - center;
  local.x *= (lensSize.x / max(lensSize.y, 1.0)) * (4.0 / 6.0);
  float radius = 0.025 + seed * 0.035;
  float distance = length(local);
  float rim = (1.0 - smoothstep(radius * 0.82, radius * 1.15, distance))
    * smoothstep(radius * 0.4, radius * 0.9, distance);
  float fill = 1.0 - smoothstep(0.0, radius, distance);
  float pulse = 0.65 + 0.35 * sin(rainTime * 0.7 + seed * 20.0);
  float edge = smoothstep(0.12, 0.42, max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
  float amount = wetness * step(0.35, seed) * pulse * edge;
  // Neutral highlights reuse the rendered scene color and never cover DOM game controls.
  vec3 color = inputColor.rgb * (1.0 - fill * amount * 0.035);
  color += rim * amount * 0.075;
  outputColor = vec4(color, inputColor.a);
}`;

class LensEffect extends Effect {
  constructor() {
    super("LensDroplets", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["wetness", new Uniform(0)], ["rainTime", new Uniform(0)],
        ["lensSize", new Uniform(new Vector2(1, 1))],
      ]),
    });
  }
}

export function LensDroplets() {
  const effect = useMemo(() => new LensEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  useFrame(({ clock, size }) => {
    const wetness = effect.uniforms.get("wetness");
    const time = effect.uniforms.get("rainTime");
    const lensSize = effect.uniforms.get("lensSize");
    if (wetness) wetness.value = rainIntensity(clock.elapsedTime);
    if (time) time.value = clock.elapsedTime;
    if (lensSize) lensSize.value.set(size.width, size.height);
  });
  return <primitive object={effect} dispose={null} />;
}