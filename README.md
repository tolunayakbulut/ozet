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

## Tarihte Bugün

`npm run history` → `out/history/<tarih>/`: Vikipedi'nin "tarihte bugün" listesinden (olaylar, doğumlar, ölümler; yalnızca Wikimedia Commons fotoğrafı olanlar) Claude Haiku tek madde seçer, başlık, 2-3 cümle detay ve yorum sorusu yazar (kaynakta olmayan sayı içeren cümle silinir). Çıktı: fotoğraflı kart `01.jpg` (1080×1350), animasyonlu 9:16 `video.mp4` (hikâye + Reels), `caption.txt`, `event.json`. Bir günün maddesini sabitlemek için `history-picks.json`: `{"2026-10-25": "Nüfus sayımı"}` (yıl ya da metinden bir parça; metni yine Claude yazar). `npm run publish-history -- <tarih>` Instagram (gönderi, hikâye, Reels), Facebook ve X'e paylaşır.

`.github/workflows/history.yml` her gün 12:30'da (İstanbul) paylaşır; tetikleme `daily.yml` ile aynı düzende: cron-job.org 12:10'da `history.yml` için `workflow_dispatch` (`{"ref":"main","inputs":{"auto":"true"}}`), GitHub cron yedek. Tek paylaşım işareti `images` branch'inde `published-history/<tarih>`, görseller `history/` altında. Otomatik tetiklemeler 11:00–17:00 İstanbul dışında atlanır.

## Özet Anlatıyor (seslendirmeli açıklayıcı video)

`npm run explainer -- <konu>` → `out/explainers/<konu>/`: süren bir gündemi baştan sona anlatan seslendirmeli, altyazılı 9:16 video (`video.mp4`) ve `caption.txt`. Her bölüm bir dosya: `src/explainers/<konu>.ts` (sahne başına anlatım metni + kodla çizilen görünüm; animasyonlar cümle başlarına bağlı). Örnek: `fon-krizi`.

Ses: Gemini TTS, Alnilam (insta-video'nun Türkçe kanalıyla aynı ses), bütün metin tek istekte okunur (ücretsiz katman günde ~10 istek). Kelime zamanları insta-video'nun Whisper hizalayıcısıyla çıkar (`~/Projects/insta-video/tts-lab/.venv-cb`). `.env`'de `GEMINI_API_KEY` gerekir. Okuma önbelleğe alınır; metin değişmedikçe yeniden render kota harcamaz. Ekranda farklı, okumada farklı yazılması gereken kelimeler `spoken()` içinde (örn. "AK Parti" → "Ak Parti").

Paylaşım elle: videoyu `images` branch'ine `explainers/<konu>.mp4` olarak koy, sonra `VIDEO_URL=<raw URL> FB_PAGE_ID=... npm run publish-explainer -- <konu> "<tweet metni>"` (Instagram Reels + hikâye, Facebook video, X). Instagram hikâyesi 60 sn'den uzun videoyu kabul etmez; Facebook video için sayfa token'ında video yayınlama izni gerekir.

## Otomatik yayın (GitHub Actions)

`.github/workflows/daily.yml` her akşam 20:00'de (İstanbul) paylaşır: render → görseli `images` branch'ine koyar (Instagram için public URL) → `npm run publish` ile Instagram (gönderi + müzikli animasyonlu hikâye + Reels) ve X'e paylaşır. X'te haftalık deney: çift ISO haftası görsel + detay zinciri, tek hafta video + kaynak yanıtı; gönderi id'leri ve ertesi gün metrikleri `images` branch'inde `data/x/` altında (`src/x-metrics.ts`). Secret'ı tanımlı olmayan platform atlanır. Elle tetiklemek: Actions → daily → Run workflow (beklemeden hemen paylaşır).

Tetikleme ve tek paylaşım garantisi:

- **cron-job.org (asıl):** her gün 19:40 İstanbul'da `workflow_dispatch` çağırır, iş akışı 20:00'yi bekleyip paylaşır. GitHub'ın kendi cron'u saatlerce gecikebildiği ya da hiç çalışmayabildiği için asıl tetikleyici bu.
- **GitHub cron (yedek):** 19:15, 20:07, 21:07, 22:07 İstanbul. O gün paylaşıldıysa saniyeler içinde hiçbir şey yapmadan biter.
- **Tek paylaşım:** paylaşımdan hemen önce `images` branch'ine `published/<tarih>` işareti yazılır. İşaret varsa sonraki her tetikleme (elle dahil) atlanır. Çalıştırmalar aynı anda koşmaz (`concurrency`). Paylaşım yarıda hata verirse otomatik tekrar denenmez, çünkü başarılı olan platformlara ikinci kez gider. Düzeltip yeniden paylaşmak için: Run workflow → `force` işaretli.
- **Baskı tarihi:** klasör, görsel/video/caption'daki tarih ve işaret aynı günü kullanır. 06:00'dan önceki çalıştırma bir önceki akşamın baskısıdır. Yani gece yarısını geçen geç bir paylaşım yarının tarihiyle çıkmaz, yarının paylaşımını da engellemez.
- Otomatik tetiklemeler 19:00–03:00 İstanbul dışında atlanır.

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
