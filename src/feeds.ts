export type Category = "gundem" | "ekonomi" | "dunya" | "spor" | "teknoloji";

export interface Feed {
  source: string;
  url: string;
  // Category hint for single-topic feeds; undefined for mixed feeds.
  category?: Category;
}

export const FEEDS: Feed[] = [
  { source: "AA", url: "https://www.aa.com.tr/tr/rss/default?cat=guncel", category: "gundem" },
  { source: "AA", url: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi", category: "ekonomi" },
  { source: "AA", url: "https://www.aa.com.tr/tr/rss/default?cat=dunya", category: "dunya" },
  { source: "AA", url: "https://www.aa.com.tr/tr/rss/default?cat=spor", category: "spor" },
  { source: "AA", url: "https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji", category: "teknoloji" },
  { source: "TRT Haber", url: "https://www.trthaber.com/gundem_articles.rss", category: "gundem" },
  { source: "TRT Haber", url: "https://www.trthaber.com/ekonomi_articles.rss", category: "ekonomi" },
  { source: "TRT Haber", url: "https://www.trthaber.com/dunya_articles.rss", category: "dunya" },
  { source: "TRT Haber", url: "https://www.trthaber.com/spor_articles.rss", category: "spor" },
  { source: "TRT Haber", url: "https://www.trthaber.com/bilim_teknoloji_articles.rss", category: "teknoloji" },
  { source: "NTV", url: "https://www.ntv.com.tr/gundem.rss", category: "gundem" },
  { source: "NTV", url: "https://www.ntv.com.tr/ekonomi.rss", category: "ekonomi" },
  { source: "NTV", url: "https://www.ntv.com.tr/dunya.rss", category: "dunya" },
  { source: "NTV", url: "https://www.ntv.com.tr/teknoloji.rss", category: "teknoloji" },
  { source: "BBC Türkçe", url: "https://feeds.bbci.co.uk/turkce/rss.xml" },
  { source: "DW Türkçe", url: "https://rss.dw.com/xml/rss-tur-all" },
  { source: "Euronews", url: "https://tr.euronews.com/rss?format=mrss&level=theme&name=news" },
  { source: "Habertürk", url: "https://www.haberturk.com/rss" },
  { source: "Hürriyet", url: "https://www.hurriyet.com.tr/rss/anasayfa" },
  { source: "Cumhuriyet", url: "https://www.cumhuriyet.com.tr/rss/son_dakika.xml" },
  { source: "Sözcü", url: "https://www.sozcu.com.tr/feeds-rss-category-sozcu" },
  { source: "Bloomberg HT", url: "https://www.bloomberght.com/rss", category: "ekonomi" },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  gundem: "Gündem",
  ekonomi: "Ekonomi",
  dunya: "Dünya",
  spor: "Spor",
  teknoloji: "Teknoloji",
};
