import { describe, expect, it } from "vitest";
import { GRAPHICS } from "@/lib/graphics";
import { buildingPush, drivingSurfaceHeight, nightAmount, timSmoking } from "@/lib/game";

describe("performance-safe graphics", () => {
  it("bounds shadow, occlusion and bloom costs", () => {
    expect(GRAPHICS.shadowMap).toBeLessThanOrEqual(1024);
    expect(GRAPHICS.aoSamples).toBeLessThanOrEqual(8);
    expect(GRAPHICS.aoResolution).toBeLessThanOrEqual(0.5);
    expect(GRAPHICS.pixelRatio).toBeLessThanOrEqual(1.5);
    expect(GRAPHICS.bloomIntensity).toBeLessThan(0.3);
  });
  it("keeps asphalt rougher than glossy paint and reflective metal", () => {
    expect(GRAPHICS.asphaltRoughness).toBeGreaterThan(0.9);
    expect(GRAPHICS.paintRoughness).toBeLessThan(0.3);
    expect(GRAPHICS.metalRoughness).toBeLessThan(0.4);
  });
  it("simulates a full match without nonfinite terrain, collisions or lighting", () => {
    for (let tick = 0; tick <= 6000; tick++) {
      const t = tick / 10,
        x = Math.sin(t) * 65,
        z = Math.cos(t * 0.7) * 65;
      const night = nightAmount(t);
      expect(night).toBeGreaterThanOrEqual(0);
      expect(night).toBeLessThanOrEqual(1);
      expect(Number.isFinite(drivingSurfaceHeight(x, z))).toBe(true);
      const collision = buildingPush(x, z);
      if (collision)
        for (const value of Object.values(collision)) expect(Number.isFinite(value)).toBe(true);
      expect(timSmoking(t)).toBe(Math.floor(t / 20) % 2 === 0);
    }
  });
});
