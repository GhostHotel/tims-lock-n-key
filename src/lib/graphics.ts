/** Bounded rendering costs; shared with regression tests. */
export const GRAPHICS = {
  pixelRatio: 1.25,
  shadowMap: 1024,
  shadowRadius: 2,
  shadowInterval: 1 / 20,
  shadowRange: 28,
  aoSamples: 8,
  aoResolution: 0.5,
  bloomIntensity: 0.18,
  bloomThreshold: 1.1,
  environmentIntensity: 0.7,
  asphaltRoughness: 0.95,
  paintRoughness: 0.24,
  metalRoughness: 0.28,
  wetAsphaltRoughness: 0.15,
  wetAsphaltMetalness: 0.2,
  multisampling: 0,
  rainParticles: 320,
  rainBoxWidth: 36,
  rainBoxHeight: 24,
  rainSpeed: 18,
  rainColor: "#b6ccd3",
} as const;

/** Shared scene clock for daylight and weather; persists across canvas remounts. */
export const sceneTime = { seconds: 0 };
