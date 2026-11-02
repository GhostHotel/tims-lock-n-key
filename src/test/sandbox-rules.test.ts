import { describe, expect, it } from "vitest";
import {
  lightState, popsGrounds, RED_FINE, JIMMY_FINE, timBoostActive, timSmoking, addTemper, roundedPush,
  GROUND_MS, JIMMY_RESPAWN, YELLOW_S, GAME_MS, WHITEBOARD_MS, RIVAL_NAMES, RIVAL_RED_CHANCE,
  RIVAL_GROUND_CHANCE, RIVAL_SPEED, TIM_LINES, TIM_BUSY, JOB_MINIGAME, nightAmount, DAY_LENGTH, BUSINESS,
  SIGNAL_JUNCTIONS, ROAD_LINES, signalFacing, isRedViolation, safeHit, safeWedgeWidth, extractionTuning, stepExtraction,
} from "@/lib/game";

describe("sandbox rules", () => {
  it("lights run green, then yellow, then red on a 10s phase", () => {
    expect(lightState("z", 5)).toBe("green");
    expect(lightState("z", 10 - YELLOW_S - 0.1)).toBe("green");
    expect(lightState("z", 10 - YELLOW_S + 0.1)).toBe("yellow");
    expect(lightState("x", 10 - YELLOW_S + 0.1)).toBe("red");
    expect(lightState("x", 15)).toBe("green");
    expect(lightState("x", 10 * 2 - YELLOW_S + 0.1)).toBe("yellow");
    expect(lightState("z", 10 * 2 - YELLOW_S + 0.1)).toBe("red");
  });
  it("red light and Jimmy cost $50", () => { expect(RED_FINE).toBe(50); expect(JIMMY_FINE).toBe(50); });
  it("Tim toggles smoking every 20 seconds", () => { expect(timSmoking(19)).toBe(true); expect(timSmoking(21)).toBe(false); });
  it("Tim has 5 rotating lines plus a busy line for non-smoking visits", () => {
    expect(TIM_LINES.length).toBe(5);
    expect(TIM_BUSY.toLowerCase()).toContain("busy");
  });
  it("Tim's tip lasts 25 seconds", () => { expect(timBoostActive(0, 25000)).toBe(true); expect(timBoostActive(0, 25001)).toBe(false); });
  it("Pops grounds above 50 for 2 minutes", () => { expect(popsGrounds(50)).toBe(false); expect(popsGrounds(51)).toBe(true); expect(GROUND_MS).toBe(120000); });
  it("temper stays within 0-100", () => { expect(addTemper(95, 20)).toBe(100); expect(addTemper(3, -10)).toBe(0); });
  it("Jimmy moves every 2 minutes", () => expect(JIMMY_RESPAWN).toBe(120));
  it("block corners are rounded", () => {
    // diagonal just past the square corner is free with rounding
    expect(roundedPush(7.5, 7.5, 0, 0, 7, 3, 1.1)).toBeNull();
    expect(roundedPush(7.5, 0, 0, 0, 7, 3, 1.1)).not.toBeNull();
  });
});

describe("match rules", () => {
  it("the match runs 10 minutes and most cash wins", () => expect(GAME_MS).toBe(600000));
  it("the whiteboard photo rotates every 4 minutes", () => expect(WHITEBOARD_MS).toBe(240000));
  it("rivals play fair: same fines, honest travel and fail odds", () => {
    expect(RIVAL_NAMES).toEqual(["Taylor", "Slade", "RJ"]);
    expect(RIVAL_RED_CHANCE).toBeLessThanOrEqual(0.2); // they get red-light fines too
    expect(RIVAL_GROUND_CHANCE).toBeGreaterThan(0); // Pops can ground them too
    expect(RIVAL_SPEED).toBeGreaterThan(0);
  });
  it("each job type maps to its own minigame", () => {
    expect(JOB_MINIGAME.lockout).toBe("pins");
    expect(JOB_MINIGAME.rekey).toBe("pins");
    expect(JOB_MINIGAME.broken).toBe("extract");
    expect(JOB_MINIGAME.safe).toBe("dial");
  });
  it("the business is Tim's Lock & Key", () => expect(BUSINESS).toBe("TIM'S LOCK & KEY"));
  it("day and night alternate over the day cycle", () => {
    expect(nightAmount(0)).toBe(0);
    expect(nightAmount(DAY_LENGTH / 2)).toBeCloseTo(1);
    expect(nightAmount(DAY_LENGTH)).toBeCloseTo(0, 5);
  });
});

describe("playback fixes", () => {
  it("signals cover exactly half the junctions", () => {
    expect(SIGNAL_JUNCTIONS.length).toBe(ROAD_LINES.length ** 2 / 2);
  });
  it("each signal faces the approaching driver on its own axis", () => {
    expect(signalFacing("z", 1)).toBe(Math.PI);
    expect(signalFacing("z", -1)).toBe(0);
    expect(signalFacing("x", 1)).toBe(-Math.PI / 2);
    expect(signalFacing("x", -1)).toBe(Math.PI / 2);
  });
  it("only a red signal at a signaled intersection incurs a fine", () => {
    expect(isRedViolation("z", 5, -50, -50)).toBe(false);
    expect(isRedViolation("z", 8.5, -50, -50)).toBe(false);
    expect(isRedViolation("z", 12, -50, -50)).toBe(true);
    expect(isRedViolation("z", 12, -50, -30)).toBe(false);
  });
  it("safe stops hit the displayed angle, including across twelve o'clock", () => {
    expect(safeHit(0, 0, 44)).toBe(true);
    expect(safeHit(359, 1, 44)).toBe(true);
    expect(safeHit(180, 0, 44)).toBe(false);
    expect(safeHit(22, 0, 44)).toBe(true);
    expect(safeHit(23, 0, 44)).toBe(false);
  });
  it("safe wedges are slightly narrower at every stage", () => {
    expect([0, 1, 2].map(safeWedgeWidth)).toEqual([44, 34, 24]);
  });
  it("extraction is slower, wider and less punishing with a larger Tim bonus", () => {
    expect(extractionTuning(false)).toMatchObject({ speed: 1.8, half: 0.16, risk: 36 });
    expect(extractionTuning(true)).toMatchObject({ speed: 1.2, half: 0.23, risk: 26 });
  });
  it("extraction reaches success rather than slipping below 100 each frame", () => {
    expect(stepExtraction(99, 0, 0.5, true, 0.05, true).progress).toBe(100);
  });
});
