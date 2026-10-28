import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { renderVideo } from "./video.ts";

/**
 * "Özet Anlatıyor": narrated 9:16 explainer videos that recap a running story from the start.
 * Each episode is a list of scenes; a scene is a narration text plus a view (HTML) whose
 * animations are timed against that narration's sentence starts. Voice is Gemini TTS (needs
 * GEMINI_API_KEY) read in one take; word timings come from insta-video's Whisper aligner.
 *
 * Usage: npm run explainer -- <slug>   (episode module in src/explainers/<slug>.ts)
 */

const MODEL = "gemini-3.8-flash-tts";
const VOICE = "Alnilam"; // same voice as insta-video's Turkish channel
const STYLE =
  "Native Turkish news narrator explaining a developing financial story. Natural Istanbul Turkish pronunciation. " +
  "Clear, confident, calm and serious; brisk news pace; short pauses between paragraphs; no exaggeration.";
const LEAD = 0.2; // silence before each scene's narration
const TAIL = 0.15; // after it (each clip already runs up to the next scene's first word)

export interface Ctx {
  t0: number; // scene start on the video timeline (s)
  dur: number; // scene length (s)
  at: number[]; // each narration sentence's start, relative to t0
  /** Inline style setting an element's animation delay `x` seconds into the scene. */
  d: (x: number, extra?: string) => string;
}

export interface Scene {
  say: string;
  view: (c: Ctx) => string;
  hold?: number; // extra seconds after narration
}

export interface Episode {
  title: string; // header, e.g. "Fon Krizi"
  scenes: Scene[];
  caption: string;
}

interface Cue {
  start: number;
  end: number;
  text: string;
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${out.slice(-400)}`))));
  });
}

async function exists(f: string): Promise<boolean> {
  return access(f).then(
    () => true,
    () => false,
  );
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
// insta-video's Whisper environment and alignment worker (faster-whisper, word timings + score).
const ALIGN_PY = path.join(homedir(), "Projects/insta-video/tts-lab/.venv-cb/bin/python");
const ALIGN_WORKER = path.join(homedir(), "Projects/insta-video/pipeline/workers/align_worker.py");
const MIN_SCORE = 0.8; // Whisper similarity below this means a misread; read once more (digits and names keep good takes near 0.85)

/** Text as the voice should read it; on screen the original stays. */
const spoken = (s: string) => s.replace(/\bAK Parti/g, "Ak Parti");

/** Same rule as insta-video's speech_check.script_words: tokens left after stripping edge punctuation. */
const clean = (w: string) => w.replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_']+$/gu, "");

async function geminiTake(text: string, out: string): Promise<void> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY yok (.env)");
  const body = {
    model: MODEL,
    input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: STYLE }] }] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: VOICE }] },
  };
  let json: { steps: { type: string; content: { type: string; data: string }[] }[] } | undefined;
  for (let attempt = 1; attempt <= 4 && !json; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
    });
    if (res.ok) json = await res.json();
    else if (res.status === 429 && (await res.clone().text()).includes("per day")) throw new Error("Gemini günlük kotası doldu");
    else if (attempt === 4) throw new Error(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    else await new Promise((r) => setTimeout(r, 10_000 * attempt));
  }
  const audio = json!.steps.filter((s) => s.type === "model_output").flatMap((s) => s.content).filter((c) => c.type === "audio");
  const raw = out.replace(/\.wav$/, "_raw.wav");
  await writeFile(raw, Buffer.from(audio[audio.length - 1].data, "base64"));
  const trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse";
  await run(ffmpegPath as unknown as string, ["-y", "-v", "error", "-i", raw, "-af", trim, "-ar", "44100", "-ac", "1", out]);
}

interface Word {
  text: string;
  start: number;
  end: number;
}

interface Voice {
  file: string;
  duration: number;
  cues: Cue[]; // sentences, relative to the clip
  words: Word[]; // display tokens with times, relative to the clip
}

/**
 * Reads the whole episode in one Gemini request (one call per render, the free tier allows ~10
 * a day), so intonation flows like one narrator. Whisper then times every word; the take is cut
 * into one clip per scene at the first word of each scene.
 */
async function speakAll(texts: string[], dir: string): Promise<Voice[]> {
  const full = texts.map(spoken).join("\n\n");
  const key = createHash("sha1").update(`${MODEL}|${VOICE}|${STYLE}|${full}`).digest("hex").slice(0, 12);
  const take = `take-${key}.wav`;
  const timing = path.join(dir, `take-${key}.json`);
  if (!(await exists(timing))) {
    let best: { score: number; words: Word[]; file: string } | undefined;
    for (let attempt = 0; attempt < 2 && (!best || best.score < MIN_SCORE); attempt++) {
      const file = `take-${key}-${attempt}.wav`;
      console.log("Gemini okuyor...");
      await geminiTake(full, path.join(dir, file));
      const job = path.join(dir, "align_job.json");
      await writeFile(job, JSON.stringify({ outdir: path.resolve(dir), language: "tr", scenes: [{ file, text: full }] }));
      await run(ALIGN_PY, [ALIGN_WORKER, job]);
      const [r] = JSON.parse(await readFile(path.join(dir, "align_timing.json"), "utf8"));
      console.log(`okuma ${attempt + 1}: ${r.duration.toFixed(1)} sn, benzerlik ${r.score}`);
      if (!best || r.score > best.score) best = { score: r.score, words: r.words, file };
    }
    await run(ffmpegPath as unknown as string, ["-y", "-v", "error", "-i", path.join(dir, best!.file), path.join(dir, take)]);
    await writeFile(timing, JSON.stringify(best!.words));
  }
  const words: Word[] = JSON.parse(await readFile(timing, "utf8"));
  const info = await run(ffmpegPath as unknown as string, ["-hide_banner", "-i", path.join(dir, take), "-f", "null", "-"]);
  const m = info.match(/time=(\d+):(\d+):([\d.]+)/g)!.pop()!.match(/(\d+):(\d+):([\d.]+)/)!;
  const total = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);

  // Display tokens per scene, each paired with its aligned word.
  let w = 0;
  const scenes = texts.map((t) =>
    t.split(/\s+/).filter((tok) => clean(tok)).map((tok) => ({ ...words[w++], text: tok })),
  );
  const cut = scenes.map((sc, i) => (i === 0 ? 0 : Math.max(0, sc[0].start - 0.08)));
  const out: Voice[] = [];
  for (const [i, sc] of scenes.entries()) {
    const a = cut[i];
    const b = i + 1 < cut.length ? cut[i + 1] : total;
    const file = path.join(dir, `scene-${key}-${i}.wav`);
    await run(ffmpegPath as unknown as string, ["-y", "-v", "error", "-i", path.join(dir, take), "-ss", a.toFixed(3), "-to", b.toFixed(3), file]);
    const rel = sc.map((x) => ({ text: x.text, start: x.start - a, end: x.end - a }));
    const cues: Cue[] = [];
    rel.forEach((x, k) => {
      if (k === 0 || /[.!?]$/.test(rel[k - 1].text)) cues.push({ start: x.start, end: x.end, text: x.text });
      else cues[cues.length - 1].text += " " + x.text;
      cues[cues.length - 1].end = x.end;
    });
    out.push({ file, duration: b - a, cues, words: rel });
  }
  return out;
}

/** Groups timed words into on-screen chunks of a few words, breaking after punctuation. */
function chunk(words: Word[], offset: number, maxWords = 6): Cue[] {
  const groups: Word[][] = [[]];
  for (const w of words) {
    const g = groups[groups.length - 1];
    g.push(w);
    if (g.length >= maxWords || /[.!?]$/.test(w.text) || (/[,:;]$/.test(w.text) && g.length >= 3)) groups.push([]);
  }
  // Fold a dangling one-word group into the previous one.
  const out = groups.filter((g) => g.length);
  for (let i = out.length - 1; i > 0; i--)
    if (out[i].length === 1 && !/[.!?]$/.test(out[i - 1][out[i - 1].length - 1].text)) out.splice(i - 1, 2, [...out[i - 1], ...out[i]]);
  return out.map((g) => ({ start: offset + g[0].start, end: offset + g[g.length - 1].end, text: g.map((w) => w.text).join(" ") }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function page(ep: Episode, body: string, subs: Cue[], total: number, starts: number[]): string {
  const segs = starts
    .slice(1, -1)
    .map((s, i) => `<i style="--d:${s.toFixed(2)}s;--w:${(starts[i + 2] - s).toFixed(2)}s"></i>`)
    .join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<div class="bg"></div>
<header style="--d:${starts[1].toFixed(2)}s">
  <div class="brand"><span class="logo" style="--s:64px"><span class="o">O</span><i style="left:27%"></i><i style="right:27%"></i></span>
  <div><div class="kick">ÖZET ANLATIYOR</div><div class="ttl">${esc(ep.title)}</div></div></div>
  <div class="prog">${segs}</div>
</header>
<main>${body}</main>
<div id="sub"><span></span></div>
<script>
const SUBS = ${JSON.stringify(subs)};
const fmt = (v, dec) => v.toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
window.__tick = (t) => {
  const box = document.getElementById("sub"), span = box.firstElementChild;
  const cur = SUBS.find((c) => t >= c.start && t < c.end + 0.15);
  if (cur) {
    if (span.textContent !== cur.text) span.textContent = cur.text;
    const k = ease((t - cur.start) / 0.18);
    box.style.opacity = String(k);
    box.style.transform = "translateY(" + (1 - k) * 14 + "px)";
  } else box.style.opacity = "0";
  for (const el of document.querySelectorAll("[data-to]")) {
    const k = ease((t - Number(el.dataset.at)) / Number(el.dataset.dur || 1.6));
    const from = Number(el.dataset.from || 0), to = Number(el.dataset.to);
    el.textContent = fmt(from + (to - from) * k, Number(el.dataset.dec || 0));
  }
};
window.__tick(0);
</script></body></html>`;
}

export async function makeExplainer(slug: string, ep: Episode): Promise<string> {
  const dir = path.join("out", "explainers", slug);
  const audioDir = path.join(dir, "audio");
  await mkdir(audioDir, { recursive: true });

  const voices = await speakAll(
    ep.scenes.map((s) => s.say),
    audioDir,
  );

  // Lay scenes end to end, each as long as its narration plus padding.
  const starts: number[] = [];
  let t = 0;
  for (const [i, v] of voices.entries()) {
    starts.push(t);
    t += LEAD + v.duration + TAIL + (ep.scenes[i].hold ?? 0);
  }
  const total = t;
  starts.push(total);

  const subs: Cue[] = [];
  const body = ep.scenes
    .map((s, i) => {
      const t0 = starts[i];
      const dur = starts[i + 1] - t0;
      const at = voices[i].cues.map((c) => LEAD + c.start);
      subs.push(...chunk(voices[i].words, t0 + LEAD));
      const d = (x: number, extra = "") => `--d:${(t0 + x).toFixed(2)}s;${extra}`;
      const out = i === ep.scenes.length - 1 ? total + 1 : t0 + dur - 0.35;
      return `<section class="scene" style="--in:${t0.toFixed(2)}s;--out:${out.toFixed(2)}s">${s.view({ t0, dur, at, d })}</section>`;
    })
    .join("\n");

  const html = page(ep, body, subs, total, starts);
  await writeFile(path.join(dir, "video.html"), html);

  // Voice track: each narration placed at its scene start + LEAD.
  const voiceFile = path.join(dir, "voice.wav");
  await run(ffmpegPath as unknown as string, [
    "-y",
    ...voices.flatMap((v) => ["-i", v.file]),
    "-filter_complex",
    voices.map((_, i) => `[${i}:a]adelay=delays=${Math.round((starts[i] + LEAD) * 1000)}:all=1[a${i}]`).join(";") +
      ";" +
      voices.map((_, i) => `[a${i}]`).join("") +
      `amix=inputs=${voices.length}:normalize=0,apad,atrim=0:${total.toFixed(3)}`,
    "-ar", "44100",
    "-ac", "1",
    voiceFile,
  ]);

  const last = starts[starts.length - 2];
  const cues = {
    total,
    whooshes: starts.slice(1, -1).map((s) => Math.max(0, s - 0.2)),
    hits: [0.1, last + 0.4],
    pops: [],
    ticks: [],
    chimes: [],
    sting: total - 2.2,
    bed: [0, total] as [number, number],
  };
  await writeFile(path.join(dir, "caption.txt"), ep.caption);
  console.log(`render ${total.toFixed(1)} sn...`);
  return renderVideo(html, path.join(dir, "video.mp4"), cues, voiceFile);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Inter:wght@400;500;600;700;800&display=block');
:root { --ink: #16140F; --paper: #F4EFE6; --red: #D6333A; --mute: #8C8475; --line: #2C2922; --card: #201D17; --green: #3BAA72; --amber: #E3A23B;
  --e: cubic-bezier(.2,.8,.2,1); --b: cubic-bezier(.34,1.56,.64,1); }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 1080px; height: 1920px; overflow: hidden; background: var(--ink); color: var(--paper); font-family: 'Inter', sans-serif; }
.serif { font-family: 'Fraunces', serif; }
.bg { position: absolute; inset: 0;
  background: radial-gradient(90% 55% at 50% 32%, #2A251C 0%, rgba(22,20,15,0) 70%),
    repeating-linear-gradient(0deg, rgba(244,239,230,.025) 0 1px, transparent 1px 72px),
    repeating-linear-gradient(90deg, rgba(244,239,230,.025) 0 1px, transparent 1px 72px); }

.logo { position: relative; display: inline-block; width: var(--s); height: var(--s); background: var(--paper); border-radius: calc(var(--s) * 0.18); flex: none; }
.logo .o { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-40%); text-align: center; color: var(--ink); font-size: calc(var(--s) * 0.72); font-weight: 800; line-height: 1; font-family: 'Fraunces', serif; }
.logo i { position: absolute; top: 16%; width: 12%; height: 12%; border-radius: 50%; background: var(--red); }

header { position: absolute; left: 72px; right: 72px; top: 150px; animation: fadeUp .6s var(--e) var(--d) both; }
.brand { display: flex; align-items: center; gap: 22px; }
.kick { font-size: 22px; font-weight: 800; letter-spacing: .24em; color: var(--red); }
.ttl { font-family: 'Fraunces', serif; font-size: 54px; font-weight: 800; line-height: 1.05; }
.prog { display: flex; gap: 8px; margin-top: 30px; }
.prog i { flex: 1; height: 6px; border-radius: 3px; background: var(--line); position: relative; overflow: hidden; }
.prog i::after { content: ''; position: absolute; inset: 0; background: var(--paper); transform-origin: left; animation: grow var(--w) linear var(--d) both; }

main { position: absolute; left: 72px; right: 72px; top: 400px; height: 900px; }
.scene { position: absolute; inset: 0; opacity: 0; animation: sceneIn .55s var(--e) var(--in) both, sceneOut .35s ease-in var(--out) forwards; }

#sub { position: absolute; left: 72px; right: 140px; top: 1340px; min-height: 150px; display: flex; align-items: flex-start; justify-content: center; text-align: center; }
#sub span { font-size: 50px; font-weight: 700; line-height: 1.25; padding: 14px 26px; border-radius: 18px; background: rgba(10,9,7,.72); box-decoration-break: clone; -webkit-box-decoration-break: clone; }

/* reusable pieces */
.an { animation: fadeUp .6s var(--e) var(--d) both; }
.pop { animation: pop .55s var(--b) var(--d) both; }
.slideL { animation: slideL .7s var(--e) var(--d) both; }
.slideR { animation: slideR .7s var(--e) var(--d) both; }
.stamp { animation: stamp .45s cubic-bezier(.5,0,.2,1.4) var(--d) both; }
.draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw var(--len, 1.6s) var(--e) var(--d) forwards; }
.grow { transform-origin: left; animation: grow .7s var(--e) var(--d) both; }

.date { display: flex; align-items: baseline; gap: 18px; }
.date .dd { font-family: 'Fraunces', serif; font-size: 104px; font-weight: 800; line-height: 1; letter-spacing: -.01em; }
.date .yy { font-size: 34px; font-weight: 600; color: var(--mute); }
.rule { height: 8px; width: 160px; background: var(--red); border-radius: 4px; margin: 26px 0 30px; }
h2 { font-size: 58px; font-weight: 800; line-height: 1.12; letter-spacing: -.01em; }
h2 em { font-style: normal; color: var(--red); }
.note { font-size: 24px; color: var(--mute); font-weight: 500; letter-spacing: .04em; }

.card { background: var(--card); border: 2px solid var(--line); border-radius: 28px; padding: 30px 34px; }
.chip { display: inline-flex; align-items: center; gap: 12px; padding: 14px 24px; border-radius: 999px; background: var(--card); border: 2px solid var(--line); font-size: 30px; font-weight: 700; }
.chip b { color: var(--red); }

.person { display: flex; align-items: center; gap: 26px; }
.avatar { width: 112px; height: 112px; border-radius: 50%; background: #2E2A22; display: grid; place-items: center; font-family: 'Fraunces', serif; font-size: 44px; font-weight: 800; color: var(--paper); flex: none; border: 3px solid var(--line); }
.person .nm { font-size: 40px; font-weight: 800; line-height: 1.1; }
.person .rl { font-size: 26px; color: var(--mute); margin-top: 6px; font-weight: 500; }
.tag { display: inline-block; margin-top: 12px; padding: 8px 18px; border: 4px solid var(--red); color: var(--red); border-radius: 10px; font-size: 26px; font-weight: 800; letter-spacing: .14em; transform: rotate(-4deg); }
.tag.amber { border-color: var(--amber); color: var(--amber); }

.big { font-family: 'Fraunces', serif; font-weight: 800; line-height: .95; letter-spacing: -.02em; }
.unit { font-size: 40px; font-weight: 700; color: var(--mute); }

@keyframes sceneIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
@keyframes sceneOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-30px); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(36px); } to { opacity: 1; transform: none; } }
@keyframes pop { 0% { opacity: 0; transform: scale(.5); } 100% { opacity: 1; transform: scale(1); } }
@keyframes slideL { from { opacity: 0; transform: translateX(-120px); } to { opacity: 1; transform: none; } }
@keyframes slideR { from { opacity: 0; transform: translateX(120px); } to { opacity: 1; transform: none; } }
@keyframes stamp { 0% { opacity: 0; transform: scale(2.4) rotate(-14deg); } 100% { opacity: 1; transform: scale(1) rotate(-6deg); } }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes fill { from { background: #2A261F; } to { background: var(--red); } }
@keyframes shackle { 0% { transform: translateY(-70px); } 70% { transform: translateY(6px); } 100% { transform: translateY(0); } }
@keyframes ring { 0% { opacity: .7; transform: scale(.6); } 100% { opacity: 0; transform: scale(1.6); } }
@keyframes flip { 0% { opacity: 0; transform: perspective(900px) rotateX(-90deg); } 100% { opacity: 1; transform: perspective(900px) rotateX(0); } }
`;

const slug = process.argv[2];
if (slug) {
  const mod = (await import(`./explainers/${slug}.ts`)) as { default: Episode };
  const file = await makeExplainer(slug, mod.default);
  console.log(`✓ ${file}`);
}
