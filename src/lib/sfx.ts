// Tiny Web Audio sound engine — no audio files, everything is synthesised.
// The AudioContext is created on the first user interaction to satisfy autoplay policies.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let backgroundStarted = false;
let streetNoise: AudioBufferSourceNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() {
  return muted;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  vol = 0.2,
  delay = 0,
  slideTo?: number,
) {
  const c = ac();
  if (!c || !master || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t0 = c.currentTime + delay;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol = 0.15) {
  const c = ac();
  if (!c || !master || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
}

export const sfx = {
  /** Pin seated in the shear line. */
  click() {
    tone(880, 0.06, "square", 0.15);
    tone(1320, 0.05, "square", 0.1, 0.04);
  },
  /** Bad tap / pick tension warning. */
  buzz() {
    tone(160, 0.12, "sawtooth", 0.15);
  },
  /** Pick snapped — job failed. */
  snap() {
    noise(0.15, 0.2);
    tone(220, 0.3, "sawtooth", 0.18, 0, 80);
  },
  /** Cha-ching, job paid. */
  cash() {
    tone(988, 0.09, "triangle", 0.22);
    tone(1319, 0.22, "triangle", 0.22, 0.09);
  },
  /** Fine / penalty buzzer. */
  fine() {
    tone(180, 0.25, "sawtooth", 0.2);
    tone(140, 0.25, "sawtooth", 0.2, 0.12);
  },
  /** Dispatch phone ringing. */
  ring() {
    tone(1200, 0.08, "sine", 0.12);
    tone(1200, 0.08, "sine", 0.12, 0.15);
  },
  /** Door unlocked. */
  unlock() {
    tone(660, 0.08, "triangle", 0.18);
    tone(990, 0.12, "triangle", 0.18, 0.08);
  },
  /** Safe dial clicking into place. */
  dial() {
    tone(500 + Math.random() * 200, 0.03, "square", 0.08);
  },
};

// ---- Continuous engine hum, driven by van speed ----
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;

export function engine(level: number) {
  const c = backgroundStarted ? ctx : null;
  if (!c || !master) return;
  if (!engineOsc) {
    engineOsc = c.createOscillator();
    engineGain = c.createGain();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 240;
    engineOsc.connect(lp).connect(engineGain).connect(master);
    engineOsc.start();
  }
  if (!engineGain) return;
  const l = Math.max(0, Math.min(1, level));
  engineGain.gain.setTargetAtTime(0.018 + l * 0.08, c.currentTime, 0.1);
  engineOsc.frequency.setTargetAtTime(50 + l * 70, c.currentTime, 0.1);
}

/** Continuous, soft street rumble plus an idling engine; independent of radio. */
export function startBackgroundAudio() {
  const c = ac();
  if (!c || !master || backgroundStarted) return;
  master.gain.value = muted ? 0 : 0.5;
  backgroundStarted = true;
  const buffer = c.createBuffer(1, c.sampleRate * 8, c.sampleRate);
  const samples = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < samples.length; i++) {
    previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02;
    samples[i] = previous * 3;
  }
  streetNoise = c.createBufferSource();
  streetNoise.buffer = buffer;
  streetNoise.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const volume = c.createGain();
  volume.gain.value = 0.1;
  streetNoise.connect(filter).connect(volume).connect(master);
  streetNoise.start();
  engine(0);
}

export function stopBackgroundAudio() {
  streetNoise?.stop();
  streetNoise?.disconnect();
  streetNoise = null;
  engineOsc?.stop();
  engineOsc?.disconnect();
  engineGain?.disconnect();
  engineOsc = null;
  engineGain = null;
  backgroundStarted = false;
}
