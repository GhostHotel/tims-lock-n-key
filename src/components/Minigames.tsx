import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { Button } from "@/components/ui/button";
import { extractionTuning, safeHit, safeWedgeWidth, stepExtraction } from "@/lib/game";
import { useGameFrame } from "@/hooks/use-game-frame";

// ---------- Broken lock: pull the snapped key out, steady hands ----------
export function KeyExtract({
  onDone,
  easy = false,
}: {
  onDone: (ok: boolean) => void;
  easy?: boolean;
}) {
  const fragment = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const riskFill = useRef<HTMLDivElement>(null);
  const progressLabel = useRef<HTMLSpanElement>(null);
  const riskLabel = useRef<HTMLSpanElement>(null);
  const finished = useRef(false);
  const holding = useRef(false);
  const st = useRef({ t: 0, progress: 0, risk: 0 });
  const { speed, half } = extractionTuning(easy);
  const done = useRef(onDone);
  done.current = onDone;

  useGameFrame((dt) => {
    if (finished.current) return false;
    const s = st.current;
    s.t += dt * speed;
    const p = (Math.sin(s.t) + Math.sin(s.t * 2.7) * 0.4 + 1.4) / 2.8;
    if (fragment.current) fragment.current.style.transform = `translateX(${p * 100}%)`;
    Object.assign(s, stepExtraction(s.progress, s.risk, p, holding.current, dt, easy));
    if (fill.current) fill.current.style.transform = `scaleX(${s.progress / 100})`;
    if (riskFill.current) {
      riskFill.current.style.transform = `scaleX(${s.risk / 100})`;
      riskFill.current.classList.toggle("bg-destructive", s.risk > 60);
      riskFill.current.classList.toggle("bg-accent", s.risk <= 60);
    }
    const progressText = `EXTRACTED ${Math.round(s.progress)}%`,
      riskText = `SNAP RISK ${Math.round(s.risk)}%`;
    if (progressLabel.current?.textContent !== progressText && progressLabel.current)
      progressLabel.current.textContent = progressText;
    if (riskLabel.current?.textContent !== riskText && riskLabel.current)
      riskLabel.current.textContent = riskText;
    if (s.progress >= 100 || s.risk >= 100) {
      finished.current = true;
      holding.current = false;
      done.current(s.progress >= 100);
      return false;
    }
    return true;
  });
  useEffect(() => {
    const release = () => {
      holding.current = false;
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      release();
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span ref={progressLabel}>EXTRACTED 0%</span>
        <span ref={riskLabel}>SNAP RISK 0%</span>
      </div>
      <div className="rounded-lg border-2 border-border bg-card p-3">
        {/* the cylinder: pull the fragment through the steady zone */}
        <div className="relative h-24 overflow-hidden rounded bg-muted">
          <div
            style={{ left: `${(0.5 - half) * 100}%`, width: `${half * 200}%` }}
            className="absolute inset-y-0 border-x-2 border-dashed border-success bg-success/20"
          />
          <div
            ref={fragment}
            data-testid="extract-position"
            className="absolute inset-0 will-change-transform"
            style={{ transform: "translateX(50%)" }}
          >
            <div className="absolute inset-y-2 -left-5 w-10 rounded-sm bg-primary shadow" />
          </div>
          <div
            ref={fill}
            className="absolute inset-0 origin-left bg-success/25"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
          <div
            ref={riskFill}
            className="h-full origin-left bg-accent"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>
      <Button
        variant="unstyled"
        size="free"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          holding.current = true;
        }}
        onPointerUp={() => {
          holding.current = false;
        }}
        onPointerLeave={() => {
          holding.current = false;
        }}
        onPointerCancel={() => {
          holding.current = false;
        }}
        onLostPointerCapture={() => {
          holding.current = false;
        }}
        className="w-full touch-none rounded-lg bg-primary py-4 font-display text-xl tracking-widest text-primary-foreground active:scale-95 transition"
      >
        HOLD TO PULL
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {easy ? "🚬 Tim's tip: nice and easy. " : ""}Hold while the fragment sits in the green zone
        — pull crooked and it snaps.
      </p>
    </div>
  );
}

// ---------- Safe crack: stop the spinning dial on each number ----------
export function SafeDial({
  onDone,
  easy = false,
}: {
  onDone: (ok: boolean) => void;
  easy?: boolean;
}) {
  const total = 3;
  const [stage, setStage] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const needle = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const [zone, setZone] = useState(() => Math.random() * 360);
  const ang = useRef(0);
  const speed = (easy ? 65 : 105) + stage * 45;

  useGameFrame((dt) => {
    if (finished.current) return false;
    ang.current = (ang.current + dt * speed) % 360;
    if (needle.current)
      needle.current.style.transform = `translateX(-50%) rotate(${ang.current}deg)`;
    return true;
  });

  const width = safeWedgeWidth(stage);
  const tap = () => {
    if (finished.current) return;
    if (safeHit(ang.current, zone, width)) {
      if (stage + 1 >= total) {
        finished.current = true;
        return onDone(true);
      }
      sfx.dial();
      setStage(stage + 1);
      setZone(Math.random() * 360);
    } else {
      sfx.buzz();
      if (strikes + 1 >= 3) {
        finished.current = true;
        return onDone(false);
      }
      setStrikes(strikes + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>
          NUMBER {stage + 1}/{total}
        </span>
        <span>
          TRIES {"▮".repeat(3 - strikes)}
          {"▯".repeat(strikes)}
        </span>
      </div>
      <div className="flex justify-center">
        <div className="relative h-56 w-56 rounded-full border-4 border-border bg-card">
          {/* target wedge */}
          <div
            data-testid="dial-zone"
            className="absolute inset-1 rounded-full"
            style={{
              background: `conic-gradient(from ${zone - width / 2}deg, color-mix(in oklab, var(--success) 45%, transparent) 0deg ${width}deg, transparent ${width}deg 360deg)`,
            }}
          />
          {/* ticks */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute left-1/2 bottom-1/2 h-[46%] w-0.5 origin-bottom bg-muted-foreground/40"
              style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
            />
          ))}
          {/* needle */}
          <div
            ref={needle}
            data-testid="dial-needle"
            className="absolute left-1/2 bottom-1/2 h-[44%] w-1 origin-bottom bg-accent will-change-transform"
            style={{ transform: "translateX(-50%) rotate(0deg)" }}
          />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
        </div>
      </div>
      <Button
        variant="unstyled"
        size="free"
        onClick={tap}
        className="w-full rounded-lg bg-primary py-4 font-display text-xl tracking-widest text-primary-foreground active:scale-95 transition"
      >
        STOP ON MARK
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {easy ? "🚬 Tim's tip: wait for it. " : ""}Stop the needle inside the green wedge three
        times to crack the safe.
      </p>
    </div>
  );
}
