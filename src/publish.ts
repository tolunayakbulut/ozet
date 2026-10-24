import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { facebook, facebookConfigured, instagram, instagramConfigured, publishAll, xClient, xConfigured } from "./platforms.ts";
import type { Story } from "./select.ts";

/**
 * Publishes out/<date>/01.jpg to every platform whose env vars are set.
 * Platforms are independent: one failing doesn't block the others.
 *
 * Instagram: IG_USER_ID, IG_ACCESS_TOKEN (Facebook Page token), IMAGE_URL (public URL of the image),
 *            VIDEO_URL (optional, public URL of the 9:16 MP4 -> story + Reels)
 *            MANSET_URL (optional, public URL of 02.jpg -> separate "günün manşeti" post with manset.txt)
 * Facebook:  FB_PAGE_ID, IG_ACCESS_TOKEN (same Page token, needs pages_manage_posts), IMAGE_URL
 * X:         X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 *            X_REPLY_TO (optional): skip the image post and only add the detail thread under this tweet
 *            X_MODE (optional): "photo" | "video"; default alternates by ISO week (experiment)
 */

const env = process.env;
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const dir = path.join("out", date);

/** Header plus as many headlines as fit in 280 chars. */
function tweetText(stories: Story[], title: string): string {
  let text = title;
  for (const [i, s] of stories.entries()) {
    const line = `\n${i + 1}. ${s.title}`;
    if ((text + line).length > 270) break;
    text += line;
  }
  return text;
}

/** One reply per story: headline, detail and sources, kept under X's 280-char limit. */
function threadTexts(stories: Story[]): string[] {
  return stories.map((s, i) => {
    const head = `${i + 1}. ${s.title}`;
    const tail = `\nKaynak: ${s.sources.slice(0, 3).join(", ")}`;
    const room = 275 - head.length - tail.length - 1;
    const detail = s.summary.length <= room ? s.summary : s.summary.slice(0, s.summary.lastIndexOf(" ", room - 1)) + "…";
    return `${head}\n${detail}${tail}`;
  });
}

/** ISO-8601 week number of a YYYY-MM-DD date. */
function isoWeek(ymd: string): number {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * X experiment, alternating weekly: even weeks post the image, odd weeks the video; both get a
 * per-story detail thread. Logs {mode, id} to x.json for metrics.
 */
async function x(image: Buffer, stories: Story[], title: string) {
  const client = xClient();
  if (env.X_REPLY_TO) {
    let parent = env.X_REPLY_TO;
    for (const text of threadTexts(stories)) parent = (await client.v2.reply(text, parent)).data.id;
    return env.X_REPLY_TO;
  }

  const mode = env.X_MODE ?? (isoWeek(date) % 2 === 0 ? "photo" : "video");
  let root: string;
  if (mode === "video") {
    const video = await readFile(path.join(dir, "video.mp4"));
    const mediaId = await client.v2.uploadMedia(video, { media_type: "video/mp4", media_category: "tweet_video" });
    root = (await client.v2.tweet({ text: tweetText(stories, title), media: { media_ids: [mediaId] } })).data.id;
  } else {
    const mediaId = await client.v2.uploadMedia(image, { media_type: "image/jpeg", media_category: "tweet_image" });
    root = (await client.v2.tweet({ text: tweetText(stories, title), media: { media_ids: [mediaId] } })).data.id;
  }
  let parent = root;
  for (const text of threadTexts(stories)) parent = (await client.v2.reply(text, parent)).data.id;
  await writeFile(path.join(dir, "x.json"), JSON.stringify({ date, mode, id: root }) + "\n");
  return `${mode} ${root}`;
}

async function main() {
  const image = await readFile(path.join(dir, "01.jpg"));
  const caption = await readFile(path.join(dir, "caption.txt"), "utf8");
  const stories = JSON.parse(await readFile(path.join(dir, "stories.json"), "utf8")) as Story[];
  const title = caption.split("\n")[0];
  const mansetCaption = await readFile(path.join(dir, "manset.txt"), "utf8").catch(() => "");

  const platforms: [string, boolean, () => Promise<unknown>][] = [
    ["Instagram", instagramConfigured() && Boolean(env.IMAGE_URL), () => instagram({ image_url: env.IMAGE_URL!, caption })],
    [
      "Instagram manşet",
      instagramConfigured() && Boolean(env.MANSET_URL && mansetCaption),
      // Posted after the list so it sits on top of the profile grid.
      () => instagram({ image_url: env.MANSET_URL!, caption: mansetCaption }),
    ],
    [
      "Instagram hikâye",
      instagramConfigured() && Boolean(env.VIDEO_URL),
      () => instagram({ video_url: env.VIDEO_URL!, media_type: "STORIES" }),
    ],
    [
      "Instagram Reels",
      instagramConfigured() && Boolean(env.VIDEO_URL),
      // share_to_feed=false keeps the profile grid to the daily image posts.
      // thumb_offset (ms) picks a cover frame where the full list is on screen, not the dark intro.
      () =>
        instagram({ video_url: env.VIDEO_URL!, media_type: "REELS", caption, share_to_feed: "false", thumb_offset: "12000" }),
    ],
    ["Facebook", facebookConfigured() && Boolean(env.IMAGE_URL), () => facebook(env.IMAGE_URL!, caption)],
    ["X", xConfigured(), () => x(image, stories, title)],
  ];

  await publishAll(platforms);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
