import { TwitterApi } from "twitter-api-v2";

/**
 * Platform clients shared by the evening digest (publish.ts) and Tarihte Bugün (publish-history.ts).
 * Instagram/Facebook: IG_USER_ID, IG_ACCESS_TOKEN (Facebook Page token), FB_PAGE_ID.
 * X: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.
 */

const env = process.env;
const graph = "https://graph.facebook.com/v23.0";

export const instagramConfigured = () => Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN);
export const facebookConfigured = () => Boolean(env.FB_PAGE_ID && env.IG_ACCESS_TOKEN);
export const xConfigured = () => Boolean(env.X_API_KEY && env.X_ACCESS_TOKEN);

/** Creates a media container, waits until processed, publishes it; returns the media id. */
export async function instagram(params: Record<string, string>) {
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

/** Photo post on the Facebook Page; returns the post id. */
export async function facebook(imageUrl: string, caption: string) {
  const params = new URLSearchParams({ url: imageUrl, message: caption });
  const res = await fetch(`${graph}/${env.FB_PAGE_ID}/photos?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.IG_ACCESS_TOKEN}` },
  });
  const body = (await res.json()) as { post_id?: string; id?: string; error?: { message: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  return body.post_id ?? body.id;
}

/** Video post on the Facebook Page from a public URL; returns the video id. */
export async function facebookVideo(videoUrl: string, description: string) {
  const params = new URLSearchParams({ file_url: videoUrl, description });
  const res = await fetch(`${graph}/${env.FB_PAGE_ID}/videos?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.IG_ACCESS_TOKEN}` },
  });
  const body = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
  return body.id;
}

export function xClient() {
  return new TwitterApi({
    appKey: env.X_API_KEY!,
    appSecret: env.X_API_SECRET!,
    accessToken: env.X_ACCESS_TOKEN!,
    accessSecret: env.X_ACCESS_SECRET!,
  });
}

/** Runs each configured platform independently (one failing doesn't block the others); exits 1 if any failed. */
export async function publishAll(platforms: [string, boolean, () => Promise<unknown>][]) {
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
