# ozet

Günlük haber özeti → Instagram carousel denemesi. Henüz marka yok, Instagram paylaşımı yok.

Pipeline: RSS (22 Türkçe kaynak) → aynı olayı anlatan haberleri kümele → en önemli 9 olayı seç → HTML şablon → Playwright ile 1080×1350 JPEG (kapak + 9 slayt) → `out/YYYY-MM-DD/`.

## Çalıştır

```bash
npm install
npx playwright install chromium
npm start
```

Çıktı: `out/<tarih>/01.jpg … 10.jpg`, `caption.txt`, `stories.json`.

### Seçenekler

- `ANTHROPIC_API_KEY` varsa seçim ve özetleri Claude Haiku yazar; yoksa sezgisel seçim (kaynak sayısına göre sıralama, RSS açıklaması özet olarak) kullanılır.
- `npm start -- --no-llm` — key olsa bile sezgisel seçim.
- `npm start -- --no-images` — haber fotoğrafı yerine kategori renkli tipografik tasarım (telif riski yok).

## Dosyalar

- `src/feeds.ts` — RSS listesi
- `src/fetch.ts` — RSS çekme (retry ile)
- `src/select.ts` — kümeleme, sezgisel seçim, Claude seçimi
- `src/templates.ts` — kapak ve haber slaytı HTML/CSS
- `src/render.ts` — Playwright render, taşan metni küçültme
