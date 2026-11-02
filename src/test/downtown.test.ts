import { describe, expect, it } from "vitest";
import { FOUNTAIN, LOTS, STADIUM, DOWNTOWN_PARK, buildingPush, drivingSurfaceHeight } from "@/lib/game";

describe("Downtown district", () => {
  it("has 8 skyscrapers", () => {
    expect(LOTS.filter((l) => l.kind === "tower")).toHaveLength(8);
    expect(Math.min(...LOTS.filter((l) => l.kind === "tower").map((l) => l.h))).toBeGreaterThanOrEqual(30);
  });
  it("names the stadium Riverwalk Stadium, Home of the Biscuits, and dispatches jobs there", () => {
    expect(STADIUM.name).toBe("Riverwalk Stadium");
    expect(STADIUM.subtitle).toBe("Home of the Biscuits");
    expect(LOTS.filter((l) => l.client === "Riverwalk Stadium")).toHaveLength(1);
  });
  it("lets the van lap the fountain ring road but not drive through the fountain", () => {
    const r = (FOUNTAIN.roadInner + FOUNTAIN.roadOuter) / 2;
    for (let d = 0; d < 360; d += 2) {
      const a = (d * Math.PI) / 180;
      const x = FOUNTAIN.x + r * Math.cos(a), z = FOUNTAIN.z + r * Math.sin(a);
      expect(buildingPush(x, z)).toBeNull();
      expect(drivingSurfaceHeight(x, z)).toBe(0);
    }
    expect(buildingPush(FOUNTAIN.x, FOUNTAIN.z)).not.toBeNull();
  });
  it("puts the park one street across from the fountain with no building on it", () => {
    expect(Math.hypot(DOWNTOWN_PARK.x - FOUNTAIN.x, DOWNTOWN_PARK.z - FOUNTAIN.z)).toBe(20);
    expect(LOTS.some((l) => l.cx === DOWNTOWN_PARK.x && l.cz === DOWNTOWN_PARK.z)).toBe(false);
  });
});
