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

/** Single-image digest: every story as one numbered headline on one page. */
export function digestHtml(stories: Story[], date: Date, quotes: Quote[] = []): string {
  const day = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const weekday = date.toLocaleDateString("tr-TR", { weekday: "long" });
  const sources = [...new Set(stories.flatMap((s) => s.sources))];

  const items = stories
    .map(
      (s, i) => `
      <li style="--c:${COLORS[s.category]}">
        <span class="num serif">${i + 1}</span>
        <div>
          <span class="cat">${CATEGORY_LABEL[s.category]}</span>
          <p class="headline">${esc(s.title)}</p>
        </div>
      </li>`,
    )
    .join("");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Inter:wght@400;500;600;700&display=block');
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1350px; }
body {
  font-family: 'Inter', sans-serif; background: #F4EFE6; color: #16140F;
  padding: 72px 80px 64px; display: flex; flex-direction: column; overflow: hidden;
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
  --h: 33px;
  list-style: none; flex: 1; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: space-between; padding: 8px 0;
}
li { display: grid; grid-template-columns: 64px 1fr; gap: 12px; align-items: start; padding: 14px 0; border-bottom: 1px solid #D9D1C2; }
li:last-child { border-bottom: none; }
.num { font-size: calc(var(--h) * 1.45); font-weight: 800; color: var(--c); line-height: 1; }
.cat { display: block; font-size: 17px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--c); margin-bottom: 6px; }
.headline { font-size: var(--h); font-weight: 600; line-height: 1.22; letter-spacing: -0.005em; }
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
</style></head><body>
  <header>
    <div>
      <div class="brandrow">${logoMark(44)}<span class="brand">${BRAND}</span></div>
      <h1 class="serif">Bugün ne oldu?</h1>
    </div>
    <div class="date"><div class="weekday">${esc(weekday)}</div><div class="day serif">${esc(day)}</div></div>
  </header>
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
