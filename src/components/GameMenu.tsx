import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, KeyRound, Play, BookOpen, Trophy, Lock, LogOut, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TechnicianModel } from "@/components/TechnicianModel";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { startRankedMatch } from "@/lib/leaderboard.functions";
import { CELEBRATION_MS, DIFFICULTIES, LOADING_MS, TECHNICIANS, TECHNICIAN_STYLE, type Difficulty, type MatchConfig, type MenuState } from "@/lib/match";
import workshop from "@/assets/workshop-breaktime.png.asset.json";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Score = Database["public"]["Tables"]["leaderboard_scores"]["Row"];
export function GameMenu({ state, onState, onStart }: { state: Exclude<MenuState, "PLAYING">; onState: (state: MenuState) => void; onStart: (config: MatchConfig) => void }) {
  const [tutorial, setTutorial] = useState(false);
  const [index, setIndex] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [playerCount, setPlayerCount] = useState(4);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [boardStatus, setBoardStatus] = useState("Loading scores…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const config = useRef<MatchConfig | null>(null);
  const progress = useRef<HTMLProgressElement>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRanked = useServerFn(startRankedMatch);
  const technician = TECHNICIANS[index] ?? "Matt";
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { data.subscription.unsubscribe(); if (celebrateTimer.current) clearTimeout(celebrateTimer.current); };
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error: failure } = await supabase.from("leaderboard_scores").select("user_id,display_name,technician,difficulty,score,achieved_at").order("score", { ascending: false }).order("achieved_at", { ascending: true }).limit(10);
      if (!active) return;
      if (failure) setBoardStatus("Scores unavailable — reconnecting…");
      else { setScores(data ?? []); setBoardStatus(data?.length ? "" : "No ranked scores yet. First place is open."); }
    };
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (state !== "LOADING") return;
    const started = performance.now();
    const tick = setInterval(() => { if (progress.current) progress.current.value = Math.min(100, (performance.now() - started) / LOADING_MS * 100); }, 40);
    const timeout = setTimeout(() => { const next = config.current; if (next) onStart(next); }, LOADING_MS);
    return () => { clearInterval(tick); clearTimeout(timeout); };
  }, [state, onStart]);
  useEffect(() => {
    if (!tutorial) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setTutorial(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [tutorial]);
  const login = async (provider: "google" | "lovable") => {
    setError(""); setBusy(true);
    try { const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin }); if (result.error) setError("Sign-in did not finish. Please try again."); }
    catch { setError("Sign-in is unavailable. You can still play an unranked match."); }
    finally { setBusy(false); }
  };
  const begin = async () => {
    const name = displayName.trim() || technician;
    if (name.length > 24) { setError("Keep your player name to 24 characters."); return; }
    setBusy(true); setError("");
    try {
      // Decode the artwork before the five-second buffer begins, never spend that buffer fetching it.
      const image = new Image();
      image.src = workshop.url;
      await image.decode();
      const rankedId = session ? await startRanked({ data: { technician, playerCount, difficulty } }) : null;
      config.current = { technician, playerCount, difficulty, displayName: name, rankedId };
      onState("LOADING");
    } catch { setError("Your ranked match could not start. Try again, or sign out for an unranked match."); }
    finally { setBusy(false); }
  };
  if (state === "LOADING") return <main className="loading-screen relative h-[100dvh] overflow-hidden bg-background" data-menu-state="LOADING">
    <img src={workshop.url} alt="Tim taking a break in the locksmith workshop" className="absolute inset-0 h-full w-full object-cover object-center" />
    <div className="loading-caption absolute inset-x-0 bottom-0 px-6 pb-10 pt-20 sm:px-12">
      <div className="mx-auto max-w-3xl"><p className="mb-2 text-sm uppercase text-primary">{technician} · {DIFFICULTIES[difficulty].label}</p><h1 className="mb-5 font-display text-4xl text-foreground">Opening the shop</h1><progress ref={progress} aria-label="Loading match" max={100} value={0} className="loading-progress h-2 w-full" /><div className="mt-3 flex justify-between text-sm text-foreground"><span>Tim’s Lock & Key</span><span>{playerCount} technician{playerCount !== 1 ? "s" : ""} · 10 minutes</span></div></div>
    </div>
  </main>;
  return <main className="menu-shell relative min-h-[100dvh] overflow-x-hidden bg-background text-foreground" data-menu-state={state}>
    <header className="relative z-10 flex items-center justify-between border-b border-border/60 px-5 py-5 sm:px-10">
      <div className="flex items-center gap-3"><KeyRound className="text-primary" size={26} /><span className="font-display text-xl">Tim’s Lock & Key</span></div>
      <div className="flex items-center gap-2">{session ? <><span className="hidden text-xs text-success sm:inline">Ranked scores enabled</span><Button variant="ghost" size="icon" title="Sign out" aria-label="Sign out" onClick={() => void supabase.auth.signOut()}><LogOut /></Button></> : <><Button variant="outline" size="sm" disabled={busy} onClick={() => void login("google")}>Sign in with Google</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void login("lovable")}>Lovable</Button></>}</div>
    </header>
    {error && <p role="alert" className="relative z-10 mx-5 mt-4 text-sm text-destructive">{error}</p>}
    {state === "MAIN_MENU" ? <div className="mx-auto grid max-w-7xl gap-12 px-6 py-10 sm:px-10 sm:py-16 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="menu-title relative"><p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase text-success"><span className="h-2 w-2 rounded-full bg-success" />Montgomery, Alabama</p><h1 className="font-display text-7xl leading-[0.98] sm:text-8xl">TIM’S<br />LOCK <span className="text-primary">&</span> KEY</h1><p className="mt-5 max-w-sm text-base text-muted-foreground">The shop is open. The clock is ticking.</p>
        <div className="mt-10 max-w-md space-y-3"><Button variant="default" size="free" className="flex w-full justify-between rounded-md px-5 py-5 text-lg font-semibold" onClick={() => onState("CHARACTER_SELECT")}><span className="flex items-center gap-3"><Play />Multiplayer Match</span><ArrowRight /></Button><div><Button variant="outline" size="free" disabled className="w-full justify-between px-5 py-4 text-base"><span className="flex items-center gap-3"><Lock />Story Mode</span></Button><p className="mt-1 text-center text-xs text-muted-foreground">(coming soon)</p></div><Button variant="ghost" size="free" className="w-full justify-between px-5 py-4 text-base" onClick={() => setTutorial(true)}><span className="flex items-center gap-3"><BookOpen />Tutorial</span><ArrowRight /></Button></div>
        <p className="mt-8 text-xs text-muted-foreground">1 player + up to 3 NPC rivals · 10-minute matches</p>
      </section>
      <section className="self-start border-t border-border pt-6 lg:border-t-0 lg:pt-1"><div className="mb-6 flex items-end justify-between"><div><p className="mb-1 text-xs uppercase text-primary">Worldwide rankings</p><h2 className="flex items-center gap-3 font-display text-3xl"><Trophy size={24} />TOP 10</h2></div><span className="text-xs text-muted-foreground">Best match cash</span></div><div className="grid grid-cols-[2rem_1fr_5rem] border-b border-border pb-3 text-xs uppercase text-muted-foreground"><span>#</span><span>Technician</span><span className="text-right">Score</span></div>{scores.map((score, i) => <div key={score.user_id} className="grid grid-cols-[2rem_1fr_5rem] items-center border-b border-border/50 py-3"><span className={i < 3 ? "font-mono text-primary" : "font-mono text-muted-foreground"}>{String(i + 1).padStart(2, "0")}</span><div><p className="text-sm font-semibold">{score.display_name}</p><p className="text-xs text-muted-foreground">{score.technician} · {DIFFICULTIES[score.difficulty as Difficulty]?.label ?? score.difficulty}</p></div><span className="text-right font-mono text-success">${score.score.toLocaleString()}</span></div>)}{boardStatus && <p className="py-10 text-sm text-muted-foreground">{boardStatus}</p>}<p className="mt-5 text-xs text-muted-foreground">{session ? "Your best completed match earns a spot here." : "Sign in to add your completed matches to the global board."}</p></section>
    </div> : <div className="mx-auto max-w-5xl px-5 pb-10 pt-6 sm:px-10">
      <Button variant="ghost" size="sm" disabled={celebrate || busy} onClick={() => onState(state === "CHARACTER_SELECT" ? "MAIN_MENU" : "CHARACTER_SELECT")}><ArrowLeft />Back</Button>
      <div className="mt-4 flex justify-between text-xs uppercase text-muted-foreground"><span>01 / Technician</span><span className={state === "MATCH_CONFIG" ? "text-primary" : ""}>02 / Match setup</span></div>
      {state === "CHARACTER_SELECT" ? <section className="text-center"><h1 className="mt-6 font-display text-4xl sm:text-5xl">CHOOSE YOUR TECHNICIAN</h1>
        <div className="relative mx-auto mt-2 h-[min(52dvh,480px)] min-h-72 max-w-xl"><div className="absolute inset-0" data-character-viewport><Canvas camera={{ position: [0, 1.4, 5.5], fov: 37 }} dpr={[1, 1.5]} gl={{ antialias: true }}><ambientLight intensity={1.6} /><directionalLight position={[3, 5, 4]} intensity={3} /><Environment resolution={32}><Lightformer intensity={2} position={[0, 4, 4]} scale={5} /></Environment><Suspense fallback={null}><group position={[0, -1.2, 0]} rotation-y={0.38}><TechnicianModel key={technician} name={technician} celebrate={celebrate} /></group></Suspense></Canvas></div><Button variant="outline" size="icon" className="absolute left-0 top-1/2 z-10 -translate-y-1/2" aria-label="Previous technician" disabled={celebrate} onClick={() => setIndex((i) => (i + 5) % 6)}><ChevronLeft /></Button><Button variant="outline" size="icon" className="absolute right-0 top-1/2 z-10 -translate-y-1/2" aria-label="Next technician" disabled={celebrate} onClick={() => setIndex((i) => (i + 1) % 6)}><ChevronRight /></Button></div>
        <h2 className="font-display text-4xl text-primary">{technician}</h2><p className="mt-1 text-sm text-muted-foreground">{TECHNICIAN_STYLE[technician].description}</p><p className="mt-3 font-mono text-xs text-muted-foreground">{index + 1} / 6</p><Button size="lg" disabled={celebrate} className="mt-6 min-w-56" onClick={() => { setCelebrate(true); celebrateTimer.current = setTimeout(() => { setCelebrate(false); onState("MATCH_CONFIG"); }, CELEBRATION_MS); }}>{celebrate ? <><Check />Let’s go, {technician}!</> : <>Choose {technician}<ArrowRight /></>}</Button>
      </section> : <section className="mx-auto max-w-2xl"><h1 className="mb-2 mt-8 font-display text-5xl">SET THE MATCH</h1><p className="mb-8 text-sm text-muted-foreground">{technician} is on the clock.</p><label className="block text-sm font-semibold" htmlFor="player-name">Player name</label><input id="player-name" maxLength={24} value={displayName} placeholder={technician} onChange={(e) => setDisplayName(e.target.value)} className="mt-2 w-full rounded-md border border-input bg-card px-4 py-3 text-foreground" />
        <div className="mt-8 flex items-center justify-between"><label htmlFor="player-count" className="flex items-center gap-2 text-sm font-semibold"><Users size={18} />Match participants</label><span className="font-mono text-primary">{playerCount} / 4</span></div><input id="player-count" type="range" min={1} max={4} step={1} value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))} className="mt-4 w-full accent-primary" /><p className="mt-2 text-xs text-muted-foreground">You{playerCount > 1 ? ` + ${playerCount - 1} randomly selected NPC rival${playerCount > 2 ? "s" : ""}` : " · solo practice"}</p>
        <h2 className="mt-8 text-sm font-semibold">Difficulty</h2><div className="mt-3 grid gap-2 sm:grid-cols-3">{(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => <Button key={d} variant={d === difficulty ? "default" : "outline"} size="free" aria-pressed={d === difficulty} onClick={() => setDifficulty(d)} className="px-3 py-4">{DIFFICULTIES[d].label}</Button>)}</div><p className="mt-3 text-xs text-muted-foreground">{difficulty === "easy" ? "Forgiving locks. More rival mistakes. Room to learn." : difficulty === "hard" ? "Tight timing. One chance. Bring your best hands." : "The original balance. A fair race against the shop crew."}</p><Button disabled={busy} size="lg" className="mt-10 w-full" onClick={() => void begin()}><Play />{busy ? "Preparing match…" : "Start match"}</Button><p className="mt-3 text-center text-xs text-muted-foreground">{session ? "Ranked match · your best cash score is kept online" : "Unranked match · sign in to compete on the global board"}</p>
      </section>}
    </div>}
    {tutorial && <div className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/95 p-5 pt-16" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><section className="w-full max-w-xl rounded-md border border-border bg-card p-6 sm:p-8"><p className="text-xs uppercase text-primary">The locksmith’s handbook</p><h2 id="tutorial-title" className="mb-6 mt-2 font-display text-4xl">HOW THE MATCH WORKS</h2><div className="space-y-5 text-sm"><div><h3 className="mb-1 font-semibold text-primary">01 · Beat the clock</h3><p>Ten minutes. Most cash wins. Play as one technician against up to three randomly selected NPC rivals.</p></div><div><h3 className="mb-1 font-semibold text-primary">02 · Answer the calls</h3><p>Open Dispatch, choose a job, then drive into its marker. Lockouts and rekeys use pin picking; broken keys use extraction; safes use the dial.</p></div><div><h3 className="mb-1 font-semibold text-primary">03 · Work with steady hands</h3><p>Set pins in the marked zone. Hold to pull a broken key while aligned, releasing to reduce snap risk. Stop the safe dial inside its target three times.</p></div><div><h3 className="mb-1 font-semibold text-primary">04 · Drive and earn</h3><p>Use WASD, arrow keys, or the on-screen steering and gas controls. At the shop, cut walk-in keys for $8 and spend cash on upgrades.</p></div><div><h3 className="mb-1 font-semibold text-primary">05 · Mind the crew</h3><p>A red light costs $50; yellow is not fined. Jimmy costs $50. Pops grounds you for two minutes when his temper exceeds 50. Talk to Tim while he’s smoking, then reach a job within 25 seconds for an easier challenge.</p></div><div><h3 className="mb-1 font-semibold text-primary">06 · Make the top 10</h3><p>Sign in before starting. Completed matches submit your final cash; only your highest score is kept. Device saves remain separate from the online rankings.</p></div></div><Button className="mt-7 w-full" autoFocus onClick={() => setTutorial(false)}>Got it<Check /></Button></section></div>}
  </main>;
}