import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchCandidates, photoDataUri, pickHeuristic, pickWithClaude, type HistoryEvent } from "./onthisday.ts";
import { historyCardHtml, historyVideoHtml } from "./templates.ts";
import { historyCues, renderVideo } from "./video.ts";
import { renderSlides } from "./render.ts";

/**
 * Tarihte Bugün: one event from Turkish Wikipedia's "on this day" feed, as a photo card (01.jpg),
 * an animated 9:16 video for the story and Reels (video.mp4) and caption.txt, in out/history/<date>/.
 */

const forceHeuristic = process.argv.includes("--no-llm");

/** Istanbul calendar date (YYYY-MM-DD); the workflow passes EDITION_DATE so folder, labels and marker agree. */
function editionDate(): string {
  return process.env.EDITION_DATE ?? new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

function caption(e: HistoryEvent, date: Date): string {
  const day = date.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const tags = ["#tarihtebugün", "#tarih", "#biliyormuydun", "#ozetmanset", ...e.tags.map((t) => `#${t}`)];
  return [
    `📜 TARİHTE BUGÜN · ${day} ${e.year}`,
    e.title,
    e.detail,
    `👇 ${e.question} Yorumlara yaz.`,
    "(Kaynak: Vikipedi · Görsel: Wikimedia Commons)",
    `@ozetmanset · Her gün tarihte bugün, her akşam günün manşetleri\n${[...new Set(tags)].join(" ")}`,
  ].join("\n\n");
}

async function main() {
  const edition = editionDate();
  // Noon Istanbul (UTC+3, no DST) keeps the labels on the edition day in any local time zone.
  const date = new Date(`${edition}T12:00:00+03:00`);
  const outDir = path.join("out", "history", edition);

  console.log("Vikipedi: tarihte bugün…");
  const candidates = await fetchCandidates(date);
  console.log(`  ${candidates.length} fotoğraflı aday`);
  // history-picks.json: {"YYYY-MM-DD": "year or text"} pins the day's item (Claude still writes it).
  const picks = JSON.parse(await readFile("history-picks.json", "utf8").catch(() => "{}")) as Record<string, string>;
  const pick = picks[edition];
  const pinned = pick ? candidates.filter((c) => String(c.year) === pick || c.text.includes(pick)) : [];
  if (pick) console.log(pinned.length ? `  Seçili: ${pinned.map((c) => c.text).join(" | ")}` : `  ! "${pick}" adaylarda yok, normal seçim`);
  const pool = pinned.length ? pinned : candidates;
  const useClaude = !forceHeuristic && Boolean(process.env.ANTHROPIC_API_KEY);
  const event = useClaude ? await pickWithClaude(pool) : pickHeuristic(pool);
  console.log(`  ${event.year}: ${event.title}\n  ${event.detail}\n  ? ${event.question}\n  ${event.imageUrl}`);

  const photo = await photoDataUri(event.imageUrl);
  console.log("Render…");
  const files = await renderSlides([historyCardHtml(event, photo, date)], outDir);
  console.log("Video…");
  files.push(await renderVideo(historyVideoHtml(event, photo, date), path.join(outDir, "video.mp4"), historyCues()));

  await writeFile(path.join(outDir, "caption.txt"), caption(event, date));
  await writeFile(path.join(outDir, "event.json"), JSON.stringify(event, null, 2));
  console.log(`Bitti: ${files.map((f) => path.basename(f)).join(", ")} → ${outDir}/`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
