import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Article } from "./fetch.ts";
import type { Category } from "./feeds.ts";

export interface Story {
  title: string;
  summary: string;
  category: Category;
  sources: string[];
  link: string;
  image?: string;
}

interface Cluster {
  articles: Article[];
  tokens: Set<string>;
  score: number;
}

const STOPWORDS = new Set(
  "ve ile için bir bu da de ki mi mı mu mü ne çok daha en gibi olan oldu olarak sonra önce yeni son dakika şu o ya veya ama fakat ancak her tüm kadar göre üzere ilk iki üç var yok".split(" "),
);

const CATEGORY_KEYWORDS: [Category, RegExp][] = [
  ["spor", /(?<!\p{L})(maç|gol|lig|futbol|basketbol|voleybol|galatasaray|fenerbahçe|beşiktaş|trabzonspor|milli takım|şampiyon|teknik direktör|transfer)/iu],
  ["ekonomi", /(?<!\p{L})(dolar|euro|faiz|enflasyon|borsa|bist|merkez bankası|ihracat|ithalat|piyasa|asgari ücret|vergi|altın|büyüme|tcmb)/iu],
  ["teknoloji", /(?<!\p{L})(yapay zeka|teknoloji|uzay|nasa|apple|google|yazılım|siber|uydu|robot|bilim)/iu],
  ["dunya", /(?<!\p{L})(abd|trump|rusya|ukrayna|israil|gazze|iran|çin|avrupa|nato|bm|almanya|fransa|ingiltere|suriye)/iu],
];

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase("tr")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
      // Crude Turkish stemming: suffixes vary, first 5 letters mostly stable.
      .map((w) => w.slice(0, 5)),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export function cluster(articles: Article[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const a of [...articles].sort((x, y) => y.publishedAt.getTime() - x.publishedAt.getTime())) {
    const t = tokens(a.title);
    if (t.size === 0) continue;
    const match = clusters.find((c) => {
      const n = overlap(t, c.tokens);
      return n >= 2 && n / Math.min(t.size, c.tokens.size) >= 0.5;
    });
    if (match) {
      match.articles.push(a);
      for (const x of t) match.tokens.add(x);
    } else {
      clusters.push({ articles: [a], tokens: t, score: 0 });
    }
  }
  const now = Date.now();
  for (const c of clusters) {
    const sources = new Set(c.articles.map((a) => a.source)).size;
    const newest = Math.max(...c.articles.map((a) => a.publishedAt.getTime()));
    const ageHours = (now - newest) / 3600_000;
    c.score = sources * 3 + c.articles.length + Math.max(0, 2 - ageHours / 12);
  }
  return clusters.sort((a, b) => b.score - a.score);
}

function categoryOf(c: Cluster): Category {
  const counts = new Map<Category, number>();
  for (const a of c.articles) if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  const text = c.articles.map((a) => a.title).join(" ");
  return CATEGORY_KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "gundem";
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = cut.lastIndexOf(". ");
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function representative(c: Cluster): Article {
  return [...c.articles].sort((a, b) => b.summary.length - a.summary.length)[0];
}

function toStory(c: Cluster, category = categoryOf(c)): Omit<Story, "title" | "summary"> {
  return {
    category,
    sources: [...new Set(c.articles.map((a) => a.source))],
    link: representative(c).link,
    image: c.articles.find((a) => a.image)?.image,
  };
}

/** No-LLM fallback: rank clusters by source count, cap per category. */
export function selectHeuristic(articles: Article[], count: number): Story[] {
  const perCategoryCap = Math.ceil(count / 3);
  const used = new Map<Category, number>();
  const out: Story[] = [];
  for (const c of cluster(articles)) {
    if (out.length >= count) break;
    const cat = categoryOf(c);
    if ((used.get(cat) ?? 0) >= perCategoryCap) continue;
    used.set(cat, (used.get(cat) ?? 0) + 1);
    const rep = representative(c);
    out.push({
      ...toStory(c, cat),
      title: shorten(rep.title, 90),
      summary: shorten(rep.summary || rep.title, 180),
    });
  }
  return out;
}

const Selection = z.object({
  stories: z.array(
    z.object({
      cluster_id: z.number().int(),
      category: z.enum(["gundem", "ekonomi", "dunya", "spor", "teknoloji"]),
      title: z.string(),
      summary: z.string(),
    }),
  ),
});

const SYSTEM = `Türkçe bir günlük haber özeti bülteninin editörüsün.
Sana son 24 saatin haberleri, aynı olayı anlatanlar kümelenmiş halde veriliyor. Her kümede kaç farklı kaynağın haberi verdiği yazıyor; çok kaynak genelde daha önemli demek.
Görevin:
- Günün en önemli olaylarını seç. Kategori çeşitliliği gözet (gündem, ekonomi, dünya, spor, teknoloji) ama önemi feda etme.
- Magazin, reklam, burç, tekrar eden rutin duyuruları seçme.
- Her olay için:
  - title: olayı tek başına anlatan, bilgi veren tek cümle (en fazla 90 karakter). Okuyan sadece bunu okuyup ne olduğunu anlamalı. Örnek: "FIFA, Fenerbahçe'ye üç dönem transfer yasağı verdi". Tık tuzağı, soru, alıntı başlığı yok.
  - summary: başlıkta olmayan en önemli ek bilgiyi veren 1-2 cümle (en fazla 180 karakter).
- Sadece verilen metne dayan. Metinde olmayan isim, sayı, tarih ekleme. Kendi cümlelerinle yaz, kaynak metni kopyalama.
- Tarafsız ve sade dil kullan; yorum ekleme.
- İlk sıradaki haber günün manşeti olacak.`;

export async function selectWithClaude(articles: Article[], count: number): Promise<Story[]> {
  const clusters = cluster(articles).slice(0, 80);
  const input = clusters
    .map((c, i) => {
      const sources = [...new Set(c.articles.map((a) => a.source))];
      const lines = c.articles
        .slice(0, 4)
        .map((a) => `  - [${a.source}] ${a.title} — ${a.summary.slice(0, 400)}`)
        .join("\n");
      return `#${i} (${sources.length} kaynak: ${sources.join(", ")})\n${lines}`;
    })
    .join("\n\n");

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Haber kümeleri:\n\n${input}\n\nEn önemli ${count} olayı önem sırasına göre seç.`,
      },
    ],
    output_config: { format: zodOutputFormat(Selection) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`Claude çıktısı parse edilemedi (stop_reason: ${response.stop_reason})`);

  return parsed.stories
    .filter((s) => clusters[s.cluster_id])
    .slice(0, count)
    .map((s) => ({
      ...toStory(clusters[s.cluster_id], s.category),
      title: s.title,
      summary: s.summary,
    }));
}
