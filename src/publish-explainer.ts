import { readFile } from "node:fs/promises";
import path from "node:path";
import { facebookConfigured, facebookVideo, instagram, instagramConfigured, publishAll, xClient, xConfigured } from "./platforms.ts";

/**
 * Publishes out/explainers/<slug>/ (Özet Anlatıyor) to every platform whose env vars are set:
 * Instagram Reels (also on the grid) and story, Facebook Page video (VIDEO_URL, a public URL), X video.
 * Usage: VIDEO_URL=... npm run publish-explainer -- <slug> "<tweet text>"
 */

const env = process.env;
const [slug, tweet] = process.argv.slice(2);
if (!slug || !tweet) throw new Error('usage: publish-explainer <slug> "<tweet text>"');
const dir = path.join("out", "explainers", slug);

async function x(video: Buffer) {
  const client = xClient();
  const mediaId = await client.v2.uploadMedia(video, { media_type: "video/mp4", media_category: "tweet_video" });
  return (await client.v2.tweet({ text: tweet, media: { media_ids: [mediaId] } })).data.id;
}

async function main() {
  const video = await readFile(path.join(dir, "video.mp4"));
  const caption = await readFile(path.join(dir, "caption.txt"), "utf8");
  const url = env.VIDEO_URL;

  await publishAll([
    // Cover frame: the intro title card.
    ["Instagram Reels", instagramConfigured() && Boolean(url), () => instagram({ video_url: url!, media_type: "REELS", caption, thumb_offset: "1500" })],
    ["Instagram hikâye", instagramConfigured() && Boolean(url), () => instagram({ video_url: url!, media_type: "STORIES" })],
    ["Facebook", facebookConfigured() && Boolean(url), () => facebookVideo(url!, caption)],
    ["X", xConfigured(), () => x(video)],
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
