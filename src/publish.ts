import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TwitterApi } from "twitter-api-v2";
import type { Story } from "./select.ts";

/**
 * Publishes out/<date>/01.jpg to every platform whose env vars are set.
 * Platforms are independent: one failing doesn't block the others.
 *
 * Instagram: IG_USER_ID, IG_ACCESS_TOKEN (Facebook Page token), IMAGE_URL (public URL of the image),
 *            VIDEO_URL (optional, public URL of the 9:16 MP4 -> story + Reels)
 * Facebook:  FB_PAGE_ID, IG_ACCESS_TOKEN (same Page token, needs pages_manage_posts), IMAGE_URL
 * X:         X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 *            X_REPLY_TO (optional): skip the image post and only add the detail thread under this tweet
 *            X_MODE (optional): "photo" | "video"; default alternates by ISO week (experiment)
 */

const env = process.env;
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const dir = path.join("out", date);

/** Creates a media container, waits until processed, publishes it; returns the media id. */
async function instagram(params: Record<string, string>) {
  const graph = "https://graph.facebook.com/v23.0";
  const api = `${graph}/${env.IG_USER_ID}`;
  const call = async (url: string, method = "POST") => {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}access_token=${env.IG_ACCESS_TOKEN}`, { method });
    const body = (await res.json()) as { id?: string; status_code?: string; error?: { message: string } };
    if (!res.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    return body;
  };
  const container = await call(`${api}/media?${new URLSearchParams(params)}`);
  // Videos take longer to process than images.
  for (let i = 0; i < 60; i++) {
    const { status_code } = await call(`${graph}/${container.id}?fields=status_code`, "GET");
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`container ${status_code}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  const post = await call(`${api}/media_publish?creation_id=${container.id}`);
  return post.id;
}

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

/** Photo post on the Facebook Page; returns the post id. */
async function facebook(caption: string) {
  const params = new URLSearchParams({ url: env.IMAGE_URL!, message: caption });
  const res = await fetch(`https://graph.facebook.com/v23.0/${env.FB_PAGE_ID}/photos?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.IG_ACCESS_TOKEN}` },
  });
  const body = (await res.json()) as { post_id?: string; id?: string; error?: { message: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  return body.post_id ?? body.id;
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
 * X experiment, alternating weekly: even weeks post the image plus a per-story detail thread,
 * odd weeks post the video plus one reply with sources. Logs {mode, id} to x.json for metrics.
 */
async function x(image: Buffer, stories: Story[], title: string) {
  const client = new TwitterApi({
    appKey: env.X_API_KEY!,
    appSecret: env.X_API_SECRET!,
    accessToken: env.X_ACCESS_TOKEN!,
    accessSecret: env.X_ACCESS_SECRET!,
  });
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
    const sources = [...new Set(stories.flatMap((s) => s.sources))].join(", ");
    await client.v2.reply(`Kaynaklar: ${sources}\nHer akşam 20:00'de günün manşetleri · @ozetmanset`.slice(0, 280), root);
  } else {
    const mediaId = await client.v2.uploadMedia(image, { media_type: "image/jpeg", media_category: "tweet_image" });
    root = (await client.v2.tweet({ text: tweetText(stories, title), media: { media_ids: [mediaId] } })).data.id;
    let parent = root;
    for (const text of threadTexts(stories)) parent = (await client.v2.reply(text, parent)).data.id;
  }
  await writeFile(path.join(dir, "x.json"), JSON.stringify({ date, mode, id: root }) + "\n");
  return `${mode} ${root}`;
}

async function main() {
  const image = await readFile(path.join(dir, "01.jpg"));
  const caption = await readFile(path.join(dir, "caption.txt"), "utf8");
  const stories = JSON.parse(await readFile(path.join(dir, "stories.json"), "utf8")) as Story[];
  const title = caption.split("\n")[0];

  const platforms: [string, boolean, () => Promise<unknown>][] = [
    ["Instagram", Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN && env.IMAGE_URL), () => instagram({ image_url: env.IMAGE_URL!, caption })],
    [
      "Instagram hikâye",
      Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN && env.VIDEO_URL),
      () => instagram({ video_url: env.VIDEO_URL!, media_type: "STORIES" }),
    ],
    [
      "Instagram Reels",
      Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN && env.VIDEO_URL),
      // share_to_feed=false keeps the profile grid to the daily image posts.
      // thumb_offset (ms) picks a cover frame where the full list is on screen, not the dark intro.
      () =>
        instagram({ video_url: env.VIDEO_URL!, media_type: "REELS", caption, share_to_feed: "false", thumb_offset: "12000" }),
    ],
    ["Facebook", Boolean(env.FB_PAGE_ID && env.IG_ACCESS_TOKEN && env.IMAGE_URL), () => facebook(caption)],
    ["X", Boolean(env.X_API_KEY && env.X_ACCESS_TOKEN), () => x(image, stories, title)],
  ];

  let failed = false;
  for (const [name, configured, run] of platforms) {
    if (!configured) {
      console.log(`- ${name}: ayarlı değil, atlandı`);
      continue;
    }
    try {
      const id = await run();
      console.log(`✓ ${name}${id ? ` (${id})` : ""}`);
    } catch (err) {
      failed = true;
      console.error(`✗ ${name}: ${(err as Error).message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
