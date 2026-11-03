import { describe, expect, it } from "vitest";
import { chooseRivals, TECHNICIANS, MAX_PLAYERS, LOADING_MS, DIFFICULTIES, pinTuning, dialTuning, effectiveDifficulty } from "@/lib/match";
import { extractionTuning } from "@/lib/game";
describe("Match selection rules", () => {
  it("allows only the six requested technicians", () => expect([...TECHNICIANS]).toEqual(["Matt", "Taylor", "Slade", "RJ", "Opy", "Kevin"]));
  it("caps total participants at four", () => { expect(MAX_PLAYERS).toBe(4); expect(chooseRivals("Matt", 99)).toHaveLength(3); });
  it("excludes the main technician and avoids duplicate rivals", () => { const rivals = chooseRivals("Opy", 4, () => 0.3); expect(rivals).not.toContain("Opy"); expect(new Set(rivals).size).toBe(3); });
  it("allows solo matches without NPC rivals", () => expect(chooseRivals("Kevin", 1)).toEqual([]));
  it("holds the loading screen for five seconds", () => expect(LOADING_MS).toBe(5000));
  it("preserves medium rival balance", () => expect(DIFFICULTIES.medium).toMatchObject({ fail: 0.25, red: 0.12, ground: 0.02 }));
  it("gives easy rivals more mistakes and penalties", () => { expect(DIFFICULTIES.easy.fail).toBeGreaterThan(DIFFICULTIES.medium.fail); expect(DIFFICULTIES.easy.red).toBeGreaterThan(DIFFICULTIES.medium.red); expect(DIFFICULTIES.easy.ground).toBeGreaterThan(DIFFICULTIES.medium.ground); });
  it("makes easy pins slower with wider windows and more attempts", () => { const e = pinTuning("easy"), m = pinTuning("medium"); expect(e.speed).toBeLessThan(m.speed); expect(e.hi-e.lo).toBeGreaterThan(m.hi-m.lo); expect(e.tries).toBe(6); });
  it("makes hard pins tight and single-attempt", () => { expect(pinTuning("hard").hi-pinTuning("hard").lo).toBeLessThan(0.1); expect(pinTuning("hard").tries).toBe(1); });
  it("makes safe dial thresholds follow difficulty", () => { expect(dialTuning("easy", 2).width).toBeGreaterThan(dialTuning("medium", 2).width); expect(dialTuning("hard", 2).width).toBeLessThan(dialTuning("medium", 2).width); expect(dialTuning("hard", 0).tries).toBe(1); });
  it("keeps Tim tips easier even in hard matches", () => expect(effectiveDifficulty("hard", true)).toBe("easy"));
  it("makes easy extraction forgiving and hard extraction riskier", () => { const e = extractionTuning(false, "easy"), m = extractionTuning(false), h = extractionTuning(false, "hard"); expect(e.half).toBeGreaterThan(m.half); expect(e.risk).toBeLessThan(m.risk); expect(h.half).toBeLessThan(m.half); expect(h.risk).toBeGreaterThan(m.risk); });
});