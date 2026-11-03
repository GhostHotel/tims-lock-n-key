import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { Button } from "@/components/ui/button";
import { useGameFrame } from "@/hooks/use-game-frame";
import { pinTuning, type Difficulty } from "@/lib/match";

// Pins bounce; tap "SET" when the pin is inside the shear line zone.
export function LockPick({
  pins,
  onDone,
  easy = false,
  difficulty = "medium",
}: {
  pins: number;
  onDone: (ok: boolean) => void;
  easy?: boolean;
  difficulty?: Difficulty;
}) {
  const [set, setSet] = useState(0);
  const pos = useRef(0);
  const activePin = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const t = useRef(0);
  const tuning = pinTuning(difficulty, set);
  const speed = easy && difficulty === "medium" ? tuning.speed * 0.55 : tuning.speed;
  const lo = easy && difficulty === "medium" ? 0.36 : tuning.lo,
    hi = easy && difficulty === "medium" ? 0.68 : tuning.hi;

  useGameFrame((dt) => {
    if (finished.current) return false;
    t.current += dt * speed;
    pos.current = (Math.sin(t.current * 3) + 1) / 2;
    if (activePin.current) activePin.current.style.transform = `translateY(${pos.current * 85}%)`;
    return true;
  });
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const tap = () => {
    if (finished.current) return;
    if (pos.current > lo && pos.current < hi) {
      sfx.click();
      setFlash("ok");
      if (set + 1 >= pins) {
        finished.current = true;
        return onDone(true);
      }
      setSet(set + 1);
    } else {
      sfx.buzz();
      setFlash("bad");
      if (strikes + 1 >= tuning.tries) {
        finished.current = true;
        return onDone(false);
      }
      setStrikes(strikes + 1);
    }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 200);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>
          PINS {set}/{pins}
        </span>
        <span>
          PICK {"▮".repeat(tuning.tries - strikes)}
          {"▯".repeat(strikes)}
        </span>
      </div>
      <div
        className={`relative h-56 rounded-lg border-2 bg-card p-3 transition-colors ${flash === "ok" ? "border-success" : flash === "bad" ? "border-destructive" : "border-border"}`}
      >
        <div
          style={{ top: `${lo * 100}%`, height: `${(hi - lo) * 100}%` }}
          className="absolute inset-x-3 rounded bg-primary/20 border-y border-dashed border-primary"
        />
        <div className="relative flex h-full gap-2">
          {Array.from({ length: pins }).map((_, i) => (
            <div key={i} className="relative flex-1">
              {i === set ? (
                <div
                  ref={activePin}
                  className="absolute inset-0 will-change-transform"
                  style={{ transform: `translateY(${pos.current * 85}%)` }}
                >
                  <div className="h-6 rounded-sm bg-primary" />
                </div>
              ) : (
                <div
                  className={`absolute inset-x-0 h-6 rounded-sm ${i < set ? "bg-success" : "bg-muted"}`}
                  style={{ top: i < set ? "48%" : "85%" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <Button
        variant="unstyled"
        size="free"
        onClick={tap}
        className="w-full rounded-lg bg-primary py-4 font-display text-xl tracking-widest text-primary-foreground active:scale-95 transition"
      >
        SET PIN
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {easy ? "🚬 Tim's tip: slow and steady. " : ""}Tap when the pin hits the shear line.
      </p>
    </div>
  );
}
