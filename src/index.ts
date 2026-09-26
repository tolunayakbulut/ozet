import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { selectHeuristic, selectWithClaude, type Story } from "./select.ts";
import { coverHtml, newsHtml } from "./templates.ts";
import { renderSlides } from "./render.ts";
import { CATEGORY_LABEL } from "./feeds.ts";

// Instagram API carousel limit is 10: cover + 9 stories.
const STORY_COUNT = 9;
const useImages = !process.argv.includes("--no-images");
const forceHeuristic = process.argv.includes("--no-llm");

function buildCaption(stories: Story[], dateLabel: string): string {
  const lines = stories.map((s, i) => `${i + 1}. ${s.title}`);
  const sources = [...new Set(stories.flatMap((s) => s.sources))];
  return [
    `Günün özeti · ${dateLabel}`,
    "",
    ...lines,
    "",
    `Kaynaklar: ${sources.join(", ")}`,
    "",
    "#gündem #haber #gününözeti",
  ].join("\n");
}

async function main() {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
  const outDir = path.join("out", now.toISOString().slice(0, 10));

  console.log("RSS çekiliyor…");
  const articles = await fetchAll(24);
  console.log(`  ${articles.length} haber (son 24 saat)`);

  const useClaude = !forceHeuristic && Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(useClaude ? "Claude ile seçiliyor…" : "Seçim: sezgisel (LLM yok)…");
  const stories = useClaude
    ? await selectWithClaude(articles, STORY_COUNT)
    : selectHeuristic(articles, STORY_COUNT);

  for (const [i, s] of stories.entries()) {
    console.log(`  ${i + 1}. [${CATEGORY_LABEL[s.category]}] ${s.title} (${s.sources.join(", ")})`);
  }

  console.log("Render…");
  const pages = [
    coverHtml(stories[0], dateLabel, useImages),
    ...stories.map((s, i) => newsHtml(s, i + 1, stories.length, dateLabel, useImages)),
  ];
  const files = await renderSlides(pages, outDir);

  await writeFile(path.join(outDir, "caption.txt"), buildCaption(stories, dateLabel));
  await writeFile(path.join(outDir, "stories.json"), JSON.stringify(stories, null, 2));
  console.log(`Bitti: ${files.length} slayt → ${outDir}/`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
