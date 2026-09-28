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
- `src/video.ts` — 16 sn 9:16 animasyonlu video (Playwright kareleri + ffmpeg), sentezlenmiş telifsiz müzik
- `src/render.ts` — Playwright render, taşan metni küçültme

## Otomatik yayın (GitHub Actions)

`.github/workflows/daily.yml` her akşam 20:00'de (İstanbul) paylaşır: render → görseli `images` branch'ine koyar (Instagram için public URL) → `npm run publish` ile Instagram (gönderi + müzikli animasyonlu hikâye + Reels) ve X'e paylaşır. X'te haftalık deney: çift ISO haftası görsel + detay zinciri, tek hafta video + kaynak yanıtı; gönderi id'leri ve ertesi gün metrikleri `images` branch'inde `data/x/` altında (`src/x-metrics.ts`). Secret'ı tanımlı olmayan platform atlanır. Elle tetiklemek: Actions → daily → Run workflow (beklemeden hemen paylaşır).

Tetikleme ve tek paylaşım garantisi:

- **cron-job.org (asıl):** her gün 19:40 İstanbul'da `workflow_dispatch` çağırır, iş akışı 20:00'yi bekleyip paylaşır. GitHub'ın kendi cron'u saatlerce gecikebildiği ya da hiç çalışmayabildiği için asıl tetikleyici bu.
- **GitHub cron (yedek):** 19:15, 20:07, 21:07, 22:07 İstanbul. O gün paylaşıldıysa saniyeler içinde hiçbir şey yapmadan biter.
- **Tek paylaşım:** paylaşımdan hemen önce `images` branch'ine `published/<tarih>` işareti yazılır. İşaret varsa sonraki her tetikleme (elle dahil) atlanır. Çalıştırmalar aynı anda koşmaz (`concurrency`). Paylaşım yarıda hata verirse otomatik tekrar denenmez, çünkü başarılı olan platformlara ikinci kez gider. Düzeltip yeniden paylaşmak için: Run workflow → `force` işaretli.
- Otomatik tetiklemeler 19:00–03:00 İstanbul dışında atlanır (gece yarısını geçen gecikmiş bir cron ertesi günün paylaşımını erkenden yapmasın diye).

cron-job.org kurulumu:

1. GitHub → Settings → Developer settings → Fine-grained tokens → yalnızca `ozet` reposu, Permissions → Actions: **Read and write**.
2. cron-job.org → Create cronjob:
   - URL: `https://api.github.com/repos/tolunayakbulut/ozet/actions/workflows/daily.yml/dispatches`
   - Schedule: her gün 19:40, saat dilimi Europe/Istanbul
   - Advanced → Request method `POST`, headers: `Accept: application/vnd.github+json`, `Authorization: Bearer <token>`, `X-GitHub-Api-Version: 2022-11-28`, `Content-Type: application/json`
   - Request body: `{"ref":"main","inputs":{"auto":"true"}}`
   - Notifications: başarısız çalıştırmada e-posta (başarılı yanıt `204`)
3. Token'ın süresi dolunca yenile. Dolarsa da GitHub cron yedekleri çalışmaya devam eder.

Repo secrets (Settings → Secrets and variables → Actions):

| Secret | Nereden |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `IG_USER_ID`, `IG_ACCESS_TOKEN` | Instagram, "Özet Manşet" Facebook sayfasına bağlı; token = sayfanın süresiz Page access token'ı (Graph API Explorer → uzun ömürlü user token → /me/accounts) |
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | developer.x.com → app → Read and Write izni |
