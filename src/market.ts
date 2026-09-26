export interface Quote {
  label: string;
  value: number;
  changePct: number;
  decimals: number;
}

interface Chart {
  meta: { regularMarketPrice: number; regularMarketTime: number };
  timestamp: number[];
  indicators: { quote: { close: (number | null)[] }[] };
}

const GRAMS_PER_OUNCE = 31.1035;

/** Latest price and the previous trading day's close from Yahoo Finance's (unofficial) chart API. */
async function chart(symbol: string): Promise<{ price: number; prev: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const data = (await res.json()) as { chart: { result: Chart[] } };
  const { meta, timestamp, indicators } = data.chart.result[0];
  const today = new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10);
  const closes = timestamp
    .map((t, i) => ({ day: new Date(t * 1000).toISOString().slice(0, 10), close: indicators.quote[0].close[i] }))
    .filter((c): c is { day: string; close: number } => c.close != null && c.day < today);
  const prev = closes.at(-1)?.close;
  if (prev == null) throw new Error(`${symbol}: önceki kapanış yok`);
  return { price: meta.regularMarketPrice, prev };
}

const pct = (price: number, prev: number) => ((price - prev) / prev) * 100;

export async function fetchMarket(): Promise<Quote[]> {
  const [usd, eur, gold, bist] = await Promise.all(["USDTRY=X", "EURTRY=X", "GC=F", "XU100.IS"].map(chart));
  const gram = (ounce: number, usdtry: number) => (ounce * usdtry) / GRAMS_PER_OUNCE;
  const gramNow = gram(gold.price, usd.price);
  const gramPrev = gram(gold.prev, usd.prev);
  return [
    { label: "Dolar", value: usd.price, changePct: pct(usd.price, usd.prev), decimals: 2 },
    { label: "Euro", value: eur.price, changePct: pct(eur.price, eur.prev), decimals: 2 },
    { label: "Gram altın", value: gramNow, changePct: pct(gramNow, gramPrev), decimals: 0 },
    { label: "BIST 100", value: bist.price, changePct: pct(bist.price, bist.prev), decimals: 0 },
  ];
}
