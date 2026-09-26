import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TwitterApi } from "twitter-api-v2";

/**
 * X experiment metrics. Each day publish.ts logs {date, mode, id} to <dir>/<date>.json.
 * This fills in public metrics for posts at least a day old (once), then prints averages per mode.
 * Usage: node --import tsx src/x-metrics.ts <dir>
 */

interface Entry {
  date: string;
  mode: "photo" | "video";
  id: string;
  metrics?: { impression_count?: number; like_count: number; retweet_count: number; reply_count: number; bookmark_count?: number };
}

const dir = process.argv[2] ?? "data/x";
const env = process.env;
const today = new Date().toISOString().slice(0, 10);

const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".json"));
const entries = await Promise.all(
  files.map(async (f) => ({ file: path.join(dir, f), entry: JSON.parse(await readFile(path.join(dir, f), "utf8")) as Entry })),
);

const pending = entries.filter(({ entry }) => !entry.metrics && entry.date < today);
if (pending.length) {
  const client = new TwitterApi({
    appKey: env.X_API_KEY!,
    appSecret: env.X_API_SECRET!,
    accessToken: env.X_ACCESS_TOKEN!,
    accessSecret: env.X_ACCESS_SECRET!,
  });
  const res = await client.v2.tweets(
    pending.map((p) => p.entry.id),
    { "tweet.fields": ["public_metrics"] },
  );
  for (const t of res.data ?? []) {
    const p = pending.find((x) => x.entry.id === t.id);
    if (!p || !t.public_metrics) continue;
    p.entry.metrics = t.public_metrics;
    await writeFile(p.file, JSON.stringify(p.entry) + "\n");
  }
}

for (const mode of ["photo", "video"] as const) {
  const done = entries.filter(({ entry }) => entry.mode === mode && entry.metrics);
  if (!done.length) continue;
  const avg = (k: "impression_count" | "like_count" | "retweet_count") =>
    Math.round(done.reduce((a, { entry }) => a + (entry.metrics![k] ?? 0), 0) / done.length);
  console.log(
    `${mode}: ${done.length} gün, ort. gösterim ${avg("impression_count")}, beğeni ${avg("like_count")}, RT ${avg("retweet_count")}`,
  );
}
process.exit(0);
