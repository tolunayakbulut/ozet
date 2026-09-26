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

## Otomatik yayın (GitHub Actions)

`.github/workflows/daily.yml` her gün 19:30'da (İstanbul) çalışır: render → görseli `images` branch'ine koyar (Instagram için public URL) → `npm run publish` ile Instagram, Telegram ve X'e paylaşır. Secret'ı tanımlı olmayan platform atlanır. Elle tetiklemek: Actions → daily → Run workflow.

Repo secrets (Settings → Secrets and variables → Actions):

| Secret | Nereden |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | @BotFather ile bot aç, kanala admin ekle; chat id = `@kanaladi` |
| `IG_USER_ID`, `IG_ACCESS_TOKEN` | Meta app → "Instagram API with Instagram Login" → uzun ömürlü token |
| `GH_PAT` | Fine-grained PAT, bu repoda Secrets: read/write (Instagram token'ını aylık yenilemek için) |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | developer.x.com → app → Read and Write izni |
