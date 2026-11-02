import { describe, expect, it, vi } from "vitest";
import {
  BLOCK,
  LOTS,
  MALL,
  PARKING,
  ROAD_LINES,
  WORLD_HALF,
  buildingPush,
  drivingSurfaceHeight,
  makeJob,
} from "@/lib/game";

describe("Eastdale Mall", () => {
  it("occupies one unique lot one block down the street from parking", () => {
    expect(MALL.name).toBe("Eastdale Mall");
    expect(MALL.x).toBe(PARKING.x + BLOCK);
    expect(MALL.z).toBe(PARKING.z);
    expect(LOTS.filter((l) => l.cx === MALL.x && l.cz === MALL.z)).toHaveLength(1);
  });
  it("enters normal random dispatch with the same coordinates and job types", () => {
    const random = vi.spyOn(Math, "random");
    const mall = LOTS.find((l) => l.client === "Eastdale Mall");
    if (!mall) throw new Error("Missing mall in normal service registry");
    const taken = LOTS.filter((l) => l !== mall).map((l, i) => ({
      id: i,
      type: "lockout" as const,
      client: "Customer",
      address: l.address,
      x: l.door.x,
      y: l.door.z,
      pins: 3,
      pay: 75,
      expires: 999999,
    }));
    try {
      for (const [value, type] of [
        [0, "lockout"],
        [0.45, "rekey"],
        [0.65, "broken"],
        [0.85, "safe"],
      ] as const) {
        random.mockReturnValue(value);
        expect(makeJob(1000, 0, taken)).toMatchObject({
          client: "Eastdale Mall",
          address: "Eastdale Mall",
          x: 40,
          y: 9,
          type,
        });
      }
    } finally {
      random.mockRestore();
    }
  });
  it("allows a complete van lap across the entire road width", () => {
    for (const radius of [
      MALL.roadInner + 1.1,
      (MALL.roadInner + MALL.roadOuter) / 2,
      MALL.roadOuter - 1.1,
    ]) {
      for (let degree = 0; degree < 360; degree++) {
        const angle = (degree * Math.PI) / 180;
        const x = MALL.x + radius * Math.cos(angle),
          z = MALL.z + radius * Math.sin(angle);
        expect(buildingPush(x, z)).toBeNull();
        expect(drivingSurfaceHeight(x, z)).toBe(0);
        expect(Math.abs(x)).toBeLessThan(WORLD_HALF);
        expect(Math.abs(z)).toBeLessThan(WORLD_HALF);
      }
    }
    expect(buildingPush(40, 0)).not.toBeNull();
    expect(buildingPush(40, 9)).toBeNull();
  });
  it("joins all four surrounding streets without terrain steps or blocked approaches", () => {
    expect(ROAD_LINES).toEqual(expect.arrayContaining([30, 50, -10, 10]));
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let distance = 9; distance <= MALL.roadOuter; distance += 0.1) {
        const x = MALL.x + dx * distance,
          z = MALL.z + dz * distance;
        expect(buildingPush(x, z)).toBeNull();
        expect(drivingSurfaceHeight(x, z)).toBe(0);
      }
    }
  });
});
