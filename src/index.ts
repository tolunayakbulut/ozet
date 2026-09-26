import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAll } from "./fetch.ts";
import { selectHeuristic, selectWithClaude, type Story } from "./select.ts";
import { digestHtml } from "./templates.ts";
import { renderSlides } from "./render.ts";
import { CATEGORY_LABEL } from "./feeds.ts";

const STORY_COUNT = 8;
const forceHeuristic = process.argv.includes("--no-llm");

/** Image carries headlines only; the caption carries a short detail and sources per item. */
function buildCaption(stories: Story[], date: Date): string {
  const dateLabel = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const items = stories.map(
    (s, i) => `${i + 1}. ${s.title}\n${s.summary}\n(Kaynak: ${s.sources.slice(0, 3).join(", ")})`,
  );
  return [`Günün özeti · ${dateLabel}`, "", ...items.join("\n\n").split("\n"), "", "#gündem #haber #gününözeti"].join(
    "\n",
  );
}

async function main() {
  const now = new Date();
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
  const files = await renderSlides([digestHtml(stories, now)], outDir);

  const caption = buildCaption(stories, now);
  if (caption.length > 2200) console.warn(`  ! caption ${caption.length} karakter, Instagram sınırı 2200`);
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
