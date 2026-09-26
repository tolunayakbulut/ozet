import { CATEGORY_LABEL, type Category } from "./feeds.ts";
import type { Story } from "./select.ts";

export const BRAND = "GÜNÜN ÖZETİ";

const COLORS: Record<Category, string> = {
  gundem: "#E5484D",
  ekonomi: "#30A46C",
  dunya: "#3E63DD",
  spor: "#F76B15",
  teknoloji: "#8E4EC6",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Inter:wght@400;500;600;700&display=block');
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1350px; }
body { font-family: 'Inter', sans-serif; background: #0E0E10; color: #F4F4F5; overflow: hidden; position: relative; }
.serif { font-family: 'Fraunces', serif; }
.fit { overflow: hidden; }
.brand { font-weight: 700; letter-spacing: 0.18em; font-size: 26px; }
.tag { display: inline-block; padding: 10px 22px; border-radius: 999px; font-weight: 700; font-size: 24px; letter-spacing: 0.08em; text-transform: uppercase; color: #fff; align-self: flex-start; }
.credit { position: absolute; font-size: 18px; color: rgba(255,255,255,0.7); }
`;

function page(body: string, css: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

export function coverHtml(story: Story, dateLabel: string, useImages: boolean): string {
  const color = COLORS[story.category];
  const img = useImages && story.image;
  return page(
    `
    ${img ? `<div class="bg" style="background-image:url('${esc(story.image!)}')"></div><div class="shade"></div>` : `<div class="pattern"></div>`}
    <header><span class="brand">${BRAND}</span><span class="date">${esc(dateLabel)}</span></header>
    <main>
      <span class="tag" style="background:${color}">Günün manşeti</span>
      <h1 class="serif fit" data-min="64">${esc(story.title)}</h1>
      <p class="fit" data-min="26">${esc(story.summary)}</p>
    </main>
    <footer><span>Kaydır →</span><span>Kaynak: ${esc(story.sources.slice(0, 3).join(", "))}</span></footer>
    ${img ? `<span class="credit" style="right:80px;top:150px">Foto: ${esc(story.sources[0])}</span>` : ""}
    `,
    `
    .bg { position:absolute; inset:0; background-size:cover; background-position:center; filter: saturate(0.85); }
    .shade { position:absolute; inset:0; background: linear-gradient(180deg, rgba(14,14,16,0.55) 0%, rgba(14,14,16,0.2) 30%, rgba(14,14,16,0.92) 62%, #0E0E10 100%); }
    .pattern { position:absolute; inset:0; background: radial-gradient(circle at 80% 15%, ${color}55, transparent 55%), radial-gradient(circle at 10% 90%, ${color}33, transparent 50%); }
    header { position:absolute; top:80px; left:80px; right:80px; display:flex; justify-content:space-between; align-items:center; }
    .date { font-size: 26px; font-weight: 500; opacity: 0.85; }
    main { position:absolute; left:80px; right:80px; bottom:170px; display:flex; flex-direction:column; gap:32px; }
    h1 { font-size: 92px; line-height: 1.02; font-weight: 800; max-height: 480px; }
    p { font-size: 34px; line-height: 1.4; color: #D4D4D8; max-height: 200px; }
    footer { position:absolute; left:80px; right:80px; bottom:80px; display:flex; justify-content:space-between; font-size: 24px; color:#A1A1AA; }
    `,
  );
}

export function newsHtml(
  story: Story,
  index: number,
  total: number,
  dateLabel: string,
  useImages: boolean,
): string {
  const color = COLORS[story.category];
  const img = useImages && story.image;
  return page(
    `
    <div class="top" style="${img ? `background-image:url('${esc(story.image!)}')` : `background:${color}`}">
      ${img ? `<span class="credit" style="right:40px;bottom:20px">Foto: ${esc(story.sources[0])}</span>` : `<span class="bignum serif">${index}</span>`}
    </div>
    <header><span class="brand">${BRAND}</span><span class="count">${index}/${total}</span></header>
    <main>
      <span class="tag" style="background:${color}">${CATEGORY_LABEL[story.category]}</span>
      <h2 class="serif fit" data-min="44">${esc(story.title)}</h2>
      <p class="fit" data-min="26">${esc(story.summary)}</p>
    </main>
    <footer><span>Kaynak: ${esc(story.sources.slice(0, 3).join(", "))}</span><span>${esc(dateLabel)}</span></footer>
    `,
    `
    .top { position:absolute; top:0; left:0; right:0; height:560px; background-size:cover; background-position:center; }
    .top::after { content:''; position:absolute; inset:0; background: linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 35%, transparent 70%, #0E0E10 100%); }
    .bignum { position:absolute; right:60px; bottom:-40px; font-size: 420px; font-weight: 800; color: rgba(255,255,255,0.18); line-height:1; }
    .credit { z-index: 2; }
    header { position:absolute; top:70px; left:80px; right:80px; display:flex; justify-content:space-between; z-index:2; }
    .count { font-size: 26px; font-weight: 700; }
    main { position:absolute; top:600px; left:80px; right:80px; bottom:170px; display:flex; flex-direction:column; gap:28px; }
    h2 { font-size: 64px; line-height: 1.08; font-weight: 700; max-height: 290px; }
    p { font-size: 34px; line-height: 1.45; color: #D4D4D8; flex: 1; min-height: 0; }
    footer { position:absolute; left:80px; right:80px; bottom:80px; display:flex; justify-content:space-between; font-size: 24px; color:#A1A1AA; border-top: 1px solid #27272A; padding-top: 28px; }
    `,
  );
}
