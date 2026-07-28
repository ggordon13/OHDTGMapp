// ---------------------------------------------------------------------------
// Sound effects — synthesised, not sampled.
//
// Every cue is built from oscillators through the Web Audio API, so the whole
// kit costs a few KB of code instead of a few hundred KB of audio files, and
// the chiptune timbres match the pixel-art UI by construction. There is nothing
// to download, nothing to preload, and no request that can fail offline.
//
// To retune a cue, edit its note list — the notes are written as names ("E6"),
// with times and durations in seconds from the start of the cue.
//
// Browsers refuse to start audio before a user gesture, so the context is
// created lazily (the first cue is nearly always a click) and also warmed up by
// the first pointer/key event of the session, which covers the cues that fire
// on their own — an auto-granted trophy, say.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "gglvlup:sfx-muted";

/** Headroom: several voices stack in the fanfares, so no single one is loud. */
const MASTER_GAIN = 0.35;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode / blocked storage — sound on, just not remembered.
    return false;
  }
}

let muted = readMuted();

type Listener = (muted: boolean) => void;
const listeners = new Set<Listener>();

export function isMuted(): boolean {
  return muted;
}

/** Subscribe to mute changes (so a toggle button anywhere stays in sync). */
export function subscribeMuted(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* not fatal — the setting just won't survive a reload */
  }
  // Kill anything mid-flight, not only what hasn't started yet.
  if (master) master.gain.value = next ? 0 : MASTER_GAIN;
  listeners.forEach((fn) => fn(next));
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null; // No audio hardware / blocked — the UI is fine without it.
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
  }
  // Browsers park the context until a gesture; every cue follows one.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const SEMITONES: Record<string, number> = {
  C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2,
};

/** Note name to frequency: "E5" → 659.26 Hz. */
function hz(note: string): number {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match) return 440;
  const [, name, octave] = match;
  return 440 * 2 ** ((SEMITONES[name] + (Number(octave) - 4) * 12) / 12);
}

interface Voice {
  note: string;
  /** Seconds after the cue begins. */
  at: number;
  dur: number;
  type?: OscillatorType;
  /** Peak gain before the master fader, 0–1. */
  gain?: number;
}

function play(voices: Voice[]): void {
  if (muted) return;
  const ac = audio();
  if (!ac || !master) return;

  // A hair in the future so the first voice's envelope isn't clipped.
  const t0 = ac.currentTime + 0.01;

  for (const voice of voices) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const start = t0 + voice.at;
    const end = start + voice.dur;

    osc.type = voice.type ?? "square";
    osc.frequency.setValueAtTime(hz(voice.note), start);

    // Exponential ramps (never to exactly 0) — a linear cut to silence clicks.
    const peak = voice.gain ?? 0.24;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/**
 * The cue kit. Each is safe to call anywhere: muted, unsupported and
 * not-yet-unlocked audio all no-op silently.
 */
export const sfx = {
  /** One quest claimed — the two-note coin blip. */
  claim: () =>
    play([
      { note: "B5", at: 0, dur: 0.07 },
      { note: "E6", at: 0.06, dur: 0.26, gain: 0.22 },
    ]),

  /** "Claim all" — the coin blip, then a run up the arpeggio to land it. */
  claimAll: () =>
    play([
      { note: "B5", at: 0, dur: 0.06 },
      { note: "E6", at: 0.05, dur: 0.14 },
      { note: "C6", at: 0.17, dur: 0.08, gain: 0.18 },
      { note: "E6", at: 0.25, dur: 0.08, gain: 0.18 },
      { note: "G6", at: 0.33, dur: 0.08, gain: 0.18 },
      { note: "C7", at: 0.41, dur: 0.32, gain: 0.2, type: "triangle" },
    ]),

  /** Trophy unlocked — bell arpeggio with a sparkle on top. */
  trophy: () =>
    play([
      { note: "C6", at: 0, dur: 0.5, type: "triangle", gain: 0.22 },
      { note: "E6", at: 0.09, dur: 0.5, type: "triangle", gain: 0.2 },
      { note: "G6", at: 0.18, dur: 0.55, type: "triangle", gain: 0.2 },
      { note: "C7", at: 0.27, dur: 0.7, type: "sine", gain: 0.18 },
      { note: "G7", at: 0.44, dur: 0.35, type: "sine", gain: 0.09 },
    ]),

  /** Level up — a short major fanfare over a low root. */
  levelUp: () =>
    play([
      { note: "G4", at: 0, dur: 0.12 },
      { note: "C5", at: 0.11, dur: 0.12 },
      { note: "E5", at: 0.22, dur: 0.12 },
      { note: "G5", at: 0.33, dur: 0.46, gain: 0.26 },
      { note: "C3", at: 0.33, dur: 0.46, type: "triangle", gain: 0.16 },
    ]),

  /** Rank up — the fanfare, bigger, with a held chord under it. */
  rankUp: () =>
    play([
      { note: "C5", at: 0, dur: 0.13 },
      { note: "E5", at: 0.12, dur: 0.13 },
      { note: "G5", at: 0.24, dur: 0.13 },
      { note: "C6", at: 0.36, dur: 0.16 },
      { note: "E6", at: 0.5, dur: 0.66, gain: 0.26 },
      { note: "C4", at: 0.36, dur: 0.8, type: "sawtooth", gain: 0.1 },
      { note: "G4", at: 0.36, dur: 0.8, type: "triangle", gain: 0.12 },
    ]),

  /** Milestone crossed — quick rising cheer, the partner to the confetti. */
  milestone: () =>
    play([
      { note: "E5", at: 0, dur: 0.1 },
      { note: "A5", at: 0.09, dur: 0.1 },
      { note: "C#6", at: 0.18, dur: 0.36, gain: 0.24 },
    ]),

  /** A challenge finished or a 100-day run sealed — the big one. */
  finish: () =>
    play([
      { note: "C5", at: 0, dur: 0.14 },
      { note: "E5", at: 0.13, dur: 0.14 },
      { note: "G5", at: 0.26, dur: 0.14 },
      { note: "C6", at: 0.39, dur: 0.2 },
      { note: "G5", at: 0.6, dur: 0.14 },
      { note: "C6", at: 0.73, dur: 0.9, gain: 0.28 },
      { note: "E6", at: 0.75, dur: 0.88, gain: 0.18, type: "triangle" },
      { note: "C4", at: 0.73, dur: 0.95, type: "sawtooth", gain: 0.1 },
    ]),
};

// Warm the context on the first gesture of the session so cues that fire
// without a click of their own (an auto-granted trophy on load) still sound.
if (typeof window !== "undefined") {
  const warm = () => {
    if (!muted) audio();
  };
  window.addEventListener("pointerdown", warm, { once: true, passive: true });
  window.addEventListener("keydown", warm, { once: true });
}
