import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addTemper,
  BUSINESS,
  distanceFromShop,
  GAME_MS,
  GROUND_MS,
  JIMMY_FINE,
  JOB_INFO,
  JOB_MINIGAME,
  makeJob,
  POPS_ANGRY,
  POPS_FRIENDLY,
  popsGrounds,
  randomLine,
  RED_FINE,
  RIVAL_CLAIM_CHANCE,
  RIVAL_FAIL_CHANCE,
  RIVAL_GROUND_CHANCE,
  RIVAL_NAMES,
  RIVAL_RED_CHANCE,
  RIVAL_SPEED,
  RIVAL_WALKIN_CHANCE,
  TEMPER_FAIL,
  TEMPER_RED,
  TIM_BUSY,
  TIM_LINES,
  TIM_WINDOW,
  timBoostActive,
  timAnimationState,
  jimmyLine,
  type Job,
  type JobType,
} from "@/lib/game";
import { LockPick } from "@/components/LockPick";
import { KeyExtract, SafeDial } from "@/components/Minigames";
import { City3D, type Input, type SandboxEvent } from "@/components/City3D";
import { Button } from "@/components/ui/button";
import { Radio, Save } from "lucide-react";
import { sfx, setMuted, startBackgroundAudio, stopBackgroundAudio } from "@/lib/sfx";
import { drivingInput, resetGameInput, setTouchInput } from "@/lib/driving-input";
import { RadioPlaylist } from "@/lib/radio";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tim's Lock & Key — 3D Locksmith Game" },
      {
        name: "description",
        content:
          "Drive your locksmith van around a 3D city, answer dispatch calls and pick locks — but watch out for Taylor, Slade and RJ.",
      },
      { property: "og:title", content: "Tim's Lock & Key — 3D Locksmith Game" },
      {
        property: "og:description",
        content:
          "Run the shop, race the rivals, and have the most cash when the 10-minute bell rings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Game,
});

const SAVE_KEY = "tims-lock-key-save-v1";
const RIVAL_COLORS: Record<string, string> = { Taylor: "#4f8fb0", Slade: "#b06bd4", RJ: "#5aaf82" };

interface Rival {
  name: string;
  cash: number;
  done: number;
  groundedUntil: number;
  job: Job | null;
  eta: number;
}

type Phase =
  | { k: "drive" }
  | { k: "tim"; line: string }
  | { k: "timbusy" }
  | { k: "pops"; angry: boolean; line: string }
  | { k: "jimmy"; line: string }
  | { k: "working"; job: Job; easy: boolean }
  | { k: "result"; job: Job; ok: boolean }
  | { k: "over" };

const UPGRADES = [
  { id: "van", name: "Faster Van", cost: 150, desc: "Top speed +50%" },
  { id: "picks", name: "Pro Pick Set", cost: 200, desc: "+20% pay per job" },
  { id: "radio", name: "Dispatch Radio", cost: 120, desc: "More calls come in" },
];

function loadSave(): { cash: number; rep: number; owned: string[] } {
  const fresh = { cash: 50, rep: 0, owned: [] as string[] };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (s && typeof s.cash === "number")
      return { cash: s.cash, rep: s.rep || 0, owned: Array.isArray(s.owned) ? s.owned : [] };
  } catch {
    /* fresh start */
  }
  return fresh;
}

function Game() {
  const [cash, setCash] = useState(() => loadSave().cash);
  const [rep, setRep] = useState(() => loadSave().rep);
  const [owned, setOwned] = useState<string[]>(() => loadSave().owned);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rivals, setRivals] = useState<Rival[]>(() =>
    RIVAL_NAMES.map((name) => ({ name, cash: 0, done: 0, groundedUntil: 0, job: null, eta: 0 })),
  );
  const [phase, setPhase] = useState<Phase>({ k: "drive" });
  const [now, setNow] = useState(0);
  const [log, setLog] = useState<string[]>(["☕ Shop's open. Phones are ringing."]);
  const [walkin, setWalkin] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [atShop, setAtShop] = useState(true);
  const [showDispatch, setShowDispatch] = useState(false);
  const [temper, setTemper] = useState(10);
  const [timAt, setTimAt] = useState<number | null>(null);
  const [groundedUntil, setGroundedUntil] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Save progress");
  const [muted, setMutedState] = useState(false);
  const [radioOn, setRadioOn] = useState(false);
  const [radioError, setRadioError] = useState(false);
  const radio = useRef<RadioPlaylist | null>(null);
  const startedAt = useRef<number | null>(null);
  const grounded = now < groundedUntil;
  const st = useRef({ timAt, temper, phase, target, walkin, rivals });
  st.current = { timAt, temper, phase, target, walkin, rivals };
  const input = useRef<Input>(drivingInput);
  const closeDialog = useCallback(() => {
    resetGameInput();
    setPhase({ k: "drive" });
  }, []);
  const closeDispatch = () => {
    resetGameInput();
    setShowDispatch(false);
  };
  useEffect(() => {
    resetGameInput();
  }, [phase.k, grounded, showDispatch]);
  useEffect(() => {
    radio.current = new RadioPlaylist(new Audio(), undefined, () => {
      setRadioOn(false);
      setRadioError(true);
    });
    const start = () => startBackgroundAudio();
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      radio.current?.dispose();
      radio.current = null;
      stopBackgroundAudio();
      resetGameInput();
    };
  }, []);
  const level = Math.floor(rep / 5);
  const payMul = owned.includes("picks") ? 1.2 : 1;
  const addLog = (m: string) => setLog((l) => [m, ...l].slice(0, 4));
  const setResetVan = () => setResetKey((k) => k + 1);

  const saveProgress = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash, rep, owned }));
      setSaveStatus("Saved on this device");
    } catch {
      setSaveStatus("Save failed — storage unavailable");
    }
  };

  // Dev-only playback probes enter actual game states without waiting for slow software rendering.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = {
      get state() {
        return { cash, rep, owned, phase: phase.k, rivals };
      },
      minigame: (type: JobType, easy = false) =>
        setPhase({ k: "working", job: { ...makeJob(Date.now(), 0), type }, easy }),
      dialog: () => setPhase({ k: "tim", line: TIM_LINES[0] ?? "" }),
      upgrade: () => setOwned((items) => [...new Set([...items, "van"])]),
      close: closeDialog,
    };
    Object.assign(window, { __game: debug });
    return () => {
      Reflect.deleteProperty(window, "__game");
    };
  }, [cash, rep, owned, phase, rivals, closeDialog]);

  // ---- saved progress ----
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash, rep, owned }));
    } catch {
      /* ignore */
    }
  }, [cash, rep, owned]);

  // ---- clock + first jobs ----
  useEffect(() => {
    const t = Date.now();
    startedAt.current = t;
    setNow(t);
    const a = makeJob(t, 0);
    setJobs([a, makeJob(t, 0, [a])]);
    setRivals(
      RIVAL_NAMES.map((name) => ({
        name,
        cash: loadSave().cash,
        done: 0,
        groundedUntil: 0,
        job: null,
        eta: 0,
      })),
    );
    addLog("🏁 10 minutes on the clock — most cash wins. Taylor, Slade and RJ are racing you.");
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  // ---- per-tick world: calls, walk-ins, temper, and the rivals' day ----
  useEffect(() => {
    if (!now) return;
    const chance = owned.includes("radio") ? 0.22 : 0.12;
    setJobs((js) => {
      let next = js.filter((j) => j.expires > now);
      if (next.length < js.length) addLog("📵 A caller hung up — too slow.");
      if (next.length < 6 && Math.random() < chance) {
        const j = makeJob(now, level, next);
        next = [...next, j];
        sfx.ring();
        addLog(`📞 ${j.client}: ${JOB_INFO[j.type].desc.toLowerCase()} at ${j.address}`);
      }
      return next;
    });
    if (Math.random() < 0.15) setWalkin((w) => Math.min(5, w + 1));
    setTemper((t) => addTemper(t, -0.25));

    // rivals: same rules, same fines, fair odds
    const rs = st.current.rivals.map((r) => ({ ...r }));
    const claimed = new Set<number>();
    let dirty = false;
    for (const r of rs) {
      if (now < r.groundedUntil) continue;
      if (r.job && now >= r.eta) {
        dirty = true;
        if (Math.random() > RIVAL_FAIL_CHANCE) {
          r.cash += r.job.pay;
          r.done += 1;
          addLog(
            `🔧 ${r.name} finished the ${JOB_INFO[r.job.type].label.toLowerCase()} at ${r.job.address} (+$${r.job.pay}).`,
          );
        } else {
          addLog(
            `❌ ${r.name} botched the ${JOB_INFO[r.job.type].label.toLowerCase()} at ${r.job.address}.`,
          );
        }
        r.job = null;
      } else if (
        !r.job &&
        startedAt.current &&
        now - startedAt.current >= 20000 && // they let the first calls sit for 20s
        jobsRef.current.length - claimed.size > 1 && // they always leave a call for you
        Math.random() < RIVAL_CLAIM_CHANCE
      ) {
        const pool = jobsRef.current.filter(
          (j) => !claimed.has(j.id) && j.expires > now && j.id !== st.current.target,
        ); // never steal your marked job
        if (pool.length) {
          const j = pool[Math.floor(Math.random() * pool.length)]!;
          claimed.add(j.id);
          dirty = true;
          r.job = j;
          r.eta = now + Math.max(10000, ((distanceFromShop(j) * 2) / RIVAL_SPEED) * 1000 + 8000); // drive there, work, drive back
          if (Math.random() < RIVAL_RED_CHANCE) {
            r.cash -= RED_FINE;
            addLog(`🚦 ${r.name} ran a light on the way — -$${RED_FINE}.`);
          }
          addLog(
            `🔧 ${r.name} grabbed the ${JOB_INFO[j.type].label.toLowerCase()} at ${j.address}.`,
          );
        }
      }
      if (!r.job && Math.random() < RIVAL_GROUND_CHANCE) {
        dirty = true;
        r.groundedUntil = now + GROUND_MS / 2;
        addLog(`😠 Pops grounded ${r.name} — back at the counter for a minute.`);
      }
      if (st.current.walkin > 0 && Math.random() < RIVAL_WALKIN_CHANCE) {
        dirty = true;
        setWalkin((w) => Math.max(0, w - 1));
        r.cash += 8;
        addLog(`🔑 ${r.name} cut a walk-in key (+$8).`);
      }
    }
    if (dirty) setRivals(rs);
    if (claimed.size) setJobs((js) => js.filter((j) => !claimed.has(j.id)));

    // match timer
    if (startedAt.current && now >= startedAt.current + GAME_MS && st.current.phase.k !== "over") {
      setPhase({ k: "over" });
    }
  }, [now, level, owned]);

  const onArrive = useCallback((id: number) => {
    const job = jobsRef.current.find((j) => j.id === id);
    if (!job) return;
    setJobs((js) => js.filter((x) => x.id !== id));
    setTarget(null);
    resetGameInput();
    setShowDispatch(false);
    setPhase({ k: "working", job, easy: timBoostActive(st.current.timAt, Date.now()) });
    setTimAt(null);
  }, []);

  const onEvent = useCallback((e: SandboxEvent) => {
    if (e === "red") {
      setCash((c) => c - RED_FINE);
      setTemper((t) => addTemper(t, TEMPER_RED));
      sfx.fine();
      addLog(`🚦 Ran a red light! -$${RED_FINE}. Pops is grumbling.`);
    } else if (e === "jimmy") {
      const label =
        (st.current.target
          ? JOB_INFO[jobsRef.current.find((j) => j.id === st.current.target)?.type ?? "lockout"]
              ?.label
          : randomLine(["lockout", "rekey", "broken lock", "safe job"])
        )?.toLowerCase() ?? "job";
      const line = jimmyLine(label);
      setCash((c) => c - JIMMY_FINE);
      sfx.fine();
      addLog(`⛳ Jimmy: "${line}" -$${JIMMY_FINE}.`);
      setPhase({ k: "jimmy", line });
    } else if (e === "tim") {
      if (st.current.phase.k !== "drive") return;
      if (timAnimationState.smoking) setPhase({ k: "tim", line: randomLine(TIM_LINES) });
      else setPhase({ k: "timbusy" });
    } else if (e === "pops") {
      if (st.current.phase.k !== "drive") return;
      if (popsGrounds(st.current.temper)) setPhase({ k: "pops", angry: true, line: POPS_ANGRY });
      else setPhase({ k: "pops", angry: false, line: randomLine(POPS_FRIENDLY) });
    }
  }, []);

  const finishPops = () => {
    if (phase.k === "pops" && phase.angry) {
      setGroundedUntil(Date.now() + GROUND_MS);
      setResetVan();
      setTarget(null);
      setShowDispatch(false);
      sfx.fine();
      addLog('👴 Pops: "Back to the counter! You\'re cutting keys for 2 minutes."');
    }
    closeDialog();
  };

  const finish = (job: Job, ok: boolean) => {
    resetGameInput();
    if (ok) {
      const pay = Math.round(job.pay * payMul);
      setCash((c) => c + pay);
      setRep((r) => r + 1);
      sfx.unlock();
      sfx.cash();
      addLog(`✅ ${job.client} paid $${pay}. Happy customer!`);
    } else {
      setRep((r) => Math.max(0, r - 1));
      setTemper((t) => addTemper(t, TEMPER_FAIL));
      sfx.snap();
      addLog(`❌ Snapped a pick at ${job.address}.`);
    }
    setPhase({ k: "result", job, ok });
  };

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (phase.k === "drive" && !grounded && !showDispatch) setTouchInput(k, true);
    },
    onPointerUp: () => setTouchInput(k, false),
    onPointerLeave: () => setTouchInput(k, false),
    onPointerCancel: () => setTouchInput(k, false),
    onLostPointerCapture: () => setTouchInput(k, false),
  });
  const pad =
    "flex h-16 w-16 select-none items-center justify-center rounded-full border-2 border-primary/60 bg-background/70 text-2xl text-primary backdrop-blur active:bg-primary active:text-primary-foreground touch-none";
  const targetJob = jobs.find((j) => j.id === target);
  const remaining = startedAt.current ? Math.max(0, startedAt.current + GAME_MS - now) : GAME_MS;
  const clock = `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
  const standings = [
    ...[{ name: "You", cash, color: "#f2b53a" }],
    ...rivals.map((r) => ({ name: r.name, cash: r.cash, color: RIVAL_COLORS[r.name] ?? "#999" })),
  ].sort((a, b) => b.cash - a.cash);
  const dialog = phase.k !== "drive";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <div className="game-scene absolute inset-0 isolate z-0" data-dialog-open={dialog}>
        <City3D
          jobs={jobs}
          targetId={target}
          freezeScene={dialog}
          paused={phase.k !== "drive" || grounded || showDispatch}
          speedMul={owned.includes("van") ? 1.5 : 1}
          input={input}
          onArrive={onArrive}
          onShop={setAtShop}
          onEvent={onEvent}
          resetKey={resetKey}
          popsTemper={temper}
        />
      </div>

      {/* HUD */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-1 p-2 sm:gap-2 sm:p-3">
        <h1 className="min-w-0 rounded-md bg-background/80 px-2 font-display text-sm sm:text-xl tracking-wider text-primary backdrop-blur">
          {BUSINESS}
        </h1>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="unstyled"
            size="free"
            title={saveStatus}
            aria-label="Save progress"
            className="pointer-events-auto flex items-center gap-2 rounded-md bg-card px-3 py-2 text-xs"
            onClick={saveProgress}
          >
            <Save />
            <span className="hidden sm:inline">{saveStatus}</span>
          </Button>
          <div className="flex shrink-0 gap-1 rounded-md bg-background/80 px-2 py-1 font-mono text-xs sm:gap-2 sm:text-sm backdrop-blur">
            <span className="text-success">${cash}</span>
            <span>⭐ {rep}</span>
            <span className="hidden text-muted-foreground sm:inline">LV {level + 1}</span>
          </div>
          <Button
            variant="unstyled"
            size="free"
            title={muted ? "Unmute all sound" : "Mute all sound"}
            aria-label={muted ? "Unmute" : "Mute"}
            className="pointer-events-auto rounded-md bg-background/80 px-2 py-1 text-sm backdrop-blur"
            onClick={() => {
              setMuted(!muted);
              radio.current?.setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? "🔇" : "🔊"}
          </Button>
          <Button
            variant="unstyled"
            size="free"
            aria-label={radioOn ? "Radio Off" : "Radio On"}
            aria-pressed={radioOn}
            title={
              radioError ? "Radio unavailable — try again" : radioOn ? "Radio Off" : "Radio On"
            }
            className={`pointer-events-auto flex h-8 items-center gap-1 rounded-md bg-background/80 px-2 text-xs backdrop-blur ${radioOn ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => {
              const on = !radioOn;
              setRadioError(false);
              setRadioOn(on);
              radio.current?.setOn(on);
            }}
          >
            <Radio size={14} />
            <span className="hidden sm:inline">Radio</span>
            <span>{radioOn ? "On" : "Off"}</span>
          </Button>
        </div>
      </header>

      {/* match clock + standings */}
      <div className="pointer-events-none absolute right-3 top-16 flex flex-col items-end gap-1 sm:flex-row sm:top-14">
        <div
          className={`rounded-md px-3 py-1 font-mono text-sm backdrop-blur ${remaining < 60000 ? "bg-destructive text-destructive-foreground" : "bg-background/80"}`}
        >
          ⏱ {clock}
        </div>
        <div className="rounded-md bg-background/80 px-3 py-1 font-mono text-[10px] sm:text-xs backdrop-blur">
          {standings.map((s, i) => (
            <span key={s.name} className={i === 0 ? "text-success" : "text-muted-foreground"}>
              {" "}
              {s.name} ${s.cash}
              {i < standings.length - 1 ? " ·" : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute left-3 top-14 w-[min(92vw,340px)] space-y-2">
        {grounded && (
          <div className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground">
            👴 Grounded by Pops · {Math.ceil((groundedUntil - now) / 1000)}s · cut keys only
          </div>
        )}
        {timBoostActive(timAt, now) && (
          <div className="rounded-lg bg-success px-3 py-2 text-sm font-semibold text-background">
            🚬 Tim's tip: reach a job in{" "}
            {Math.max(0, Math.ceil(((timAt ?? now) + TIM_WINDOW - now) / 1000))}s for an easier lock
          </div>
        )}
        <Button
          variant="unstyled"
          size="free"
          disabled={grounded}
          onClick={() => {
            resetGameInput();
            if (showDispatch) closeDispatch();
            else setShowDispatch(true);
          }}
          className="block rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          📻 Dispatch ({jobs.length}) {showDispatch ? "▴" : "▾"}
        </Button>
        {targetJob && !showDispatch && (
          <div className="rounded-lg bg-card px-3 py-2 text-xs">
            🎯 {JOB_INFO[targetJob.type].icon} {targetJob.address} ·{" "}
            <span className="text-destructive">
              {Math.max(0, Math.round((targetJob.expires - now) / 1000))}s
            </span>
          </div>
        )}
        {showDispatch && (
          <div className="max-h-[45dvh] space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {jobs.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">Quiet… waiting for calls.</p>
            )}
            {jobs.map((j) => (
              <Button
                variant="unstyled"
                size="free"
                key={j.id}
                onClick={() => {
                  setTarget(j.id);
                  closeDispatch();
                }}
                className={`flex w-full items-center gap-2 rounded-lg border p-2 text-left ${j.id === target ? "border-primary" : "border-border"}`}
              >
                <span className="text-xl">{JOB_INFO[j.type].icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {JOB_INFO[j.type].label} · {j.client}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {j.address} · {j.pins} pins · {distanceFromShop(j)}m
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm text-success">${Math.round(j.pay * payMul)}</div>
                  <div className="text-xs text-destructive">
                    {Math.max(0, Math.round((j.expires - now) / 1000))}s
                  </div>
                </div>
              </Button>
            ))}
            <ul className="space-y-0.5 border-t border-border p-2 text-xs">
              {log.map((l, i) => (
                <li key={i} className={i ? "text-muted-foreground" : ""}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Shop counter when parked at the shop */}
      {atShop && phase.k === "drive" && !showDispatch && (
        <div className="shop-front absolute left-1/2 top-32 w-[min(92vw,420px)] sm:bottom-6 sm:top-auto -translate-x-1/2 rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-wide">Shop Counter</h2>
            <span className="text-sm">
              {"🧍".repeat(walkin) || <span className="text-muted-foreground">No one waiting</span>}
            </span>
          </div>
          <Button
            variant="unstyled"
            size="free"
            onClick={() => {
              if (walkin) {
                setWalkin(walkin - 1);
                setCash((c) => c + 8);
                sfx.cash();
              }
            }}
            disabled={!walkin}
            className="w-full rounded-lg border border-primary bg-background/60 py-2 text-sm font-semibold text-primary disabled:opacity-40"
          >
            Cut a key for walk-in (+$8)
          </Button>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {UPGRADES.map((u) => {
              const has = owned.includes(u.id);
              return (
                <Button
                  variant="unstyled"
                  size="free"
                  key={u.id}
                  disabled={has || cash < u.cost || grounded}
                  onClick={() => {
                    setCash(cash - u.cost);
                    setOwned([...owned, u.id]);
                    sfx.cash();
                  }}
                  className="rounded-lg border border-border bg-card p-2 text-left disabled:opacity-50"
                >
                  <div className="text-xs font-semibold">{u.name}</div>
                  <div className="text-[10px] text-muted-foreground">{u.desc}</div>
                  <div className="font-mono text-xs text-primary">
                    {has ? "OWNED" : `$${u.cost}`}
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Driving controls */}
      {phase.k === "drive" && !grounded && (
        <>
          <div className="absolute bottom-12 left-4 flex gap-3">
            <Button
              variant="unstyled"
              size="free"
              aria-label="Steer left"
              className={pad}
              {...hold("left")}
            >
              ◀
            </Button>
            <Button
              variant="unstyled"
              size="free"
              aria-label="Steer right"
              className={pad}
              {...hold("right")}
            >
              ▶
            </Button>
          </div>
          <div className="absolute bottom-12 right-4 flex flex-col gap-3">
            <Button variant="unstyled" size="free" aria-label="Gas" className={pad} {...hold("up")}>
              ▲
            </Button>
            <Button
              variant="unstyled"
              size="free"
              aria-label="Reverse"
              className={pad}
              {...hold("down")}
            >
              ▼
            </Button>
          </div>
          <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 text-xs text-foreground/80 sm:block">
            WASD / arrows to drive · drive into a marker to take the job
          </p>
        </>
      )}

      {/* Pops' temper meter */}
      <div className="pointer-events-none absolute bottom-2 left-2 w-36 rounded-md bg-background/80 px-2 py-1 backdrop-blur">
        <div className="flex justify-between font-mono text-[10px]">
          <span>👴 POPS TEMPER</span>
          <span>{Math.round(temper)}/100</span>
        </div>
        <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${temper > 50 ? "bg-destructive" : "bg-success"}`}
            style={{ width: `${temper}%` }}
          />
        </div>
      </div>

      {/* Dialogs + job overlays — fully solid so scene labels never show through */}
      {dialog && (
        <div className="absolute inset-0 z-50 isolate flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4">
            {(phase.k === "tim" || phase.k === "timbusy") && (
              <div className="space-y-3">
                <h2 className="font-display text-xl">🚬 Tim</h2>
                <p className="text-sm">"{phase.k === "tim" ? phase.line : TIM_BUSY}"</p>
                {phase.k === "tim" && (
                  <p className="text-xs text-muted-foreground">
                    Reach your next job within {TIM_WINDOW / 1000}s and the lock goes easy on you.
                  </p>
                )}
                <Button
                  variant="unstyled"
                  size="free"
                  onClick={() => {
                    if (phase.k === "tim" && timAnimationState.smoking) {
                      setTimAt(Date.now());
                      setNow(Date.now());
                    }
                    closeDialog();
                  }}
                  className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground"
                >
                  {phase.k === "tim" ? "Thanks, Tim" : "Catch you later, Tim"}
                </Button>
              </div>
            )}
            {phase.k === "pops" && (
              <div className="space-y-3">
                <h2 className="font-display text-xl">{phase.angry ? "😠 Pops" : "👴 Pops"}</h2>
                <p className="text-sm">"{phase.line}"</p>
                {phase.angry && (
                  <p className="text-xs text-muted-foreground">
                    Temper over the limit — grounded at the counter for 2 minutes.
                  </p>
                )}
                <Button
                  variant="unstyled"
                  size="free"
                  onClick={finishPops}
                  className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground"
                >
                  {phase.angry ? "Yes, Pops…" : "See you, Pops"}
                </Button>
              </div>
            )}
            {phase.k === "jimmy" && (
              <div className="space-y-3">
                <h2 className="font-display text-xl">⛳ Jimmy</h2>
                <p className="text-sm">"{phase.line}"</p>
                <p className="text-xs text-muted-foreground">There goes your $50.</p>
                <Button
                  variant="unstyled"
                  size="free"
                  onClick={closeDialog}
                  className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground"
                >
                  Walk away
                </Button>
              </div>
            )}
            {phase.k === "working" && (
              <>
                <h2 className="mb-1 font-display text-xl">
                  {JOB_INFO[phase.job.type].icon} {phase.job.client}
                </h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  {JOB_INFO[phase.job.type].desc} · {phase.job.address}
                </p>
                {JOB_MINIGAME[phase.job.type] === "pins" && (
                  <LockPick
                    pins={phase.job.pins}
                    easy={phase.easy}
                    onDone={(ok) => finish(phase.job, ok)}
                  />
                )}
                {JOB_MINIGAME[phase.job.type] === "extract" && (
                  <KeyExtract easy={phase.easy} onDone={(ok) => finish(phase.job, ok)} />
                )}
                {JOB_MINIGAME[phase.job.type] === "dial" && (
                  <SafeDial easy={phase.easy} onDone={(ok) => finish(phase.job, ok)} />
                )}
              </>
            )}
            {phase.k === "result" && (
              <div className="py-6 text-center">
                <div className="text-5xl">{phase.ok ? "🔓" : "🔒"}</div>
                <p className="mt-3 font-display text-2xl">
                  {phase.ok ? "Door's open!" : "Job failed"}
                </p>
                <Button
                  variant="unstyled"
                  size="free"
                  onClick={closeDialog}
                  className="mt-4 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
                >
                  Back in the van
                </Button>
              </div>
            )}
            {phase.k === "over" && (
              <div className="py-4 text-center">
                <div className="text-5xl">🔔</div>
                <p className="mt-2 font-display text-2xl">Time's up!</p>
                <ul className="mt-4 space-y-1 text-left">
                  {standings.map((s, i) => (
                    <li
                      key={s.name}
                      className={`flex justify-between rounded-lg px-3 py-2 text-sm font-semibold ${i === 0 ? "bg-success/20 text-success" : "bg-muted"}`}
                    >
                      <span>
                        {i + 1}. {s.name}
                      </span>
                      <span className="font-mono">${s.cash}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm">
                  {standings[0]?.name === "You"
                    ? "🏆 You win — best locksmith in town!"
                    : `🏆 ${standings[0]?.name} takes it. Rematch?`}
                </p>
                <Button
                  variant="unstyled"
                  size="free"
                  onClick={() => {
                    const start = loadSave().cash;
                    startedAt.current = Date.now();
                    setNow(Date.now());
                    setRivals(
                      RIVAL_NAMES.map((name) => ({
                        name,
                        cash: start,
                        done: 0,
                        groundedUntil: 0,
                        job: null,
                        eta: 0,
                      })),
                    );
                    setTemper(10);
                    setGroundedUntil(0);
                    setTimAt(null);
                    setTarget(null);
                    setResetVan();
                    closeDialog();
                  }}
                  className="mt-4 w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground"
                >
                  New match
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
