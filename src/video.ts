import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export const VIDEO_SECONDS = 16;
const FPS = 30;
const SAMPLE_RATE = 44100;

/**
 * Procedural background track (no licensing concerns): soft pad chords, a plucked arpeggio
 * and a low pulse over Am–F–C–G, with fade in/out. Returns a 16-bit mono WAV.
 */
export function synthMusic(seconds = VIDEO_SECONDS): Buffer {
  const chords = [
    [220.0, 261.63, 329.63], // Am
    [174.61, 220.0, 261.63], // F
    [196.0, 261.63, 329.63], // C (inversion)
    [196.0, 246.94, 293.66], // G
  ];
  const beat = 60 / 96;
  const chordLen = beat * 8;
  const n = Math.floor(seconds * SAMPLE_RATE);
  const out = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const ci = Math.floor(t / chordLen) % chords.length;
    const chord = chords[ci];
    const tc = t % chordLen;

    // Pad: detuned sines with slow attack and release per chord.
    const env = Math.min(1, tc / 0.6) * Math.min(1, (chordLen - tc) / 0.4);
    let v = 0;
    for (const f of chord) v += 0.06 * (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.003 * t));

    // Arpeggio: 8th notes an octave up, exponential pluck decay.
    const step = Math.floor(t / (beat / 2));
    const ts = t % (beat / 2);
    const note = chord[step % chord.length] * 2;
    const pluck = Math.exp(-ts * 9);
    v = v * env + 0.09 * pluck * (Math.sin(2 * Math.PI * note * t) + 0.3 * Math.sin(4 * Math.PI * note * t));

    // Low pulse on each beat.
    const tb = t % beat;
    v += 0.12 * Math.exp(-tb * 7) * Math.sin(2 * Math.PI * (chord[0] / 2) * t);

    out[i] = v;
  }

  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
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
    const fade = Math.min(1, t / 0.8) * Math.min(1, (seconds - t) / 1.5);
    const s = (out[i] / peak) * 0.8 * fade;
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2);
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
export async function renderVideo(html: string, outFile: string, seconds = VIDEO_SECONDS): Promise<string> {
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
    await writeFile(music, synthMusic(seconds));
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
