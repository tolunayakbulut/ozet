import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { TIMELINE, itemTimes } from "./templates.ts";
import type { Story } from "./select.ts";

const FPS = 30;
const SAMPLE_RATE = 44100;

/** Sound cues on the video timeline (seconds). */
export interface Cues {
  total: number;
  whooshes: number[]; // curtain / transition sweeps
  hits: number[]; // logo impact
  pops: number[]; // umlaut dots landing
  ticks: number[]; // each headline sliding in
  chimes: number[]; // top-story shimmer
  sting: number; // closing chord
  bed: [number, number]; // music bed start/end
}

/** Sound cues matching the motion timeline in templates.ts. */
export function videoCues(stories: Story[]): Cues {
  const T = TIMELINE;
  const ticks = itemTimes(stories.length);
  const top = stories.findIndex((s) => s.top);
  return {
    total: T.total,
    whooshes: [0, T.introEnd - 0.5, T.outroStart - 0.1],
    hits: [0.15, T.outroStart + 0.6],
    pops: [0.85, 1.02, T.outroStart + 1.25, T.outroStart + 1.4],
    ticks,
    chimes: top >= 0 ? [ticks[top] + 0.7] : [],
    sting: T.outroStart + 1.9,
    bed: [T.introEnd - 0.3, T.outroStart + 0.4],
  };
}

/**
 * Procedural soundtrack (no licensing concerns): a soft Am–F–C–G music bed plus
 * synthesized SFX at the given cues. Returns a 16-bit mono WAV.
 */
export function soundtrack(c: Cues): Buffer {
  const n = Math.floor(c.total * SAMPLE_RATE);
  const out = new Float32Array(n);
  const add = (at: number, dur: number, fn: (t: number) => number) => {
    const i0 = Math.max(0, Math.floor(at * SAMPLE_RATE));
    const i1 = Math.min(n, Math.floor((at + dur) * SAMPLE_RATE));
    for (let i = i0; i < i1; i++) out[i] += fn(i / SAMPLE_RATE - at);
  };
  const sin = (f: number, t: number) => Math.sin(2 * Math.PI * f * t);

  // Music bed.
  const chords = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [196.0, 261.63, 329.63],
    [196.0, 246.94, 293.66],
  ];
  const beat = 60 / 100;
  const chordLen = beat * 8;
  const [b0, b1] = c.bed;
  add(b0, b1 - b0, (t) => {
    const chord = chords[Math.floor(t / chordLen) % chords.length];
    const tc = t % chordLen;
    const env = Math.min(1, tc / 0.5) * Math.min(1, (chordLen - tc) / 0.4);
    let v = 0;
    for (const f of chord) v += 0.045 * (sin(f, t) + sin(f * 1.004, t));
    const ts = t % (beat / 2);
    const note = chord[Math.floor(t / (beat / 2)) % chord.length] * 2;
    v = v * env + 0.06 * Math.exp(-ts * 10) * (sin(note, t) + 0.3 * sin(note * 2, t));
    v += 0.09 * Math.exp(-(t % beat) * 8) * sin(chord[0] / 2, t);
    const fade = Math.min(1, t / 0.6) * Math.min(1, (b1 - b0 - t) / 0.8);
    return v * fade;
  });

  // Whoosh: noise through a sweeping one-pole lowpass, swelling then fading.
  for (const at of c.whooshes) {
    let lp = 0;
    add(at, 0.9, (t) => {
      const k = 0.02 + 0.25 * Math.sin(Math.PI * Math.min(1, t / 0.9));
      lp += k * (Math.random() * 2 - 1 - lp);
      return 0.55 * lp * Math.sin(Math.PI * Math.min(1, t / 0.9));
    });
  }
  // Logo hit: sub drop + bell partials.
  for (const at of c.hits)
    add(at, 2.2, (t) => {
      const sub = 0.5 * Math.exp(-t * 5) * sin(55 + 40 * Math.exp(-t * 20), t);
      const bell = Math.exp(-t * 2.2) * (0.14 * sin(880, t) + 0.08 * sin(1320, t) + 0.05 * sin(1760 * 1.01, t));
      return sub + bell;
    });
  // Pop: short downward blip.
  for (const at of c.pops) add(at, 0.12, (t) => 0.3 * Math.exp(-t * 40) * sin(900 - 2500 * t, t));
  // Tick: soft wooden click.
  for (const at of c.ticks) add(at, 0.08, (t) => 0.16 * Math.exp(-t * 70) * (sin(1800, t) + 0.5 * sin(2700, t)));
  // Chime: rising sparkle.
  for (const at of c.chimes)
    add(at, 1.2, (t) => [1568, 2093, 2637].reduce((v, f, k) => v + (t > k * 0.08 ? 0.05 * Math.exp(-(t - k * 0.08) * 4) * sin(f, t) : 0), 0));
  // Sting: A minor add9 swell with long tail.
  add(c.sting, c.total - c.sting, (t) => {
    const env = Math.min(1, t / 0.08) * Math.exp(-t * 0.9);
    return env * [110, 220, 261.63, 329.63, 493.88].reduce((v, f) => v + 0.07 * (sin(f, t) + 0.4 * sin(f * 2, t)), 0);
  });

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const wav = Buffer.alloc(44 + n * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + n * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const fade = Math.min(1, (c.total - t) / 0.3);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (out[i] / peak) * 0.85 * fade)) * 32767), 44 + i * 2);
  }
  return wav;
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath as unknown as string, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-500)}`))));
  });
}

/**
 * Renders an animated HTML page (CSS animations with absolute delays) to a 1080x1920 H.264/AAC MP4.
 * Each frame pauses every animation at time t and screenshots it, so output is deterministic.
 */
export async function renderVideo(html: string, outFile: string, cues: Cues): Promise<string> {
  const seconds = cues.total;
  const work = await mkdtemp(path.join(tmpdir(), "ozet-video-"));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Same overflow fitting as still renders.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll<HTMLElement>(".fit")) {
        const min = Number(el.dataset.min ?? 20);
        const cssVar = el.dataset.var;
        const style = getComputedStyle(el);
        let size = parseFloat(cssVar ? style.getPropertyValue(cssVar) : style.fontSize);
        while (el.scrollHeight > el.clientHeight + 8 && size > min) {
          size -= 1;
          if (cssVar) el.style.setProperty(cssVar, `${size}px`);
          else el.style.fontSize = `${size}px`;
        }
      }
    });

    const frames = Math.round(seconds * FPS);
    for (let f = 0; f < frames; f++) {
      const ms = (f / FPS) * 1000;
      await page.evaluate((t) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = t;
        }
      }, ms);
      await page.screenshot({ path: path.join(work, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 90 });
    }

    const music = path.join(work, "music.wav");
    await writeFile(music, soundtrack(cues));
    await mkdir(path.dirname(outFile), { recursive: true });
    await ffmpeg([
      "-y",
      "-framerate", String(FPS),
      "-i", path.join(work, "f%04d.jpg"),
      "-i", music,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ar", "44100",
      "-shortest",
      "-movflags", "+faststart",
      outFile,
    ]);
    return outFile;
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}
