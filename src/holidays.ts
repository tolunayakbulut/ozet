/**
 * Milli bayramlar ve Atatürk'ü anma günü. O gün Tarihte Bugün bayramın kendi olayını seçer (pick: yıl),
 * Tarihte Bugün ve akşam manşeti kutlama satırıyla açılır. {n}: since'ten bu yana kaçıncı yıl.
 */
interface Holiday {
  pick: string;
  since: number;
  greeting: string;
  tags: string[];
}

const HOLIDAYS: Record<string, Holiday> = {
  "04-23": {
    pick: "1920",
    since: 1920,
    greeting: "🇹🇷 23 Nisan Ulusal Egemenlik ve Çocuk Bayramımız kutlu olsun! Türkiye Büyük Millet Meclisi {n} yaşında.",
    tags: ["23nisan", "ulusalegemenlikveçocukbayramı"],
  },
  "05-19": {
    pick: "1919",
    since: 1919,
    greeting: "🇹🇷 19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramımız kutlu olsun! Kurtuluş'un ilk adımının {n}. yılı.",
    tags: ["19mayıs", "gençlikvesporbayramı"],
  },
  "08-30": {
    pick: "1922",
    since: 1922,
    greeting: "🇹🇷 30 Ağustos Zafer Bayramımız kutlu olsun! Büyük Zafer'in {n}. yılı.",
    tags: ["30ağustos", "zaferbayramı"],
  },
  "10-29": {
    pick: "1923",
    since: 1923,
    greeting: "🇹🇷 29 Ekim Cumhuriyet Bayramımız kutlu olsun! Cumhuriyetimiz {n} yaşında.",
    tags: ["29ekim", "cumhuriyetbayramı"],
  },
  "11-10": {
    pick: "1938",
    since: 1938,
    greeting: "🖤 Cumhuriyetimizin kurucusu Gazi Mustafa Kemal Atatürk'ü aramızdan ayrılışının {n}. yılında saygı, minnet ve özlemle anıyoruz.",
    tags: ["10kasım", "atatürk"],
  },
};

/** Holiday on an Istanbul calendar date (YYYY-MM-DD), greeting filled in; undefined on ordinary days. */
export function holiday(date: string): (Holiday & { greeting: string }) | undefined {
  const h = HOLIDAYS[date.slice(5)];
  return h && { ...h, greeting: h.greeting.replace("{n}", String(Number(date.slice(0, 4)) - h.since)) };
}
