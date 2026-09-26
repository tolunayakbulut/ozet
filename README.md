# ozet

Günlük haber özeti → Instagram carousel denemesi. Henüz marka yok, Instagram paylaşımı yok.

Pipeline: RSS (22 Türkçe kaynak) → aynı olayı anlatan haberleri kümele → en önemli 8 olayı seç → tek sayfalık özet görseli (1080×1350 JPEG, 8 numaralı başlık) → `out/YYYY-MM-DD/`. Görselde başlıklar ve piyasa şeridi (dolar, euro, gram altın, BIST 100) var; her maddenin 1-2 cümlelik detayı ve kaynağı `caption.txt`'de.

## Çalıştır

```bash
npm install
npx playwright install chromium
npm start
```

Çıktı: `out/<tarih>/01.jpg`, `caption.txt`, `stories.json`.

### Seçenekler

- `.env` dosyasında `ANTHROPIC_API_KEY` varsa seçim ve özetleri Claude Haiku yazar (Claude'un yazdığı sayılar kaynak metinde aranır, bulunamayan sayı içeren özet cümlesi silinir); yoksa sezgisel seçim (kaynak sayısına göre sıralama, RSS açıklaması özet olarak) kullanılır.
- `npm start -- --no-llm` — key olsa bile sezgisel seçim.

## Dosyalar

- `src/feeds.ts` — RSS listesi
- `src/fetch.ts` — RSS çekme (retry ile)
- `src/select.ts` — kümeleme, sezgisel seçim, Claude seçimi
- `src/templates.ts` — tek sayfa özet HTML/CSS
- `src/market.ts` — piyasa verisi (Yahoo Finance, resmi olmayan API)
- `src/render.ts` — Playwright render, taşan metni küçültme
