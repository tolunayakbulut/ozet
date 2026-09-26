import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { selectHeuristic, selectWithClaude, type Story } from "./select.ts";
import { digestHtml, storyHtml } from "./templates.ts";
import { renderSlides } from "./render.ts";
import { CATEGORY_LABEL } from "./feeds.ts";
import { fetchMarket, type Quote } from "./market.ts";

const STORY_COUNT = 8;
const forceHeuristic = process.argv.includes("--no-llm");

const CAPTION_LIMIT = 2200;

function trimTo(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, text.lastIndexOf(" ", max - 1)) + "…";
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
      ...stories.map(
        (s, i) => `${i + 1}. ${s.title}\n${trimTo(s.summary, detailMax)}\n(Kaynak: ${s.sources.slice(0, 3).join(", ")})`,
      ),
      "@ozetmanset · Her akşam günün manşetleri\n#ozetmanset #gündem #haber",
    ].join("\n\n");
  let detailMax = 250;
  let caption = build(detailMax);
  while (caption.length > CAPTION_LIMIT && detailMax > 60) caption = build((detailMax -= 10));
  return caption;
}

async function main() {
  const now = new Date();
  const outDir = path.join("out", now.toISOString().slice(0, 10));

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
  const files = await renderSlides([digestHtml(stories, now, quotes)], outDir);
  // 02.jpg: 9:16 story version wrapping the digest image.
  const digest = (await readFile(files[0])).toString("base64");
  files.push(...(await renderSlides([storyHtml(digest, now)], outDir, { width: 1080, height: 1920 }, 2)));

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
