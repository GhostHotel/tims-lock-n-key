export type JobType = "lockout" | "rekey" | "broken" | "safe";
export interface Job {
  id: number;
  type: JobType;
  client: string;
  address: string;
  x: number; // world x
  y: number; // world z
  pins: number;
  pay: number;
  expires: number;
}

export const JOB_INFO: Record<
  JobType,
  { label: string; desc: string; icon: string; color: string }
> = {
  lockout: { label: "Lockout", desc: "Locked out of the house", icon: "🚪", color: "#e8603c" },
  rekey: { label: "Rekey", desc: "New tenants, change the pins", icon: "🔑", color: "#f2b53a" },
  broken: {
    label: "Broken Lock",
    desc: "Key snapped in the cylinder",
    icon: "🔧",
    color: "#4fb3c9",
  },
  safe: { label: "Safe Crack", desc: "Lost the combination", icon: "🧰", color: "#b277d6" },
};

/** Which minigame a job type plays. Pins for doors, extraction for snapped keys, dial for safes. */
export const JOB_MINIGAME: Record<JobType, "pins" | "extract" | "dial"> = {
  lockout: "pins",
  rekey: "pins",
  broken: "extract",
  safe: "dial",
};

// City layout: grid of blocks, shop at the centre block.
export const BLOCK = 20;
export const BLOCK_HALF = 7;
export const GRID = 3; // blocks from -GRID..GRID
export const WORLD_HALF = GRID * BLOCK + 10;
export const SHOP_DOOR = { x: 0, z: 9 };

/** One block east of Tim's parking lot; the ring overlaps all four grid streets. */
export const MALL = {
  name: "Eastdale Mall",
  x: 40,
  z: 0,
  height: 8,
  halfX: 6,
  halfZ: 4.5,
  roadInner: 8,
  roadOuter: 12.5,
  doorZ: 9,
} as const;

/** Downtown: north-west blocks. Fountain roundabout at its heart, park across the street. */
export const FOUNTAIN = {
  name: "Court Square Fountain",
  x: -40,
  z: -40,
  roadInner: 8,
  roadOuter: 12.5,
  basin: 5,
} as const;
export const DOWNTOWN_PARK = { x: -20, z: -40 } as const;
export const STADIUM = {
  name: "Riverwalk Stadium",
  subtitle: "Home of the Biscuits",
  x: -40,
  z: -60,
  radius: 6.4,
  height: 7,
} as const;
export const TOWER_BLOCKS: [number, number][] = [
  [-60, -60],
  [-20, -60],
  [0, -60],
  [-60, -40],
  [0, -40],
  [-60, -20],
  [-40, -20],
  [-20, -20],
];
export const TOWER_NAMES = [
  "Commerce Tower",
  "Riverfront Plaza",
  "Dexter Center",
  "Alabama One",
  "Union Station Tower",
  "Capitol Bank Bldg",
  "Lanier Tower",
  "Court Square Tower",
];
const STOREFRONT_BLOCKS = ["0,-20", "-60,0", "-40,0", "-20,0", "20,-20", "20,-40", "20,-60"];

const STREETS = ["Elm St", "Harbor Rd", "5th Ave", "Maple Ct", "Union Sq", "Birch Ln", "Canal St"];
export interface Lot {
  cx: number;
  cz: number;
  h: number;
  color: string;
  door: { x: number; z: number };
  address: string;
  client?: string;
  kind?: "tower" | "storefront" | "stadium";
}
const COLORS = [
  "#c9774f",
  "#d9b48a",
  "#8fa58a",
  "#b8584a",
  "#e0c27a",
  "#7f97a8",
  "#a8836a",
  "#cfa0a0",
];
const TOWER_COLORS = ["#6f8796", "#8a9aa3", "#5b6f7d", "#9aa7a8", "#7d8a99", "#a39a8c", "#64798a", "#8c9fb0"];
export const LOTS: Lot[] = [];
for (let i = -GRID; i <= GRID; i++)
  for (let j = -GRID; j <= GRID; j++) {
    if ((i === 0 || i === 1 || i * BLOCK === MALL.x) && j === 0) continue; // shop, parking, mall
    const cx = i * BLOCK,
      cz = j * BLOCK;
    if (cx === FOUNTAIN.x && cz === FOUNTAIN.z) continue;
    if (cx === DOWNTOWN_PARK.x && cz === DOWNTOWN_PARK.z) continue;
    if (cx === STADIUM.x && cz === STADIUM.z) continue;
    const k = Math.abs(i * 7 + j * 13);
    const tower = TOWER_BLOCKS.findIndex(([x, z]) => x === cx && z === cz);
    const lot: Lot = {
      cx,
      cz,
      h: 3 + (k % 6) * 1.6,
      color: COLORS[k % COLORS.length]!,
      door: { x: cx, z: cz + 9 },
      address: `${100 + k * 11} ${STREETS[(i + GRID) % STREETS.length]!}`,
    };
    if (tower >= 0) {
      lot.kind = "tower";
      lot.h = 30 + ((tower * 7) % 5) * 6;
      lot.color = TOWER_COLORS[tower]!;
      lot.address = TOWER_NAMES[tower]!;
    } else if (STOREFRONT_BLOCKS.includes(`${cx},${cz}`)) lot.kind = "storefront";
    LOTS.push(lot);
  }
LOTS.push({
  cx: MALL.x,
  cz: MALL.z,
  h: MALL.height,
  color: "#c9774f",
  door: { x: MALL.x, z: MALL.z + MALL.doorZ },
  address: MALL.name,
  client: MALL.name,
});
LOTS.push({
  cx: STADIUM.x,
  cz: STADIUM.z,
  h: STADIUM.height,
  color: "#b8584a",
  door: { x: STADIUM.x, z: STADIUM.z + 9 },
  address: STADIUM.name,
  client: STADIUM.name,
  kind: "stadium",
});
export const ROUNDABOUTS = [MALL, FOUNTAIN] as const;

const NAMES = [
  "Mrs. Patel",
  "Joe's Diner",
  "Dr. Okafor",
  "Lena K.",
  "Riverside Apts",
  "Old Man Hu",
  "City Bank",
  "Tina & Rob",
  "Gym 24",
  "Pastor Gale",
];

let nextId = 1;
export function makeJob(now: number, level: number, taken: Job[] = []): Job {
  const types: JobType[] = ["lockout", "lockout", "rekey", "broken", "safe"];
  const type = types[Math.floor(Math.random() * types.length)]!;
  const pins = Math.min(
    8,
    3 + Math.floor(Math.random() * 2) + Math.floor(level / 2) + (type === "safe" ? 2 : 0),
  );
  const free = LOTS.filter((l) => !taken.some((t) => t.x === l.door.x && t.y === l.door.z));
  const lot = free[Math.floor(Math.random() * free.length)] ?? LOTS[0]!;
  return {
    id: nextId++,
    type,
    client: lot.client ?? NAMES[Math.floor(Math.random() * NAMES.length)] ?? "Customer",
    address: lot.address,
    x: lot.door.x,
    y: lot.door.z,
    pins,
    pay: pins * 25 + Math.floor(Math.random() * 40),
    expires: now + 75000 + Math.random() * 30000,
  };
}

export function distanceFromShop(j: Job) {
  return Math.round(Math.hypot(j.x - SHOP_DOOR.x, j.y - SHOP_DOOR.z));
}

// ---------- Sandbox rules ----------
export const LIGHT_CYCLE = 10; // seconds per green phase
export const YELLOW_S = 2; // seconds of yellow before red
export const RED_FINE = 50;
export const JIMMY_FINE = 50;
export const JIMMY_RESPAWN = 120; // seconds
export const TIM_SMOKE_CYCLE = 20; // seconds
export const TIM_WINDOW = 25000; // ms after talking to Tim
export const GROUND_MS = 120000;
export const TEMPER_FAIL = 20;
export const TEMPER_RED = 15;
export const TEMPER_LIMIT = 50;
export const TIM_POS = { x: 14.5, z: 5 };
export const PARKING = { x: BLOCK, z: 0 };

export type Axis = "z" | "x";
export type LightColor = "green" | "yellow" | "red";
/** Each axis gets LIGHT_CYCLE seconds: green, then YELLOW_S of yellow, then red while the other axis goes. */
export const lightState = (axis: Axis, t: number): LightColor => {
  const active: Axis = Math.floor(t / LIGHT_CYCLE) % 2 === 0 ? "z" : "x";
  if (axis !== active) return "red";
  return t % LIGHT_CYCLE < LIGHT_CYCLE - YELLOW_S ? "green" : "yellow";
};
export const timSmoking = (t: number) => Math.floor(t / TIM_SMOKE_CYCLE) % 2 === 0;
/** Updated by Tim's rendered animation, not the wall clock. */
export const timAnimationState = { smoking: false, elapsed: 0 };
export const addTemper = (temper: number, d: number) => Math.max(0, Math.min(100, temper + d));
export const popsGrounds = (temper: number) => temper > TEMPER_LIMIT;
export const timBoostActive = (talkedAt: number | null, now: number) =>
  talkedAt !== null && now - talkedAt <= TIM_WINDOW;
export function popsPos(t: number) {
  const x = -10 + Math.sin(t * 0.1) * 3;
  return { x, z: 7.8, face: Math.cos(t * 0.1) >= 0 ? Math.PI / 2 : -Math.PI / 2 };
}

// ---------- Business ----------
export const BUSINESS = "TIM'S LOCK & KEY";

/** Tim's rotating encouragement while he is out smoking. */
export const TIM_LINES = [
  "Slow your hands down, breathe, feel the pins.",
  "You rush, you snap a pick. Smooth is fast, kid.",
  "Every lock talks to you. Today, you're the one listening.",
  "One pin at a time. The door ain't going nowhere.",
  "Feel the click before you see it. That's the whole trick.",
];
export const TIM_BUSY = "I'm kinda busy at the moment, come back and see me a little later.";

export const POPS_FRIENDLY = [
  "Nice day for it, kid.",
  "Mind the curb out front — the council's been on me about it.",
  "You cut that last key crooked. I let it slide… this time.",
  "Tim's smoked half his life off that lot. Don't tell him I said so.",
];
export const POPS_ANGRY =
  "That's it! Back to the counter — you're cutting keys for 2 minutes, and don't slam the door!";

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
export const randomLine = pick;

export const jimmyLines = (label: string) => [
  `Heard about that ${label} you're eyeing? Easy money. Speaking of which — you got $50? Let's make it interesting.`,
  `That ${label} pays, huh? Tell you what — $50 says I finish mine first. Oops, there it goes.`,
  `Nice day for a round. Got $50 on you? Call it a… friendly bet on that ${label}.`,
];
export const jimmyLine = (label: string) => pick(jimmyLines(label));

// ---------- Rival technicians ----------
export const RIVAL_NAMES = ["Taylor", "Slade", "RJ"];
export const RIVAL_SPEED = 8; // world units per second
export const RIVAL_FAIL_CHANCE = 0.25;
export const RIVAL_RED_CHANCE = 0.12; // per job: ran a light, same $50 fine
export const RIVAL_GROUND_CHANCE = 0.02; // per tick: Pops grounds them too
export const RIVAL_WALKIN_CHANCE = 0.12; // per tick: cuts a walk-in key if one waits
export const RIVAL_CLAIM_CHANCE = 0.3; // per tick: grabs a call off the board

// ---------- Match ----------
export const GAME_MS = 600000; // 10-minute overall timer; most cash wins
export const WHITEBOARD_MS = 240000; // whiteboard photo rotates every 4 minutes
export const DAY_LENGTH = 240; // seconds for a full day + night cycle
/** 0 = full day, 1 = deep night; smooth sine over the day cycle. */
export const nightAmount = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * (t / DAY_LENGTH));

/** First sunset is halfway between noon and midnight; showers have explicit dry gaps. */
export const WEATHER = {
  firstRain: DAY_LENGTH / 4,
  period: 150,
  shower: 45,
  fade: 3,
} as const;
export function rainIntensity(t: number) {
  if (!Number.isFinite(t) || t <= WEATHER.firstRain) return 0;
  const phase = (t - WEATHER.firstRain) % WEATHER.period;
  if (phase >= WEATHER.shower) return 0;
  return Math.min(1, phase / WEATHER.fade, (WEATHER.shower - phase) / WEATHER.fade);
}

/** Aaron's telephone chatter, shown in a bubble every 3 seconds. */
export const AARON_LINES = [
  "Yeah, the brass blanks came in.",
  "No — change the pins first, then cut.",
  "Tell Tim the new key machine is fixed.",
  "Two lockouts before lunch already!",
  "Love you too. Bye.",
  "The van's still making that noise…",
];

export const ROAD_LINES: number[] = [];
for (let r = -GRID; r < GRID; r++) ROAD_LINES.push(r * BLOCK + BLOCK / 2);

/** Checkerboard junctions: half the intersections have signals. */
export const SIGNAL_JUNCTIONS = ROAD_LINES.flatMap((x, i) =>
  ROAD_LINES.filter((_, j) => (i + j) % 2 === 0).map((z) => ({ x, z })),
);
export const signalFacing = (axis: Axis, direction: 1 | -1) =>
  axis === "z" ? (direction === 1 ? Math.PI : 0) : direction === 1 ? -Math.PI / 2 : Math.PI / 2;
export const isRedViolation = (axis: Axis, t: number, x: number, z: number) =>
  SIGNAL_JUNCTIONS.some((p) => p.x === x && p.z === z) && lightState(axis, t) === "red";

// Minigame feel is shared by the animation and rule tests.
export const extractionTuning = (easy: boolean, difficulty: "easy" | "medium" | "hard" = "medium") => ({
  speed: difficulty === "easy" ? 0.8 : easy ? 1.2 : difficulty === "hard" ? 2.5 : 1.8,
  half: difficulty === "easy" ? 0.36 : easy ? 0.23 : difficulty === "hard" ? 0.09 : 0.16,
  pull: difficulty === "easy" ? 46 : difficulty === "hard" ? 26 : 34,
  risk: difficulty === "easy" ? 12 : easy ? 26 : difficulty === "hard" ? 65 : 36,
  recovery: difficulty === "hard" ? 20 : 30,
  slip: difficulty === "hard" ? 1.5 : 0.5,
});
export function stepExtraction(
  progress: number,
  risk: number,
  position: number,
  holding: boolean,
  dt: number,
  easy: boolean,
  difficulty: "easy" | "medium" | "hard" = "medium",
) {
  const tuning = extractionTuning(easy, difficulty);
  if (!holding)
    return {
      progress: Math.max(0, progress - tuning.slip * dt),
      risk: Math.max(0, risk - tuning.recovery * dt),
    };
  if (Math.abs(position - 0.5) < tuning.half)
    return {
      progress: Math.min(100, progress + tuning.pull * dt),
      risk: Math.max(0, risk - 10 * dt),
    };
  return { progress, risk: Math.min(100, risk + tuning.risk * dt) };
}
export const safeWedgeWidth = (stage: number) => Math.max(18, 44 - stage * 10);
/** Angles are clockwise from twelve o'clock, matching the rendered dial. */
export const safeHit = (angle: number, zone: number, width: number) =>
  Math.abs(((angle - zone + 540) % 360) - 180) <= width / 2;

/** Push a circle out of a rounded square block. Returns the push normal or null. */
export function roundedPush(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  half: number,
  r: number,
  rad: number,
) {
  const dx = px - cx,
    dz = pz - cz;
  const qx = Math.abs(dx) - (half - r),
    qz = Math.abs(dz) - (half - r);
  const ox = Math.max(qx, 0),
    oz = Math.max(qz, 0);
  const outside = Math.hypot(ox, oz);
  const dist = outside + Math.min(Math.max(qx, qz), 0) - r;
  if (dist >= rad) return null;
  let nx: number, nz: number;
  if (outside > 1e-6) {
    nx = (ox / outside) * Math.sign(dx);
    nz = (oz / outside) * Math.sign(dz);
  } else if (qx > qz) {
    nx = Math.sign(dx) || 1;
    nz = 0;
  } else {
    nx = 0;
    nz = Math.sign(dz) || 1;
  }
  const push = rad - dist;
  return { x: px + nx * push, z: pz + nz * push, nx, nz };
}

// Solid footprints only: sidewalks, grass and parking are intentionally drivable.
export const BUILDING_COLLIDERS = [
  { x: 0, z: -1, halfX: 5.5, halfZ: 2 },
  { x: 0, z: 3, halfX: 5.5, halfZ: 2 },
  ...LOTS.map((lot) =>
    lot.client === MALL.name
      ? { x: MALL.x, z: MALL.z, halfX: MALL.halfX, halfZ: MALL.halfZ }
      : lot.kind === "stadium"
        ? { x: lot.cx, z: lot.cz, halfX: STADIUM.radius, halfZ: STADIUM.radius + 0.6 }
        : lot.kind === "tower"
          ? { x: lot.cx, z: lot.cz, halfX: 5, halfZ: 5 }
          : { x: lot.cx, z: lot.cz + 1, halfX: 4, halfZ: 3.5 },
  ),
  { x: FOUNTAIN.x, z: FOUNTAIN.z, halfX: FOUNTAIN.basin - 0.6, halfZ: FOUNTAIN.basin - 0.6 },
];
export function buildingPush(x: number, z: number, radius = 1.1) {
  for (const box of BUILDING_COLLIDERS) {
    const closestX = Math.max(box.x - box.halfX, Math.min(box.x + box.halfX, x));
    const closestZ = Math.max(box.z - box.halfZ, Math.min(box.z + box.halfZ, z));
    const dx = x - closestX,
      dz = z - closestZ,
      distance = Math.hypot(dx, dz);
    if (distance >= radius) continue;
    if (distance > 0.00001) {
      const nx = dx / distance,
        nz = dz / distance;
      return { x: closestX + nx * radius, z: closestZ + nz * radius, nx, nz };
    }
    const edgeX = box.halfX - Math.abs(x - box.x),
      edgeZ = box.halfZ - Math.abs(z - box.z);
    if (edgeX < edgeZ) {
      const nx = Math.sign(x - box.x) || 1;
      return { x: box.x + nx * (box.halfX + radius), z, nx, nz: 0 };
    }
    const nz = Math.sign(z - box.z) || 1;
    return { x, z: box.z + nz * (box.halfZ + radius), nx: 0, nz };
  }
  return null;
}
/** A short smooth ramp lets wheels climb the visual curb without a hard bump. */
export function drivingSurfaceHeight(x: number, z: number) {
  for (const ring of ROUNDABOUTS) {
    const distance = Math.hypot(x - ring.x, z - ring.z);
    if (distance <= ring.roadOuter) {
      const ramp = Math.max(0, Math.min(1, (ring.roadInner - distance) / 0.8));
      return 0.24 * ramp * ramp * (3 - 2 * ramp);
    }
  }
  const cx = Math.round(x / BLOCK) * BLOCK,
    cz = Math.round(z / BLOCK) * BLOCK;
  if (Math.abs(cx) > GRID * BLOCK || Math.abs(cz) > GRID * BLOCK || (cx === BLOCK && cz === 0))
    return 0;
  const inset = BLOCK_HALF - Math.max(Math.abs(x - cx), Math.abs(z - cz));
  const ramp = Math.max(0, Math.min(1, (inset + 0.4) / 0.8));
  return (cx === 0 && cz === 0 ? 0.24 : 0.35) * ramp * ramp * (3 - 2 * ramp);
}

export interface Car {
  axis: Axis;
  dir: 1 | -1;
  lane: number;
  pos: number;
  v: number;
  color: string;
}
export const CAR_SPEED = 7;
export function makeTraffic(n = 10): Car[] {
  const cols = ["#d4483b", "#3f6fb0", "#e8e2d4", "#2f2f33", "#5a8f5a", "#d9a43a"];
  return Array.from({ length: n }, (_, i) => {
    const dir = (i % 4 < 2 ? 1 : -1) as 1 | -1;
    const line = ROAD_LINES[(i * 2 + 1) % ROAD_LINES.length]!;
    return {
      axis: (i % 2 ? "x" : "z") as Axis,
      dir,
      lane: line + dir * 1.6,
      pos: -WORLD_HALF + ((i * 37) % (WORLD_HALF * 2)),
      v: CAR_SPEED,
      color: cols[i % cols.length]!,
    };
  });
}
export const carXZ = (c: Car) =>
  c.axis === "x" ? { x: c.pos, z: c.lane } : { x: c.lane, z: c.pos };
export function stepCar(c: Car, dt: number, t: number, van: { x: number; z: number }) {
  let target = CAR_SPEED;
  if (lightState(c.axis, t) !== "green") {
    for (const junction of SIGNAL_JUNCTIONS) {
      if ((c.axis === "x" ? junction.z : junction.x) !== c.lane - c.dir * 1.6) continue;
      const L = c.axis === "x" ? junction.x : junction.z;
      const d = (L - c.pos) * c.dir;
      if (d > 4.5 && d < 8) target = 0;
    }
  }
  const along = c.axis === "x" ? van.x : van.z,
    lat = c.axis === "x" ? van.z : van.x;
  const da = (along - c.pos) * c.dir;
  if (da > 0 && da < 6 && Math.abs(lat - c.lane) < 2.2) target = 0;
  c.v += (target - c.v) * Math.min(1, dt * 3);
  c.pos += c.v * c.dir * dt;
  if (c.pos * c.dir > WORLD_HALF) c.pos = -c.dir * WORLD_HALF;
}
