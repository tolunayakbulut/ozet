import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HistoryEvent } from "./onthisday.ts";
import { facebook, facebookConfigured, instagram, instagramConfigured, publishAll, xClient, xConfigured } from "./platforms.ts";

/**
 * Publishes out/history/<date>/ (Tarihte Bugün) to every platform whose env vars are set:
 * Instagram post (IMAGE_URL), story and Reels (VIDEO_URL), Facebook Page, X. See platforms.ts for credentials.
 */

const env = process.env;
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const dir = path.join("out", "history", date);

function tweetText(e: HistoryEvent): string {
  const day = new Date(`${date}T12:00:00+03:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const head = `📜 Tarihte bugün, ${day} ${e.year}: ${e.title}`;
  const tail = "\n\n#tarihtebugün";
  const room = 275 - head.length - tail.length - 2;
  const detail = e.detail.length <= room ? e.detail : e.detail.slice(0, e.detail.lastIndexOf(" ", room - 1)) + "…";
  return room > 40 ? `${head}\n\n${detail}${tail}` : `${head}${tail}`;
}

async function x(image: Buffer, e: HistoryEvent) {
  const client = xClient();
  const mediaId = await client.v2.uploadMedia(image, { media_type: "image/jpeg", media_category: "tweet_image" });
  return (await client.v2.tweet({ text: tweetText(e), media: { media_ids: [mediaId] } })).data.id;
}

async function main() {
  const image = await readFile(path.join(dir, "01.jpg"));
  const caption = await readFile(path.join(dir, "caption.txt"), "utf8");
  const event = JSON.parse(await readFile(path.join(dir, "event.json"), "utf8")) as HistoryEvent;

  await publishAll([
    ["Instagram", instagramConfigured() && Boolean(env.IMAGE_URL), () => instagram({ image_url: env.IMAGE_URL!, caption })],
    [
      "Instagram hikâye",
      instagramConfigured() && Boolean(env.VIDEO_URL),
      () => instagram({ video_url: env.VIDEO_URL!, media_type: "STORIES" }),
    ],
    [
      "Instagram Reels",
      instagramConfigured() && Boolean(env.VIDEO_URL),
      // share_to_feed=false: the grid already has the photo post. Cover frame: question on screen.
      () => instagram({ video_url: env.VIDEO_URL!, media_type: "REELS", caption, share_to_feed: "false", thumb_offset: "9000" }),
    ],
    ["Facebook", facebookConfigured() && Boolean(env.IMAGE_URL), () => facebook(env.IMAGE_URL!, caption)],
    ["X", xConfigured(), () => x(image, event)],
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
