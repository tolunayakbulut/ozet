import { readFile } from "node:fs/promises";
import path from "node:path";
import { TwitterApi } from "twitter-api-v2";
import type { Story } from "./select.ts";

/**
 * Publishes out/<date>/01.jpg to every platform whose env vars are set.
 * Platforms are independent: one failing doesn't block the others.
 *
 * Instagram: IG_USER_ID, IG_ACCESS_TOKEN (Facebook Page token), IMAGE_URL (public URL of the image),
 *            STORY_URL (optional, public URL of the 9:16 story image)
 * Telegram:  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (e.g. @kanaladi; bot must be channel admin)
 * X:         X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
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
  for (let i = 0; i < 20; i++) {
    const { status_code } = await call(`${graph}/${container.id}?fields=status_code`, "GET");
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`container ${status_code}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  const post = await call(`${api}/media_publish?creation_id=${container.id}`);
  return post.id;
}

async function telegram(image: Buffer, caption: string, title: string) {
  const api = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const form = new FormData();
  form.append("chat_id", env.TELEGRAM_CHAT_ID!);
  form.append("photo", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "ozet.jpg");
  form.append("caption", title);
  const send = async (method: string, body: FormData | string) => {
    const res = await fetch(`${api}/${method}`, {
      method: "POST",
      body,
      headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) throw new Error(json.description);
  };
  await send("sendPhoto", form);
  // Photo captions max 1024 chars; details go in a follow-up message (max 4096).
  await send("sendMessage", JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: caption }));
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

async function x(image: Buffer, stories: Story[], title: string) {
  const client = new TwitterApi({
    appKey: env.X_API_KEY!,
    appSecret: env.X_API_SECRET!,
    accessToken: env.X_ACCESS_TOKEN!,
    accessSecret: env.X_ACCESS_SECRET!,
  });
  const mediaId = await client.v2.uploadMedia(image, { media_type: "image/jpeg", media_category: "tweet_image" });
  const tweet = await client.v2.tweet({ text: tweetText(stories, title), media: { media_ids: [mediaId] } });
  return tweet.data.id;
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
      Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN && env.STORY_URL),
      () => instagram({ image_url: env.STORY_URL!, media_type: "STORIES" }),
    ],
    ["Telegram", Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), () => telegram(image, caption, title)],
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
