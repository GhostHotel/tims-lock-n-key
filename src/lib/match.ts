export const TECHNICIANS = ["Matt", "Taylor", "Slade", "RJ", "Opy", "Kevin"] as const;
export type Technician = (typeof TECHNICIANS)[number];
export type Difficulty = "easy" | "medium" | "hard";
export type MenuState = "MAIN_MENU" | "CHARACTER_SELECT" | "MATCH_CONFIG" | "LOADING" | "PLAYING";
export interface MatchConfig { technician: Technician; playerCount: number; difficulty: Difficulty; displayName: string; rankedId: string | null }
export const LOADING_MS = 5000;
export const CELEBRATION_MS = 1100;
export const MAX_PLAYERS = 4;
export const DIFFICULTIES = {
  easy: { label: "Easy Peasy", fail: 0.55, red: 0.3, ground: 0.05 },
  medium: { label: "Medium Rare", fail: 0.25, red: 0.12, ground: 0.02 },
  hard: { label: "Hard Potatoes", fail: 0.25, red: 0.12, ground: 0.02 },
} as const;
export function chooseRivals(technician: Technician, count: number, random = Math.random): Technician[] {
  const pool = TECHNICIANS.filter((name) => name !== technician);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = pool[i], b = pool[j];
    if (a && b) { pool[i] = b; pool[j] = a; }
  }
  return pool.slice(0, Math.max(0, Math.min(MAX_PLAYERS, Math.floor(count)) - 1));
}
export const effectiveDifficulty = (difficulty: Difficulty, timTip = false): Difficulty => timTip ? "easy" : difficulty;
export function pinTuning(difficulty: Difficulty, stage = 0) {
  return difficulty === "easy"
    ? { speed: (1.4 + stage * 0.35) * 0.35, lo: 0.2, hi: 0.8, tries: 6 }
    : difficulty === "hard"
      ? { speed: (1.4 + stage * 0.35) * 1.45, lo: 0.48, hi: 0.56, tries: 1 }
      : { speed: 1.4 + stage * 0.35, lo: 0.42, hi: 0.62, tries: 3 };
}
export function dialTuning(difficulty: Difficulty, stage: number) {
  return difficulty === "easy"
    ? { speed: 45 + stage * 15, width: 110 - stage * 10, tries: 6 }
    : difficulty === "hard"
      ? { speed: 150 + stage * 55, width: Math.max(10, 22 - stage * 5), tries: 1 }
      : { speed: 105 + stage * 45, width: Math.max(18, 44 - stage * 10), tries: 3 };
}
export const TECHNICIAN_STYLE: Record<Technician, { shirt: string; pants: string; hair: string; beard: string | null; van: string; description: string }> = {
  Matt: { shirt: "#f0eee6", pants: "#466b90", hair: "#49352c", beard: "#49352c", van: "#d7ae42", description: "Suspenders. A steady hand. A pipe for the road." },
  Taylor: { shirt: "#659a8a", pants: "#405f85", hair: "#674637", beard: null, van: "#2f6fd8", description: "Packed, pressed, and ready for the next call." },
  Slade: { shirt: "#99794f", pants: "#4b7093", hair: "#262624", beard: null, van: "#d23b3b", description: "Short hair. Work shirt. Lunch is already packed." },
  RJ: { shirt: "#24262a", pants: "#4b6e91", hair: "#777775", beard: "#babbb6", van: "#2fa36a", description: "A familiar cap and half a cola left to go." },
  Opy: { shirt: "#3785bc", pants: "#41658a", hair: "#604335", beard: "#604335", van: "#d36f28", description: "Tall build. Curly hair. Never without his wrench." },
  Kevin: { shirt: "#b3a17b", pants: "#76775c", hair: "#564838", beard: "#756a5d", van: "#8b6cbd", description: "Mechanic khakis, cargo pockets, and sunglasses." },
};