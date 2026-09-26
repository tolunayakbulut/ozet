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

/** Seconds into the video when list item i slides in. */
export const VIDEO_ITEM_START = 1.3;
export const VIDEO_ITEM_STEP = 0.8;

/**
 * Keyframed intro for the 9:16 video: header, then items one by one, then market and footer.
 * Frames are captured by pausing all animations at t (see video.ts), so delays are absolute times.
 */
function videoCss(count: number): string {
  const item = (i: number) =>
    `li:nth-child(${i + 1}) { animation: slideIn 0.55s cubic-bezier(.2,.8,.2,1) ${(VIDEO_ITEM_START + i * VIDEO_ITEM_STEP).toFixed(2)}s both; }`;
  const after = VIDEO_ITEM_START + count * VIDEO_ITEM_STEP;
  return `
@keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes slideIn { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: none; } }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.brandrow { animation: fadeUp 0.6s ease-out 0.1s both; }
h1 { animation: fadeUp 0.7s ease-out 0.35s both; }
.date { animation: fadeUp 0.7s ease-out 0.6s both; }
header { border-bottom: none; position: relative; }
header::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: #16140F; transform-origin: left; animation: grow 0.8s ease-out 0.7s both; }
${Array.from({ length: count }, (_, i) => item(i)).join("\n")}
.market { animation: fadeUp 0.6s ease-out ${after.toFixed(2)}s both; }
footer { animation: fadeUp 0.6s ease-out ${(after + 0.4).toFixed(2)}s both; }
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
      <li class="${s.top ? "top" : ""}" style="--c:${theme.categoryColors ? COLORS[s.category] : INK}">
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
  padding: ${video ? "230px 80px 320px" : "72px 80px 64px"}; display: flex; flex-direction: column; overflow: hidden;
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
  --h: ${video ? 38 : 33}px;
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

