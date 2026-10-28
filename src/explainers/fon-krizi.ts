import type { Ctx, Episode } from "../explainer.ts";

// Sources (checked 2026-10-28): NTV Para 20-21.10, Diken / İHA (30 Ekim ödemeleri), fayn.press kronoloji,
// Medyascope 01.10, NTV 27.10 (120 tutuklu), Takvim 26.10 (SPK durdurma).

/** Time `f` (0..1) of the way through sentence `k`. */
const at = (c: Ctx, k: number, f = 0) => {
  const a = c.at[k] ?? c.at[c.at.length - 1];
  const b = c.at[k + 1] ?? c.dur - 0.6;
  return a + (b - a) * f;
};

const date = (c: Ctx, dd: string, yy = "2026") => `
<div class="date an" style="${c.d(0.1)}"><span class="dd">${dd}</span><span class="yy">${yy}</span></div>
<div class="rule grow" style="${c.d(0.35)}"></div>`;

const person = (c: Ctx, x: number, ini: string, nm: string, rl: string, tag: string, amber = false) => `
<div class="person slideL" style="${c.d(x)}">
  <div class="avatar">${ini}</div>
  <div><div class="nm">${nm}</div><div class="rl">${rl}</div>
  <span class="tag stamp ${amber ? "amber" : ""}" style="${c.d(x + 0.5)}">${tag}</span></div>
</div>`;

/** Illustrative price line: flat for months, then a near-vertical climb to ~100x. */
function spikePath(w: number, h: number): string {
  const pts: string[] = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const k = i / n;
    const v = k < 0.55 ? 1 + 2 * k + Math.sin(i * 1.7) * 0.6 : 1 + Math.pow((k - 0.55) / 0.45, 3.2) * 99 + Math.sin(i * 2.3) * 1.2;
    const y = h - 20 - (Math.max(0, v - 1) / 99) * (h - 60);
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

const person20 = `<svg viewBox="0 0 20 24"><circle cx="10" cy="6" r="5"/><path d="M1 24a9 9 0 0 1 18 0z"/></svg>`;

const ep: Episode = {
  title: "Fon Krizi",
  scenes: [
    {
      say: "Fon krizi. 131 fon tasfiye edildi, 455 bin yatırımcı etkilendi, 120 kişi tutuklandı. Baştan anlatalım.",
      view: (c) => `
<div style="position:absolute;top:-180px;left:0;right:0">
  <div class="kick an" style="${c.d(0.1)};font-size:30px">ÖZET ANLATIYOR</div>
  <div class="big an" style="${c.d(0.25)};font-size:300px;margin-top:20px">FON</div>
  <div class="big an" style="${c.d(0.45)};font-size:300px;color:var(--red)">KRİZİ</div>
  <div class="rule grow" style="${c.d(0.8)};width:260px"></div>
  <div class="an" style="${c.d(0.9)};font-size:52px;font-weight:700">Baştan sona ne oldu?</div>
  <div style="display:flex;flex-direction:column;gap:22px;margin-top:70px;align-items:flex-start">
    <span class="chip pop" style="${c.d(at(c, 1, 0))}"><b>131</b> fon tasfiye</span>
    <span class="chip pop" style="${c.d(at(c, 1, 0.33))}"><b>455 bin+</b> yatırımcı</span>
    <span class="chip pop" style="${c.d(at(c, 1, 0.72))}"><b>120</b> tutuklu</span>
  </div>
</div>`,
    },
    {
      say: "19 Ağustos. Savcılık SPK'ya yazı gönderiyor. Bazı hisselerin fiyatı yaklaşık 100 kat artmış. İlk öne çıkan isimler: Pusula ve Tera Portföy.",
      view: (c) => {
        const W = 936, H = 440;
        return `${date(c, "19 Ağustos")}
<h2 class="an" style="${c.d(0.5)}">Savcılıktan <em>SPK'ya</em> yazı</h2>
<svg viewBox="0 0 ${W} ${H + 40}" width="${W}" height="${H + 40}" style="margin-top:30px;overflow:visible">
  <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D6333A" stop-opacity=".45"/><stop offset="1" stop-color="#D6333A" stop-opacity="0"/></linearGradient></defs>
  ${[0.25, 0.5, 0.75].map((k) => `<line x1="0" x2="${W}" y1="${(H - 20) * k}" y2="${(H - 20) * k}" stroke="#2C2922" stroke-width="2" stroke-dasharray="6 10"/>`).join("")}
  <line x1="0" x2="${W}" y1="${H - 20}" y2="${H - 20}" stroke="#4A4439" stroke-width="3"/>
  <path d="${spikePath(W, H)} L${W} ${H - 20} L0 ${H - 20}Z" fill="url(#ar)" class="an" style="${c.d(at(c, 2, 0.35))}"/>
  <path d="${spikePath(W, H)}" pathLength="1" fill="none" stroke="#D6333A" stroke-width="8" stroke-linejoin="round" stroke-linecap="round" class="draw" style="${c.d(at(c, 1, 0.3), "--len:" + (at(c, 2, 0.35) - at(c, 1, 0.3)).toFixed(2) + "s")}"/>
  <circle cx="${W}" cy="40" r="16" fill="#F4EFE6" class="pop" style="${c.d(at(c, 2, 0.3))};transform-origin:${W}px 40px"/>
  <text x="${W - 40}" y="130" text-anchor="end" font-family="Fraunces" font-weight="800" font-size="120" fill="#F4EFE6" class="pop" style="${c.d(at(c, 2, 0.32))};transform-origin:${W - 150}px 90px">×100</text>
  <text x="0" y="${H + 30}" font-size="24" fill="#8C8475" font-family="Inter" font-weight="600">Aylarca yatay</text>
  <text x="${W}" y="${H + 30}" text-anchor="end" font-size="24" fill="#8C8475" font-family="Inter" font-weight="600">Temsili grafik</text>
</svg>
<div style="display:flex;gap:18px;margin-top:40px">
  <span class="chip pop" style="${c.d(at(c, 3, 0.4))}">Pusula Portföy</span>
  <span class="chip pop" style="${c.d(at(c, 3, 0.7))}">Tera Portföy</span>
</div>`;
      },
    },
    {
      say: "9 Eylül. Tera Yatırım, Pusula Finans Holding'i devralmak için görüşmeye başlıyor. Kriz ilk kez kamuoyuna yansıyor.",
      view: (c) => `${date(c, "9 Eylül")}
<h2 class="an" style="${c.d(0.5)}">Tera, Pusula'yı <em>devralmak</em> istiyor</h2>
<div style="position:relative;height:420px;margin-top:70px">
  <div class="card slideL" style="${c.d(at(c, 1, 0.05))};position:absolute;left:0;top:60px;width:380px;height:260px;display:flex;flex-direction:column;justify-content:center">
    <div class="note">ALICI</div><div style="font-size:52px;font-weight:800;margin-top:10px">Tera<br>Yatırım</div></div>
  <div class="card slideR" style="${c.d(at(c, 1, 0.3))};position:absolute;right:0;top:60px;width:380px;height:260px;display:flex;flex-direction:column;justify-content:center">
    <div class="note">HEDEF</div><div style="font-size:52px;font-weight:800;margin-top:10px">Pusula Finans<br>Holding</div></div>
  <svg width="176" height="80" viewBox="0 0 176 80" style="position:absolute;left:380px;top:150px">
    <path d="M14 40 H150" pathLength="1" stroke="#D6333A" stroke-width="8" stroke-linecap="round" class="draw" style="${c.d(at(c, 1, 0.5), "--len:.6s")}"/>
    <path d="M132 20 L156 40 L132 60" fill="none" stroke="#D6333A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" class="an" style="${c.d(at(c, 1, 0.65))}"/>
  </svg>
</div>
<div class="chip pop" style="${c.d(at(c, 2, 0.1))};margin-top:20px"><b>●</b> Krizin kamuoyuna yansıyan ilk işareti</div>`,
    },
    {
      say: "15 Eylül. Pusula bazı fonlarda para iadesi yapamıyor: temerrüt. Yatırımcılar paralarını çekemiyor. Pusula Portföy başkanı Muhammed Yarız tutuklanıyor.",
      view: (c) => `${date(c, "15 Eylül")}
<div style="display:flex;align-items:center;gap:50px;margin-top:10px">
  <div style="position:relative;width:300px;height:360px;flex:none">
    <div style="position:absolute;left:30px;top:120px;width:240px;height:240px;border-radius:50%;border:6px solid #D6333A;animation:ring 1.4s ease-out var(--d) both;${c.d(at(c, 1, 0.75))}"></div>
    <svg viewBox="0 0 300 360" width="300" height="360" style="position:absolute;inset:0">
      <g style="animation:shackle .6s cubic-bezier(.5,0,.3,1.3) ${(c.t0 + at(c, 1, 0.7)).toFixed(2)}s both">
        <path d="M85 175 V115 a65 65 0 0 1 130 0 V175" fill="none" stroke="#F4EFE6" stroke-width="30" stroke-linecap="round"/></g>
      <rect x="35" y="165" width="230" height="185" rx="34" fill="#D6333A"/>
      <circle cx="150" cy="240" r="24" fill="#16140F"/><rect x="140" y="245" width="20" height="55" rx="10" fill="#16140F"/>
    </svg>
  </div>
  <div>
    <div class="big stamp" style="${c.d(at(c, 1, 0.75))};font-size:96px;color:var(--red);border:8px solid var(--red);border-radius:18px;padding:10px 22px;display:inline-block">TEMERRÜT</div>
    <div class="an" style="${c.d(at(c, 1, 0.1))};font-size:34px;font-weight:600;margin-top:30px;line-height:1.3">Fonlar para<br>iadesi yapamıyor</div>
  </div>
</div>
<div class="card an" style="${c.d(at(c, 2, 0.05))};display:flex;align-items:center;gap:22px;margin-top:40px;font-size:34px;font-weight:700">
  <span>Satış talimatı</span>
  <svg width="90" height="30" viewBox="0 0 90 30"><path d="M4 15 H76 M62 4 L80 15 L62 26" fill="none" stroke="#8C8475" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <span style="color:var(--red)">✕ Ödeme yok</span>
</div>
<div style="margin-top:46px">${person(c, at(c, 3, 0.1), "MY", "Muhammed Yarız", "Pusula Portföy YK Başkanı", "TUTUKLANDI")}</div>`,
    },
    {
      say: "İki gün sonra SPK, 7 şirketin 131 fonunu tasfiye ediyor. 455 binden fazla yatırımcı etkileniyor.",
      view: (c) => {
        const s = at(c, 0, 0.45), e = at(c, 0, 0.95);
        const cells = Array.from({ length: 131 }, (_, i) => `<i style="--d:${(c.t0 + s + ((e - s) * i) / 131).toFixed(2)}s"></i>`).join("");
        return `${date(c, "17 Eylül")}
<h2 class="an" style="${c.d(0.5)}">SPK: 7 şirketin <em><span data-from="0" data-to="131" data-at="${(c.t0 + s).toFixed(2)}" data-dur="${(e - s).toFixed(2)}">0</span> fonu</em> tasfiye</h2>
<div style="display:grid;grid-template-columns:repeat(16,38px);gap:10px;margin-top:36px">${cells}</div>
<style>main i[style*="--d"] { display:block; width:38px; height:38px; border-radius:9px; background:#2A261F; animation: fill .25s ease-out var(--d) both; }</style>
<div class="an" style="${c.d(at(c, 1))};margin-top:40px"><div class="big" style="font-size:130px;color:var(--red)" data-from="0" data-to="455758" data-at="${(c.t0 + at(c, 1, 0.1)).toFixed(2)}" data-dur="1.8">0</div><div class="unit">yatırımcı etkilendi</div></div>`;
      },
    },
    {
      say: "Ardından operasyonlar geliyor. Holding başkanları Serdar Turhan ve Emre Tezmen tutuklanıyor. Tutuklu sayısı bugün 120.",
      view: (c) => {
        const s = at(c, 2, 0.3), e = at(c, 2, 0.95);
        const icons = Array.from({ length: 120 }, (_, i) => `<b style="--d:${(c.t0 + s + ((e - s) * i) / 120).toFixed(2)}s">${person20}</b>`).join("");
        return `${date(c, "Eylül – Ekim", "")}
<div style="display:flex;flex-direction:column;gap:30px;margin-top:10px">
  ${person(c, at(c, 1, 0.05), "ST", "Serdar Turhan", "Pusula Holding YK Başkanı", "TUTUKLANDI")}
  ${person(c, at(c, 1, 0.5), "ET", "Emre Tezmen", "Tera Yatırım Holding YK Başkanı", "TUTUKLANDI")}
</div>
<div class="an" style="${c.d(at(c, 2))};display:flex;align-items:baseline;gap:20px;margin-top:36px">
  <span class="big" style="font-size:120px;color:var(--red)" data-from="0" data-to="120" data-at="${(c.t0 + s).toFixed(2)}" data-dur="${(e - s).toFixed(2)}">0</span><span class="unit">tutuklu</span></div>
<div class="ppl">${icons}</div>
<style>.ppl { display:grid; grid-template-columns:repeat(20,30px); gap:8px 10px; margin-top:16px; }
.ppl b { display:block; width:30px; height:36px; color:#3A352C; animation: pfill .2s ease-out var(--d) both; } .ppl svg { width:100%; height:100%; fill:currentColor; }
@keyframes pfill { from { color:#3A352C; } to { color:#D6333A; } }</style>`;
      },
    },
    {
      say: "Adalet Bakanı'na göre, 13 ile 16 Eylül arasında şüpheli çıkış yapan 214 kişi ve şirketin haksız kazancı 187 milyar lirayı aşıyor. Kriz siyasete de sıçrıyor: AK Parti Genel Başkan Yardımcısı Betül Sayan Kaya istifa ediyor.",
      view: (c) => `${date(c, "13–16 Eylül")}
<h2 class="an" style="${c.d(0.4)}">Kriz patlamadan <em>önce çıkanlar</em></h2>
<div class="an" style="${c.d(at(c, 0, 0.5))};margin-top:50px">
  <div class="big" style="font-size:200px;color:var(--red)"><span data-from="0" data-to="187.6" data-dec="1" data-at="${(c.t0 + at(c, 0, 0.62)).toFixed(2)}" data-dur="2">0</span></div>
  <div style="font-size:52px;font-weight:800;margin-top:6px">milyar ₺ haksız kazanç</div>
  <div style="display:flex;gap:16px;margin-top:28px">
    <span class="chip"><b>214</b> kişi ve şirket</span><span class="chip">şüpheli çıkış</span></div>
  <div class="note" style="margin-top:20px">Kaynak: Adalet Bakanı</div>
</div>
<div class="card an" style="${c.d(at(c, 1, 0.25))};margin-top:60px;padding:34px">${person(c, at(c, 1, 0.3), "SK", "Fatma Betül Sayan Kaya", "AK Parti Genel Başkan Yardımcısı", "İSTİFA", true)}</div>`,
    },
    {
      say: "22 Ekim. Fon kanunu yürürlüğe giriyor. Yatırımcılara 1 milyon liraya kadar ara ödeme yapılacak, el konulan varlıklar zararlara aktarılabilecek.",
      view: (c) => {
        const lines = [0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="40" y="${120 + i * 34}" width="${i % 3 === 2 ? 150 : 240}" height="12" rx="6" fill="#C9C0AF" class="grow" style="${c.d(0.6 + i * 0.12)};transform-box:fill-box"/>`).join("");
        const items = ["1 milyon ₺'ye kadar ara ödeme", "El konulan varlıklar zararlara", "TMSF kayyum atanabilecek"];
        return `${date(c, "22 Ekim")}
<h2 class="an" style="${c.d(0.5)}">Fon kanunu <em>yürürlükte</em></h2>
<div style="display:flex;gap:46px;margin-top:60px;align-items:flex-start">
  <div class="an" style="${c.d(0.4)};position:relative;flex:none">
    <svg viewBox="0 0 320 420" width="320" height="420">
      <rect x="0" y="0" width="320" height="420" rx="22" fill="#F4EFE6"/>
      <rect x="40" y="50" width="160" height="22" rx="8" fill="#16140F"/>
      ${lines}
    </svg>
    <div class="stamp" style="${c.d(at(c, 1, 0.6))};position:absolute;left:120px;top:250px;width:200px;height:200px;border-radius:50%;border:10px solid #D6333A;display:grid;place-items:center;color:#D6333A;font-size:40px;font-weight:800;letter-spacing:.08em;background:rgba(244,239,230,.6)">KABUL</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:30px;padding-top:10px">
    ${items.map((t, i) => `<div class="an" style="${c.d(at(c, 2, i * 0.3))};display:flex;gap:18px;font-size:36px;font-weight:700;line-height:1.2"><span style="color:var(--red)">●</span><span>${t}</span></div>`).join("")}
  </div>
</div>`;
      },
    },
    {
      say: "26 Ekim'de SPK, Tera ve Pusula Portföy'ü durduruyor. Şimdiye kadar 68 milyar lira ödendi. 1 milyon liraya kadar ödemeler 30 Ekim'de başlıyor: Tera için İş Bankası, Pusula ve Atlas için Ziraat.",
      view: (c) => `
<div class="kick an" style="${c.d(0.1)};font-size:30px">ŞU AN NEREDEYİZ?</div>
<div class="card an" style="${c.d(0.4)};margin-top:30px;display:flex;gap:26px;align-items:center">
  <div class="big" style="font-size:52px;color:var(--red);flex:none">26 Eki</div>
  <div style="font-size:32px;font-weight:700;line-height:1.25">SPK, Tera ve Pusula Portföy'ün faaliyetlerini durdurdu</div></div>
<div class="an" style="${c.d(at(c, 1))};margin-top:44px;display:flex;align-items:baseline;gap:20px">
  <span class="big" style="font-size:150px;color:var(--green)" data-from="0" data-to="68" data-at="${(c.t0 + at(c, 1, 0.4)).toFixed(2)}" data-dur="1.6">0</span>
  <span style="font-size:44px;font-weight:800">milyar ₺ ödendi</span></div>
<div class="note an" style="${c.d(at(c, 1, 0.3))}">71.899 hesap · 23 Ekim itibarıyla</div>
<div style="display:flex;gap:40px;margin-top:50px;align-items:center">
  <div style="flex:none;width:250px;border-radius:26px;overflow:hidden;background:#F4EFE6;color:#16140F;text-align:center;animation:flip .7s var(--e) var(--d) both;${c.d(at(c, 2, 0.1))};transform-origin:top">
    <div style="background:#D6333A;color:#fff;font-size:30px;font-weight:800;letter-spacing:.16em;padding:14px 0">EKİM</div>
    <div class="big" style="font-size:150px;padding:14px 0 0">30</div>
    <div style="font-size:30px;font-weight:700;padding:0 0 20px">Cuma</div></div>
  <div style="display:flex;flex-direction:column;gap:22px">
    <div class="an" style="${c.d(at(c, 2, 0.2))};font-size:36px;font-weight:800">1 milyon ₺'ye kadar ara ödeme başlıyor</div>
    <span class="chip pop" style="${c.d(at(c, 2, 0.55))};font-size:28px">Tera fonları → <b>İş Bankası</b></span>
    <span class="chip pop" style="${c.d(at(c, 2, 0.75))};font-size:28px">Pusula, Atlas → <b>Ziraat</b></span>
  </div>
</div>`,
    },
    {
      say: "Tasfiyenin 5 ila 6 ay sürmesi bekleniyor, soruşturma sürüyor. Özet Manşet'i takip edin.",
      hold: 1.0,
      view: (c) => `
<div class="kick an" style="${c.d(0.1)};font-size:30px">SIRADA NE VAR?</div>
<div class="an" style="${c.d(0.3)};margin-top:36px;display:flex;flex-direction:column;gap:26px">
  <div class="card" style="display:flex;gap:24px;align-items:center"><span class="big" style="font-size:80px;color:var(--red);flex:none">5–6 ay</span><span style="font-size:34px;font-weight:700">Tasfiyenin beklenen süresi</span></div>
  <div class="card" style="font-size:34px;font-weight:700">Soruşturma sürüyor, yeni gözaltılar gelebilir</div>
</div>
<div style="display:flex;flex-direction:column;align-items:center;margin-top:90px;gap:28px">
  <span class="logo pop" style="--s:170px;${c.d(at(c, 1, 0))}"><span class="o">O</span><i style="left:27%"></i><i style="right:27%"></i></span>
  <div class="an" style="${c.d(at(c, 1, 0.2))};font-size:46px;font-weight:800;letter-spacing:.04em">@ozetmanset</div>
  <div class="pop" style="${c.d(at(c, 1, 0.45))};padding:22px 56px;border-radius:999px;background:var(--red);color:#fff;font-size:38px;font-weight:800">Takip et</div>
  <div class="note an" style="${c.d(at(c, 1, 0.6))};margin-top:10px;text-align:center">Kaynak: SPK, Adalet Bakanlığı, Cumhurbaşkanlığı, NTV, Diken</div>
</div>`,
    },
  ],
  caption: `Fon krizi baştan sona: 19 Ağustos'taki savcılık yazısından 30 Ekim'deki ara ödemelere kadar ne oldu? 🎬

▪️ 19 Ağustos: İstanbul Cumhuriyet Başsavcılığı, fiyatı yaklaşık 100 kat artan hisseler için SPK'ya yazı gönderdi.
▪️ 9 Eylül: Tera Yatırım, Pusula Finans Holding'i devralma görüşmesi açıkladı.
▪️ 15 Eylül: Pusula fonlarında iade ödemelerinde temerrüt. Pusula Portföy YK Başkanı Muhammed Yarız tutuklandı.
▪️ 17 Eylül: SPK, 7 portföy şirketine ait 131 fonun tasfiyesine karar verdi; 455 binden fazla yatırımcı etkilendi.
▪️ Eylül–Ekim: Serdar Turhan ve Emre Tezmen dahil tutuklu sayısı 120'ye ulaştı.
▪️ Adalet Bakanı: 13–16 Eylül'de şüpheli çıkış yapan 214 kişi ve şirketin haksız kazancı 187,6 milyar ₺.
▪️ 22 Ekim: Fon kanunu yürürlüğe girdi; 1 milyon ₺'ye kadar ara ödeme, el konulan varlıklar zararlara.
▪️ 26 Ekim: SPK, Tera ve Pusula Portföy'ün faaliyetlerini durdurdu. 23 Ekim itibarıyla 71.899 hesaba 68 milyar ₺ ödendi.
▪️ 30 Ekim: 1 milyon ₺'ye kadar ara ödemeler İş Bankası (Tera) ve Ziraat Bankası (Pusula, Atlas) üzerinden başlıyor.

Kaynak: SPK, Adalet Bakanlığı, Cumhurbaşkanlığı, NTV, Diken

#fonkrizi #fonsoruşturması #spk #tasfiye #ekonomi #özetmanşet`,
};

export default ep;
