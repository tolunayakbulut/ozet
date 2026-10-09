import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { selectHeuristic, selectWithClaude, type Story } from "./select.ts";
import { DEFAULT_THEME, digestHtml, headlineCardHtml } from "./templates.ts";
import { renderVideo, videoCues } from "./video.ts";
import { renderSlides } from "./render.ts";
import { CATEGORY_LABEL } from "./feeds.ts";
import { fetchMarket, type Quote } from "./market.ts";

const STORY_COUNT = 8;
const forceHeuristic = process.argv.includes("--no-llm");

const CAPTION_LIMIT = 2200;

/**
 * Edition date (YYYY-MM-DD, Istanbul). A run before 06:00 still belongs to the previous evening,
 * so a late run doesn't label its post with tomorrow's date. The workflow passes EDITION_DATE so
 * the output folder, the labels and the published marker all use the same day.
 */
function editionDate(): string {
  if (process.env.EDITION_DATE) return process.env.EDITION_DATE;
  return new Date(Date.now() - 6 * 3600_000).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

function trimTo(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, text.lastIndexOf(" ", max - 1)) + "…";
}

const CATEGORY_TAGS: Record<Story["category"], string[]> = {
  gundem: ["#türkiye", "#gündem"],
  ekonomi: ["#ekonomi", "#borsa", "#piyasa"],
  dunya: ["#dünya", "#dünyahaberleri"],
  spor: ["#spor", "#futbol"],
  teknoloji: ["#teknoloji", "#bilim"],
};

/** Proper-noun hashtags from a title: capitalized words after the first, Turkish suffix after the apostrophe dropped. */
function titleTags(title: string, max = 3): string[] {
  const words = title.split(/\s+/).slice(1).map((w) => w.replace(/['’].*$/, "").replace(/[^\p{L}\p{N}]/gu, ""));
  const tags = words.filter((w) => w.length > 2 && /^\p{Lu}/u.test(w)).map((w) => `#${w.toLocaleLowerCase("tr-TR")}`);
  return [...new Set(tags)].slice(0, max);
}

function hashtags(stories: Story[], extra: string[] = []): string {
  const tags = ["#ozetmanset", "#haber", "#sondakika", ...extra, ...stories.flatMap((s) => CATEGORY_TAGS[s.category])];
  return [...new Set(tags)].slice(0, 15).join(" ");
}

/** Headline-card days (getUTCDay of the noon edition time): Monday, Wednesday, Friday. */
const HEADLINE_CARD_DAYS = [1, 3, 5];

function headlineCaption(s: Story, date: Date): string {
  const dateLabel = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  return [
    `★ GÜNÜN MANŞETİ · ${dateLabel}`,
    s.title,
    trimTo(s.summary, 600),
    `(Kaynak ve fotoğraf: ${s.sources.slice(0, 3).join(", ")})`,
    "👇 Sen ne düşünüyorsun? Yorumlara yaz.\nGünün tüm manşetleri bir önceki postta.",
    hashtags([s], titleTags(s.title, 5)),
  ].join("\n\n");
}

/**
 * Image carries headlines only; the caption carries a short detail and sources per item.
 * Details are trimmed evenly until the caption fits Instagram's limit.
 */
function buildCaption(stories: Story[], date: Date): string {
  const dateLabel = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const build = (detailMax: number) =>
    [
      `Özet Manşet · ${dateLabel}`,
      "👇 Sence bugünün en önemli haberi hangisi? Numarasını yorumlara yaz.",
      ...stories.map(
        (s, i) => `${i + 1}. ${s.title}\n${trimTo(s.summary, detailMax)}\n(Kaynak: ${s.sources.slice(0, 3).join(", ")})`,
      ),
      `@ozetmanset · Her akşam günün manşetleri\n${hashtags(stories, titleTags(stories.find((s) => s.top)?.title ?? ""))}`,
    ].join("\n\n");
  let detailMax = 250;
  let caption = build(detailMax);
  while (caption.length > CAPTION_LIMIT && detailMax > 60) caption = build((detailMax -= 10));
  return caption;
}

async function main() {
  const edition = editionDate();
  // Noon Istanbul (UTC+3, no DST) keeps the labels on the edition day in any local time zone.
  const now = new Date(`${edition}T12:00:00+03:00`);
  const outDir = path.join("out", edition);

  console.log("RSS çekiliyor…");
  const articles = await fetchAll(24);
  console.log(`  ${articles.length} haber (son 24 saat)`);

  const useClaude = !forceHeuristic && Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(useClaude ? "Claude ile seçiliyor…" : "Seçim: sezgisel (LLM yok)…");
  const selected = useClaude
    ? await selectWithClaude(articles, STORY_COUNT)
    : selectHeuristic(articles, STORY_COUNT);
  // Fixed category order every day; importance order is kept within a category (stable sort).
  if (selected[0]) selected[0].top = true;
  const order = Object.keys(CATEGORY_LABEL);
  const stories = [...selected].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

  for (const [i, s] of stories.entries()) {
    console.log(`  ${i + 1}. [${CATEGORY_LABEL[s.category]}] ${s.title} (${s.sources.join(", ")})`);
  }

  let quotes: Quote[] = [];
  try {
    quotes = await fetchMarket();
    console.log(`  Piyasa: ${quotes.map((q) => `${q.label} ${q.value.toFixed(q.decimals)} (${q.changePct.toFixed(2)}%)`).join(", ")}`);
  } catch (err) {
    console.warn(`  ! Piyasa verisi alınamadı, şerit atlanıyor: ${(err as Error).message}`);
  }

  console.log("Render…");
  // Some days the top story (if it has a photo) also gets its own big photo card as a second feed post (02.jpg).
  const top = stories.find((s) => s.top);
  const card = top?.image && HEADLINE_CARD_DAYS.includes(now.getUTCDay()) ? top : undefined;
  const files = await renderSlides([digestHtml(stories, now, quotes), ...(card ? [headlineCardHtml(card, now)] : [])], outDir);
  if (card) await writeFile(path.join(outDir, "manset.txt"), headlineCaption(card, now));
  // video.mp4: animated 9:16 version with music, used for the Instagram story and Reels.
  console.log("Video…");
  files.push(
    await renderVideo(digestHtml(stories, now, quotes, DEFAULT_THEME, true), path.join(outDir, "video.mp4"), videoCues(stories)),
  );

  const caption = buildCaption(stories, now);
  if (caption.length > CAPTION_LIMIT) console.warn(`  ! caption ${caption.length} karakter, Instagram sınırı 2200`);
  await writeFile(path.join(outDir, "caption.txt"), caption);
  await writeFile(path.join(outDir, "stories.json"), JSON.stringify(stories, null, 2));
  console.log(`Bitti: ${files.map((f) => path.basename(f)).join(", ")} → ${outDir}/`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
