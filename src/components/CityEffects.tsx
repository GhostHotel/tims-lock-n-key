import { Bloom, EffectComposer, SMAA, SSAO, ToneMapping } from "@react-three/postprocessing";
import { BlendFunction, SMAAPreset, ToneMappingMode } from "postprocessing";
import { HalfFloatType } from "three";
import { GRAPHICS } from "@/lib/graphics";
import { LensDroplets } from "@/components/LensDroplets";

export function CityEffects() {
  return (
    <EffectComposer
      multisampling={GRAPHICS.multisampling}
      enableNormalPass
      resolutionScale={GRAPHICS.aoResolution}
      frameBufferType={HalfFloatType}
    >
      <SSAO
        blendFunction={BlendFunction.MULTIPLY}
        samples={GRAPHICS.aoSamples}
        rings={3}
        radius={0.8}
        intensity={0.8}
        luminanceInfluence={0.6}
        distanceThreshold={0.4}
        distanceFalloff={0.15}
        rangeThreshold={0.25}
        rangeFalloff={0.1}
      />
      <Bloom
        intensity={GRAPHICS.bloomIntensity}
        luminanceThreshold={GRAPHICS.bloomThreshold}
        luminanceSmoothing={0.3}
        mipmapBlur
        resolutionScale={0.5}
      />
      <LensDroplets />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA preset={SMAAPreset.LOW} />
    </EffectComposer>
  );
}
