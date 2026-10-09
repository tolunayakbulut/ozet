import { CATEGORY_LABEL, type Category } from "./feeds.ts";
import type { Story } from "./select.ts";
import type { Quote } from "./market.ts";

export const BRAND = "ÖZET MANŞET";
export const HANDLE = "@ozetmanset";

/** Logo mark: serif "O" whose umlaut dots are red, on a dark square. */
export function logoMark(size: number): string {
  return `<span class="logo" style="--s:${size}px"><span class="o serif">O</span><i></i><i></i></span>`;
}

const LOGO_CSS = `
.logo { position: relative; display: inline-block; width: var(--s); height: var(--s); background: #16140F; border-radius: calc(var(--s) * 0.18); flex: none; }
.logo .o { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-40%); text-align: center; color: #F4EFE6; font-size: calc(var(--s) * 0.72); font-weight: 800; line-height: 1; }
.logo i { position: absolute; top: 16%; width: 12%; height: 12%; border-radius: 50%; background: #D6333A; }
.logo i:first-of-type { left: 33%; } .logo i:last-of-type { right: 33%; }
`;

const BRAND_RED = "#D6333A";
const INK = "#16140F";

export interface Theme {
  /** Color numbers and category labels per category, or keep them neutral. */
  categoryColors: boolean;
  /** Emphasize each story's highlight phrase: off, in its category color, or in brand red. */
  highlight: "none" | "category" | "brand";
}

export const DEFAULT_THEME: Theme = { categoryColors: true, highlight: "category" };

const COLORS: Record<Category, string> = {
  gundem: "#D6333A",
  ekonomi: "#1F8A55",
  dunya: "#2F55C8",
  spor: "#E0620D",
  teknoloji: "#7B3FB8",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function marketStrip(quotes: Quote[]): string {
  if (!quotes.length) return "";
  const fmt = (q: Quote) =>
    q.value.toLocaleString("tr-TR", { minimumFractionDigits: q.decimals, maximumFractionDigits: q.decimals });
  const cells = quotes
    .map((q) => {
      const dir = Math.abs(q.changePct) < 0.005 ? "flat" : q.changePct > 0 ? "up" : "down";
      const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
      const change = Math.abs(q.changePct).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `<div class="q"><span class="ql">${esc(q.label)}</span><span class="qv">${fmt(q)}</span><span class="qc ${dir}">${arrow} %${change}</span></div>`;
    })
    .join("");
  return `<section class="market">${cells}</section>`;
}

/** Title with its highlight phrase wrapped in <mark>. */
function headline(s: Story): string {
  const i = s.highlight ? s.title.indexOf(s.highlight) : -1;
  if (i < 0) return esc(s.title);
  const end = i + s.highlight!.length;
  return `${esc(s.title.slice(0, i))}<mark>${esc(s.title.slice(i, end))}</mark>${esc(s.title.slice(end))}`;
}

/** Video timeline in seconds (shared with the sound design in video.ts). */
export const TIMELINE = {
  introEnd: 2.4, // curtain lifts
  itemStart: 2.9,
  itemStep: 0.75,
  outroStart: 15.0,
  total: 19.5,
};

export function itemTimes(count: number): number[] {
  return Array.from({ length: count }, (_, i) => TIMELINE.itemStart + i * TIMELINE.itemStep);
}

const SPRING = "cubic-bezier(.34,1.56,.64,1)";
const EASE_OUT = "cubic-bezier(.16,1,.3,1)";
const EASE_IN_OUT = "cubic-bezier(.76,0,.24,1)";

/** Intro/outro overlay markup: dark curtains carrying the logo animation. */
function videoOverlays(date: Date): string {
  const weekday = date.toLocaleDateString("tr-TR", { weekday: "long" });
  const day = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const letters = [...BRAND].map((c, i) => `<span style="--i:${i}">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("");
  const mark = `<div class="bigmark"><span class="o serif">O</span><i class="d1"></i><i class="d2"></i></div>`;
  return `
  <div class="intro">
    ${mark}
    <div class="word">${letters}</div>
    <div class="rule"></div>
    <div class="idate">${esc(day)} · ${esc(weekday)}</div>
  </div>
  <div class="outro">
    ${mark}
    <div class="oword">${BRAND}</div>
    <div class="oask">Sence bugünün en önemli haberi hangisi?<br><b>Numarasını yorumlara yaz</b></div>
    <div class="otime">Her akşam <b>20:00</b>'de günün manşetleri</div>
    <div class="ofollow">Takip et · ${HANDLE}</div>
  </div>`;
}

/**
 * Motion design for the 9:16 video. Frames are captured by pausing every animation at t
 * (see video.ts), so all delays are absolute times on TIMELINE.
 */
function videoCss(count: number): string {
  const T = TIMELINE;
  const items = itemTimes(count)
    .map((t, i) => `li:nth-child(${i + 1}) { animation: slideIn 0.6s ${EASE_OUT} ${t.toFixed(2)}s both; }`)
    .join("\n");
  const after = T.itemStart + count * T.itemStep;
  const o = T.outroStart;
  return `
@keyframes fadeUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
@keyframes slideIn { from { opacity: 0; transform: translateX(-90px); } to { opacity: 1; transform: none; } }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
@keyframes drop { 0% { opacity: 0; transform: translateY(-160px); } 60% { opacity: 1; transform: translateY(12px); } 80% { transform: translateY(-6px); } 100% { opacity: 1; transform: none; } }
@keyframes letter { from { opacity: 0; transform: translateY(0.6em); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes liftAway { from { transform: none; } to { transform: translateY(-100%); } }
@keyframes dropIn { from { transform: translateY(100%); } to { transform: none; } }
@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }

/* Intro curtain */
.intro, .outro { position: absolute; inset: 0; z-index: 10; background: #16140F; color: #F4EFE6;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 36px; }
.intro { animation: liftAway 0.8s ${EASE_IN_OUT} ${(T.introEnd - 0.4).toFixed(2)}s both; }
.bigmark { position: relative; width: 300px; height: 300px; }
.bigmark .o { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding-top: 70px;
  font-size: 300px; font-weight: 800; line-height: 1; color: #F4EFE6; }
.bigmark i { position: absolute; top: 18px; width: 50px; height: 50px; border-radius: 50%; background: ${BRAND_RED}; }
.bigmark .d1 { left: 86px; } .bigmark .d2 { right: 86px; }
.intro .bigmark .o { animation: pop 0.7s ${SPRING} 0.15s both; }
.intro .bigmark .d1 { animation: drop 0.6s ease-out 0.55s both; }
.intro .bigmark .d2 { animation: drop 0.6s ease-out 0.72s both; }
.word { font-size: 56px; font-weight: 700; letter-spacing: 0.28em; display: flex; }
.word span { display: inline-block; animation: letter 0.5s ${EASE_OUT} calc(0.95s + var(--i) * 0.035s) both; }
.rule { width: 420px; height: 6px; background: ${BRAND_RED}; transform-origin: left; animation: grow 0.6s ${EASE_OUT} 1.35s both; }
.idate { font-size: 34px; font-weight: 500; color: #B9AF9D; text-transform: capitalize; animation: fadeUp 0.6s ${EASE_OUT} 1.55s both; }

/* Main content, scaled up to fill 1080x1920 */
h1 { font-size: 96px; }
.brand { font-size: 26px; }
.brandrow .logo { --s: 52px !important; }
.date .weekday { font-size: 28px; } .date .day { font-size: 44px; }
.cat { font-size: 21px; }
.toptag { font-size: 19px; }
.ql { font-size: 19px; } .qv { font-size: 40px; } .qc { font-size: 23px; }
footer { font-size: 22px; }
.brandrow { animation: fadeUp 0.6s ${EASE_OUT} ${(T.introEnd).toFixed(2)}s both; }
h1 { animation: fadeUp 0.7s ${EASE_OUT} ${(T.introEnd + 0.1).toFixed(2)}s both; }
.date { animation: fadeUp 0.7s ${EASE_OUT} ${(T.introEnd + 0.25).toFixed(2)}s both; }
header { border-bottom: none; position: relative; }
header::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: #16140F; transform-origin: left; animation: grow 0.8s ${EASE_OUT} ${(T.introEnd + 0.3).toFixed(2)}s both; }
${items}
li.top { background-image: linear-gradient(100deg, #E9E1D2 40%, #F6F0E4 50%, #E9E1D2 60%); background-size: 1200px 100%;
  animation: slideIn 0.6s ${EASE_OUT} var(--t) both, shimmer 1.4s ease-in-out calc(var(--t) + 0.7s) both; }
.market { animation: fadeUp 0.6s ${EASE_OUT} ${after.toFixed(2)}s both; }
footer { animation: fadeUp 0.6s ${EASE_OUT} ${(after + 0.4).toFixed(2)}s both; }

/* Outro curtain */
.outro { animation: dropIn 0.8s ${EASE_IN_OUT} ${o.toFixed(2)}s both; }
.outro .bigmark .o { animation: pop 0.7s ${SPRING} ${(o + 0.6).toFixed(2)}s both; }
.outro .bigmark .d1 { animation: drop 0.6s ease-out ${(o + 0.95).toFixed(2)}s both; }
.outro .bigmark .d2 { animation: drop 0.6s ease-out ${(o + 1.1).toFixed(2)}s both; }
.oword { font-size: 56px; font-weight: 700; letter-spacing: 0.28em; animation: fadeUp 0.6s ${EASE_OUT} ${(o + 1.3).toFixed(2)}s both; }
.otime { font-size: 38px; font-weight: 500; color: #D8D0C0; animation: fadeUp 0.6s ${EASE_OUT} ${(o + 1.6).toFixed(2)}s both; }
.otime b { color: #F4EFE6; }
.oask { margin: 8px 80px; padding: 28px 40px; border: 3px solid ${BRAND_RED}; border-radius: 28px; text-align: center;
  font-size: 40px; font-weight: 500; line-height: 1.35; color: #F4EFE6; animation: fadeUp 0.6s ${EASE_OUT} ${(o + 1.45).toFixed(2)}s both; }
.oask b { color: ${BRAND_RED}; font-weight: 800; }
.ofollow { margin-top: 20px; padding: 22px 48px; border-radius: 999px; background: ${BRAND_RED}; color: #fff; font-size: 36px; font-weight: 700;
  animation: fadeUp 0.6s ${EASE_OUT} ${(o + 1.9).toFixed(2)}s both, pulse 1.2s ease-in-out ${(o + 2.6).toFixed(2)}s 2; }
`;
}

/**
 * Single-image digest: every story as one numbered headline on one page.
 * With `video`, renders the 1080x1920 animated layout used for the story/Reels video.
 */
export function digestHtml(
  stories: Story[],
  date: Date,
  quotes: Quote[] = [],
  theme = DEFAULT_THEME,
  video = false,
): string {
  const markColor = theme.highlight === "brand" ? BRAND_RED : "var(--c)";
  const day = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const weekday = date.toLocaleDateString("tr-TR", { weekday: "long" });
  const sources = [...new Set(stories.flatMap((s) => s.sources))];

  const items = stories
    .map(
      (s, i) => `
      <li class="${s.top ? "top" : ""}" style="--c:${theme.categoryColors ? COLORS[s.category] : INK}; --t:${(TIMELINE.itemStart + i * TIMELINE.itemStep).toFixed(2)}s">
        <span class="num serif">${i + 1}</span>
        <div>
          <span class="cat">${CATEGORY_LABEL[s.category]}${s.top ? `<span class="toptag">★ Günün manşeti</span>` : ""}</span>
          <p class="headline">${theme.highlight === "none" ? esc(s.title) : headline(s)}</p>
        </div>
      </li>`,
    )
    .join("");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Inter:wght@400;500;600;700&display=block');
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: ${video ? 1920 : 1350}px; }
body {
  font-family: 'Inter', sans-serif; background: #F4EFE6; color: #16140F;
  padding: ${video ? "190px 150px 330px 80px" : "72px 80px 64px"}; display: flex; flex-direction: column; overflow: hidden;
}
.serif { font-family: 'Fraunces', serif; }
${LOGO_CSS}
.brandrow { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.brandrow .brand { margin-bottom: 0; }
header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 24px; border-bottom: 6px solid #16140F; }
.brand { font-size: 22px; font-weight: 700; letter-spacing: 0.22em; margin-bottom: 10px; }
h1 { font-size: 84px; font-weight: 800; line-height: 0.95; letter-spacing: -0.02em; }
.date { text-align: right; }
.date .weekday { font-size: 24px; font-weight: 500; color: #6B6559; text-transform: capitalize; }
.date .day { font-size: 40px; font-weight: 700; margin-top: 4px; }
ol {
  --h: ${video ? 46 : 33}px;
  list-style: none; flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: space-between; padding: 8px 28px; margin: 0 -28px;
}
li { display: grid; grid-template-columns: 64px 1fr; gap: 12px; align-items: start; padding: 14px 0; border-bottom: 1px solid #D9D1C2; }
li:last-child { border-bottom: none; }
.num { font-size: calc(var(--h) * 1.45); font-weight: 800; color: var(--c); line-height: 1; }
.cat { display: block; font-size: 17px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c); margin-bottom: 6px; }
.wm-side { position: absolute; right: 26px; top: 50%; transform: translate(50%, -50%) rotate(90deg); transform-origin: center; white-space: nowrap; font-size: 15px; font-weight: 700; letter-spacing: 0.3em; color: #B9AF9D; }
body > header, body > ol, body > .market, body > footer { position: relative; z-index: 1; }
li.top { background: #E9E1D2; margin: 0 -28px; padding: 18px 28px; border-radius: 12px; border-bottom-color: transparent; }
.headline mark { background: none; color: ${markColor}; font-weight: 700; }
.cat { color: ${theme.categoryColors ? "var(--c)" : "#8A8272"}; }
.toptag { margin-left: 12px; padding: 3px 10px; border-radius: 999px; background: ${theme.categoryColors ? "var(--c)" : BRAND_RED}; color: #fff; letter-spacing: 0.08em; }
.headline { font-size: var(--h); font-weight: 500; line-height: 1.22; letter-spacing: -0.005em; }
.market { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 2px solid #16140F; }
.q { display: flex; flex-direction: column; gap: 2px; padding: 16px 0 18px 20px; border-left: 1px solid #D9D1C2; }
.q:first-child { padding-left: 0; border-left: none; }
.ql { font-size: 16px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6B6559; }
.qv { font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
.qc { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; }
.qc.up { color: #1F8A55; } .qc.down { color: #D6333A; } .qc.flat { color: #6B6559; }
footer { display: flex; justify-content: space-between; gap: 40px; padding-top: 22px; border-top: 2px solid #16140F; font-size: 19px; color: #6B6559; }
footer b { color: #16140F; font-weight: 600; white-space: nowrap; }
footer span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
${video ? videoCss(stories.length) : ""}
</style></head><body>
  ${video ? videoOverlays(date) : ""}
  <header>
    <div>
      <div class="brandrow">${logoMark(44)}<span class="brand">${BRAND}</span></div>
      <h1 class="serif">Bugün ne oldu?</h1>
    </div>
    <div class="date"><div class="weekday">${esc(weekday)}</div><div class="day serif">${esc(day)}</div></div>
  </header>
  <div class="wm-side">ÖZET MANŞET · ${HANDLE} · ÖZET MANŞET · ${HANDLE}</div>
  <ol class="fit" data-var="--h" data-min="24">${items}</ol>
  ${marketStrip(quotes)}
  <footer>
    <span>Kaynaklar: ${esc(sources.slice(0, 6).join(", "))}${sources.length > 6 ? "…" : ""}</span>
    <b>${HANDLE} · Detaylar açıklamada</b>
  </footer>
</body></html>`;
}

/** Square profile picture / standalone logo page. */
export function logoHtml(size = 1080): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&display=block');
* { margin: 0; padding: 0; }
html, body { width: ${size}px; height: ${size}px; background: #16140F; }
.serif { font-family: 'Fraunces', serif; }
${LOGO_CSS}
.logo { border-radius: 0; }
</style></head><body>${logoMark(size)}</body></html>`;
}

