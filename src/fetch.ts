import Parser from "rss-parser";
import { FEEDS, type Category, type Feed } from "./feeds.ts";

export interface Article {
  source: string;
  category?: Category;
  title: string;
  summary: string;
  link: string;
  image?: string;
  publishedAt: Date;
}

type Item = Parser.Item & {
  mediaContent?: { $?: { url?: string } };
  mediaThumbnail?: { $?: { url?: string } };
};

const parser: Parser<{}, Item> = new Parser({
  timeout: 20_000,
  headers: { "User-Agent": "Mozilla/5.0 (ozet-bot)" },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImage(item: Item): string | undefined {
  return (
    item.enclosure?.url ||
    item.mediaContent?.$?.url ||
    item.mediaThumbnail?.$?.url ||
    item.content?.match(/<img[^>]+src="([^"]+)"/)?.[1]
  );
}

async function fetchFeed(feed: Feed, attempts = 3): Promise<Article[]> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.flatMap((item) => {
        if (!item.title || !item.link) return [];
        const date = new Date(item.isoDate ?? item.pubDate ?? Date.now());
        return [
          {
            source: feed.source,
            category: feed.category,
            title: stripHtml(item.title),
            summary: stripHtml(item.contentSnippet || item.content || item.summary || ""),
            link: item.link,
            image: pickImage(item),
            publishedAt: isNaN(date.getTime()) ? new Date() : date,
          },
        ];
      });
    } catch (err) {
      if (i === attempts) {
        console.warn(`  ! ${feed.source} (${feed.url}): ${(err as Error).message}`);
        return [];
      }
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
  return [];
}

export async function fetchAll(hours = 24): Promise<Article[]> {
  const cutoff = Date.now() - hours * 3600_000;
  const results = await Promise.all(FEEDS.map((f) => fetchFeed(f)));
  const seen = new Set<string>();
  return results
    .flat()
    .filter((a) => a.publishedAt.getTime() >= cutoff)
    .filter((a) => (seen.has(a.link) ? false : (seen.add(a.link), true)));
}
