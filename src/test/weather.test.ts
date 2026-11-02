import { describe, expect, it } from "vitest";
import { DAY_LENGTH, rainIntensity, WEATHER } from "@/lib/game";
import { GRAPHICS } from "@/lib/graphics";

describe("intermittent weather", () => {
  it("keeps the initial day dry until the first day-to-night transition", () => {
    expect(WEATHER.firstRain).toBe(DAY_LENGTH / 4);
    expect(rainIntensity(0)).toBe(0);
    expect(rainIntensity(59)).toBe(0);
    expect(rainIntensity(60)).toBe(0);
    expect(rainIntensity(63)).toBe(1);
  });
  it("ends showers and leaves dry intervals rather than always raining", () => {
    expect(rainIntensity(100)).toBe(1);
    expect(rainIntensity(105)).toBe(0);
    expect(rainIntensity(150)).toBe(0);
    expect(rainIntensity(209)).toBe(0);
    expect(rainIntensity(213)).toBe(1);
  });
  it("uses the requested wet street properties", () => {
    expect(GRAPHICS.wetAsphaltRoughness).toBe(0.15);
    expect(GRAPHICS.wetAsphaltMetalness).toBe(0.2);
  });
  it("disables MSAA and bounds the local rain particle budget", () => {
    expect(GRAPHICS.multisampling).toBe(0);
    expect(GRAPHICS.rainParticles).toBeLessThanOrEqual(320);
  });
  it("bounds rain across the complete match and invalid clock input", () => {
    for (let t = 0; t <= 600; t += 0.25) {
      expect(rainIntensity(t)).toBeGreaterThanOrEqual(0);
      expect(rainIntensity(t)).toBeLessThanOrEqual(1);
    }
    expect(rainIntensity(NaN)).toBe(0);
  });
});