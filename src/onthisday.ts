import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** One Tarihte Bugün post: a single event from Turkish Wikipedia's "on this day" feed. */
export interface HistoryEvent {
  year: number;
  title: string;
  highlight?: string;
  detail: string;
  question: string;
  tags: string[];
  imageUrl: string;
  page: string;
}

interface Candidate {
  kind: "olay" | "doğum" | "ölüm";
  year: number;
  text: string;
  extract: string;
  imageUrl: string;
  page: string;
}

const UA = "OzetManset/1.0 (https://github.com/tolunayakbulut/ozet)";
const THUMB_WIDTH = 1280;

interface FeedPage {
  title: string;
  extract?: string;
  originalimage?: { source: string; width: number };
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}
interface FeedItem {
  text: string;
  year: number;
  pages?: FeedPage[];
}

/**
 * A photo URL around THUMB_WIDTH wide. Only freely licensed Commons files count: local uploads on
 * tr.wikipedia are often non-free (screenshots, posters). SVGs (maps, flags, logos) look bad full-bleed.
 */
function photoUrl(p: FeedPage): string | undefined {
  const orig = p.originalimage;
  if (!orig) return undefined;
  const file = new URL(orig.source).pathname;
  if (!file.includes("/wikipedia/commons/") || /\.svg$/i.test(file)) return undefined;
  if (orig.width <= THUMB_WIDTH || !p.thumbnail) return orig.source;
  return p.thumbnail.source.replace(/\/\d+px-/, `/${THUMB_WIDTH}px-`);
}

/** Events, births and deaths for the day that have a photo, from Turkish Wikipedia. */
export async function fetchCandidates(date: Date): Promise<Candidate[]> {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/tr/onthisday/all/${mm}/${dd}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Vikipedi HTTP ${res.status}`);
  const feed = (await res.json()) as Record<string, FeedItem[] | undefined>;
  const kinds: [string, Candidate["kind"]][] = [
    ["selected", "olay"],
    ["events", "olay"],
    ["births", "doğum"],
    ["deaths", "ölüm"],
  ];
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const [key, kind] of kinds) {
    for (const item of feed[key] ?? []) {
      if (seen.has(item.text)) continue;
      seen.add(item.text);
      // The first linked page is usually the subject; year pages ("1945") carry no useful photo.
      const page = item.pages?.find((p) => !/^\d+$/.test(p.title) && photoUrl(p));
      if (!page) continue;
      out.push({
        kind,
        year: item.year,
        text: item.text,
        extract: page.extract ?? "",
        imageUrl: photoUrl(page)!,
        page: page.content_urls?.desktop?.page ?? `https://tr.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      });
    }
  }
  return out;
}

/** The photo as a data URI, so rendering doesn't depend on Wikimedia hotlinking. */
export async function photoDataUri(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fotoğraf HTTP ${res.status}: ${url}`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

const trim = (s: string, max: number) => (s.length <= max ? s : s.slice(0, s.lastIndexOf(" ", max - 1)) + "…");

/** No LLM: the first "selected" event (Wikipedia's own pick), its text as the title, page extract as detail. */
export function pickHeuristic(candidates: Candidate[]): HistoryEvent {
  const c = candidates.find((c) => c.kind === "olay") ?? candidates[0];
  if (!c) throw new Error("fotoğraflı aday yok");
  return {
    year: c.year,
    title: trim(c.text, 110),
    detail: trim(c.extract, 260),
    question: "Bu olayı biliyor muydun?",
    tags: [],
    imageUrl: c.imageUrl,
    page: c.page,
  };
}

/** Numbers in generated text that appear nowhere in the candidate's source text (hallucination guard). */
function unsupportedNumbers(text: string, c: Candidate): string[] {
  const source = `${c.year} ${c.text} ${c.extract}`.replace(/\s/g, "");
  return [...new Set(text.match(/\d+(?:[.,]\d+)*/g) ?? [])].filter((n) => !source.includes(n));
}

const Pick = z.object({
  id: z.number().int(),
  title: z.string(),
  detail: z.string(),
  question: z.string(),
  tags: z.array(z.string()),
});

const SYSTEM = `Türkçe bir haber hesabının "Tarihte Bugün" serisinin editörüsün. Her gün tek bir olay paylaşılıyor: büyük bir fotoğraf, yıl, kısa başlık ve 2-3 cümlelik detay.
Sana Vikipedi'den bugünün tarihine ait olaylar, doğumlar ve ölümler veriliyor; hepsinin fotoğrafı var.
Görevin:
- Türkiye'deki geniş bir kitlenin en çok ilgisini çekecek, paylaşmak ve yorum yapmak isteyeceği TEK maddeyi seç. Takipçiler Türkiye gündemini takip eden bir haber hesabının takipçileri: Türkiye'nin kendi tarihinden, bugünle karşılaştırılabilen, "vay be" dedirten maddeleri seç (ilk kez/son kez olanlar, rekorlar, nüfus, ekonomi, sevilen isimler, spor).
- Yabancı sanat, klasik müzik ve uzak ülkelerin iç olayları gibi takipçinin kendini ilişkilendiremeyeceği maddeleri seçme.
- Herkesin bildiği olayları ve çok tanınmış kişileri tercih et. Az bilinen futbolcu, bürokrat ya da yerel siyasetçi doğum/ölümlerini seçme.
- Bugün Türkiye'de siyasi kutuplaşma ya da etnik/dini tartışma yaratacak konuları (hâlâ siyasette olan kişiler ve partiler dahil), terör saldırılarını ve çok can kaybına yol açan felaketleri seçme.
- Görsel paylaşım olduğu için fotoğraf olayın kendisini ya da kişiyi göstermeli. "Foto" satırındaki dosya adına bak: olayla ilgisiz ya da sıkıcı fotoğrafı (bina, harita, bayrak, logo, genel manzara) olan maddeyi seçme.
- id: seçtiğin maddenin numarası.
- title: olayı tek başına anlatan tek cümle (en fazla 80 karakter). En önemli kısmını köşeli parantezle işaretle: tam bir çift, EN FAZLA 3 kelime. Örnek: "Birleşmiş Milletler [resmen kuruldu]". Yılı başlığa yazma, ayrıca gösteriliyor.
- detail: başlıkta olmayan ilginç bilgiyi veren 2-3 cümle (en fazla 260 karakter). Okuyan "bunu bilmiyordum" demeli. Uygunsa bugünle bağ kur, ama yalnızca metinde olan bilgiyle.
- question: takipçiyi yorum yapmaya davet eden kısa, merak uyandıran, herkesin cevap verebileceği bir soru (en fazla 70 karakter). Kolay ve eğlenceli olsun, bugünle karşılaştırmaya davet etsin. Örnek: "Sence bugün nüfusumuz kaç?", "Concorde'a binmek ister miydin?". Siyasi ya da ideolojik görüş sorma, kişinin kendisine siyasetçi gibi davranma.
- tags: konuya özgü 2-3 Türkçe hashtag, # olmadan, boşluksuz, küçük harf. Örnek: ["uzay", "nasa"].
- Yalnızca maddenin metnine ve özetine dayanarak yaz. Metinde olmayan isim, sayı, tarih ekleme. Kendi cümlelerinle yaz, kopyalama. Tarafsız ve sade dil kullan.`;

/** "A [B] C" -> title "A B C", highlight "B". Missing/odd brackets -> no highlight. */
function splitHighlight(raw: string): { title: string; highlight?: string } {
  const m = raw.match(/^([^\[\]]*)\[([^\[\]]+)\]([^\[\]]*)$/);
  if (!m) return { title: raw.replace(/[\[\]]/g, "") };
  return { title: m[1] + m[2] + m[3], highlight: m[2].trim().split(/\s+/).length <= 4 ? m[2] : undefined };
}

/** Commons file name without size prefix and extension, e.g. "Aerial Microsoft West Campus August 2009". */
function photoName(url: string): string {
  const file = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  return file.replace(/^\d+px-/, "").replace(/\.\w+$/, "").replace(/_/g, " ");
}

/** Mentions of Turkey, the Ottomans, Turkish cities, people or clubs in the item or the start of its page summary. */
const TURKEY = /Türk|Osmanlı|Anadolu|İstanbul|Ankara|İzmir|Atatürk|Cumhuriyet|TBMM|Galatasaray|Fenerbahçe|Beşiktaş|Trabzonspor/;

/** Turkey-related candidates only (also keeps the prompt small); everything if a day has too few. */
export function turkeyFirst(candidates: Candidate[]): Candidate[] {
  const tr = candidates.filter((c) => TURKEY.test(`${c.text} ${c.extract.slice(0, 150)}`));
  return tr.length >= 3 || tr.length === candidates.length ? tr : candidates;
}

export async function pickWithClaude(all: Candidate[]): Promise<HistoryEvent> {
  const candidates = turkeyFirst(all);
  const input = candidates
    .map((c, i) => `#${i} [${c.kind}, ${c.year}] ${c.text}\n   Foto: ${photoName(c.imageUrl)}${c.extract ? `\n   Özet: ${trim(c.extract, c.kind === "olay" ? 250 : 110)}` : ""}`)
    .join("\n");
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 800,
    system: SYSTEM,
    messages: [{ role: "user", content: `Bugünün maddeleri:\n\n${input}\n\nTek maddeyi seç ve yaz.` }],
    output_config: { format: zodOutputFormat(Pick) },
  });
  const { input_tokens, output_tokens } = response.usage;
  console.log(`  Claude: ${input_tokens} girdi + ${output_tokens} çıktı token (~$${((input_tokens + output_tokens * 5) / 1e6).toFixed(4)})`);
  const p = response.parsed_output;
  const c = p && candidates[p.id];
  if (!p || !c) throw new Error(`Claude çıktısı geçersiz (stop_reason: ${response.stop_reason})`);

  const badTitle = unsupportedNumbers(p.title, c);
  if (badTitle.length) console.warn(`  ! BAŞLIK kontrol edilmeli: "${p.title}" (kaynakta yok: ${badTitle.join(", ")})`);
  // A sentence ends before a capital letter; "20. yüzyıl" style ordinals don't split.
  const sentences = p.detail.split(/(?<=[.!?])\s+(?=\p{Lu})/u);
  const kept = sentences.filter((s) => {
    const bad = unsupportedNumbers(s, c);
    if (bad.length) console.warn(`  ! detaydan cümle silindi (kaynakta yok: ${bad.join(", ")}): ${s.trim()}`);
    return bad.length === 0;
  });
  return {
    year: c.year,
    ...splitHighlight(p.title),
    detail: kept.join(" ").trim() || trim(c.extract, 260),
    question: unsupportedNumbers(p.question, c).length ? "Bu olayı biliyor muydun?" : p.question,
    tags: p.tags.map((t) => t.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("tr-TR")).filter(Boolean).slice(0, 3),
    imageUrl: c.imageUrl,
    page: c.page,
  };
}
