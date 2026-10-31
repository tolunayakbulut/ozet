import type { Ctx, Episode } from "../explainer.ts";

// Source: viral "bir bankacı" infographic shared by @voiceofworldco (2026-10-31). Not an official
// classification; the outro says so.

/** Time `f` (0..1) of the way through sentence `k`. */
const at = (c: Ctx, k: number, f = 0) => {
  const a = c.at[k] ?? c.at[c.at.length - 1];
  const b = c.at[k + 1] ?? c.dur - 0.6;
  return a + (b - a) * f;
};

const TIERS = [
  { name: "Çok Zengin", color: "#E8C468" },
  { name: "Zengin", color: "#D6333A" },
  { name: "Orta Sınıf", color: "#3BAA72" },
  { name: "Fakir Orta", color: "#E3A23B" },
  { name: "Fakir", color: "#8C8475" },
];

/** Five stacked bars, narrow at the top; `on` lights one tier, or all of them in turn with labels. */
function pyramid(c: Ctx, on: number | null, w: number, x = 0.3, step = 0, labels = false): string {
  const rows = TIERS.map((t, i) => {
    const lit = on === null || on === i;
    const k = 0.36 + 0.16 * i;
    const delay = on === null ? x + (4 - i) * step : x;
    return `<div class="${on === null ? "slideL" : lit ? "pop" : "an"}" style="${c.d(delay)};display:flex;align-items:center;gap:22px">
  <div style="width:${(w * k).toFixed(0)}px;height:${labels ? 84 : 30}px;margin-left:${((w * (1 - k)) / 2).toFixed(0)}px;margin-right:${((w * (1 - k)) / 2).toFixed(0)}px;border-radius:${labels ? 16 : 8}px;background:${lit ? t.color : "#2C2922"}"></div>
  ${labels ? `<span style="font-size:40px;font-weight:800;color:${t.color}">${t.name}</span>` : ""}
</div>`;
  }).join("");
  return `<div style="display:flex;flex-direction:column;gap:${labels ? 16 : 8}px">${rows}</div>`;
}

interface Tier {
  i: number; // index into TIERS
  rank: string; // e.g. "1. BASAMAK"
  lo: string;
  hi: string;
  bullets: [string, number, number][]; // text, sentence, fraction
  incomeAt: [number, number];
  stamp?: [string, number, number];
}

function tier(c: Ctx, t: Tier): string {
  const { name, color } = TIERS[t.i];
  return `
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <div class="kick an" style="${c.d(0.1)};font-size:30px;color:${color}">${t.rank}</div>
    <div class="big an" style="${c.d(0.25)};font-size:${name.length > 8 ? 110 : 140}px;margin-top:14px">${name}</div>
  </div>
  <div style="margin-top:8px">${pyramid(c, t.i, 230, 0.2)}</div>
</div>
<div class="rule grow" style="${c.d(0.5)};background:${color}"></div>
<div class="note an" style="${c.d(at(c, ...t.incomeAt))}">AYLIK GELİR</div>
<div class="an" style="${c.d(at(c, ...t.incomeAt))};display:flex;align-items:baseline;gap:22px;margin-top:8px;flex-wrap:wrap">
  <span class="big" style="font-size:96px;color:${color}">${t.lo}</span>
  ${t.hi ? `<span style="font-size:60px;font-weight:800;color:var(--mute)">–</span><span class="big pop" style="${c.d(at(c, t.incomeAt[0], t.incomeAt[1] + 0.25))};font-size:96px;color:${color}">${t.hi}</span>` : ""}
</div>
<div style="display:flex;flex-direction:column;gap:20px;margin-top:46px">
  ${t.bullets
    .map(
      ([s, k, f]) => `<div class="card slideL" style="${c.d(at(c, k, f))};display:flex;gap:20px;align-items:center;padding:24px 30px;font-size:36px;font-weight:700;line-height:1.2">
    <span style="color:${color};flex:none">●</span><span>${s}</span></div>`,
    )
    .join("")}
</div>
${t.stamp ? `<div class="tag stamp" style="${c.d(at(c, t.stamp[1], t.stamp[2]))};border-color:${color};color:${color};font-size:34px;margin-top:34px">${t.stamp[0]}</div>` : ""}`;
}

const ep: Episode = {
  title: "5 Ekonomik Sınıf",
  scenes: [
    {
      say: "Türkiye'de herkes kendini orta sınıf sanıyor. Bir bankacıya göre ise gerçekte 3 değil, 5 ekonomik sınıf var. Aşağıdan başlayalım.",
      view: (c) => `
<div style="position:absolute;top:-180px;left:0;right:0">
  <div class="kick an" style="${c.d(0.1)};font-size:30px">ÖZET ANLATIYOR</div>
  <div style="position:relative;display:inline-block;margin-top:20px">
    <div class="big an" style="${c.d(0.2)};font-size:200px;color:var(--mute)">3 SINIF</div>
    <div class="grow" style="${c.d(at(c, 1, 0.45))};position:absolute;left:-10px;right:-10px;top:52%;height:16px;border-radius:8px;background:var(--red);transform:rotate(-4deg)"></div>
  </div>
  <div class="big pop" style="${c.d(at(c, 1, 0.6))};font-size:240px;color:var(--red);transform-origin:left;margin-top:40px">5 SINIF</div>
  <div class="an" style="${c.d(at(c, 1, 0.75))};font-size:46px;font-weight:700;margin-top:10px">Siz hangisindesiniz?</div>
  <div style="margin-top:60px">${pyramid(c, null, 420, at(c, 1, 0.8), 0.18, true)}</div>
</div>`,
    },
    {
      say: "En altta fakirler. Aylık gelir asgari ücretten 100 bin liraya kadar. Krediyle ve borçla geçiniyorlar, para biriktiremiyorlar. Beklenmedik bir masraf hayatı alt üst edebiliyor.",
      view: (c) =>
        tier(c, {
          i: 4,
          rank: "1. BASAMAK",
          lo: "Asgari",
          hi: "100 bin ₺",
          incomeAt: [1, 0.1],
          bullets: [
            ["Kredi ve borçla geçiniyor", 2, 0],
            ["Para biriktiremiyor", 2, 0.55],
            ["Temel ihtiyaçlarda zorlanıyor", 3, 0],
          ],
          stamp: ["BEKLENMEDİK MASRAF = KRİZ", 3, 0.5],
        }),
    },
    {
      say: "Sonra fakir orta sınıf: aylık 100 bin ile 800 bin lira arası. Genelde beyaz yaka. Evi ya da arabası var ama çoğu krediyle. Kendini orta sınıf sanıyor, aslında değil.",
      view: (c) =>
        tier(c, {
          i: 3,
          rank: "2. BASAMAK",
          lo: "100 bin",
          hi: "800 bin ₺",
          incomeAt: [0, 0.4],
          bullets: [
            ["Genelde beyaz yaka", 1, 0],
            ["Ev ya da araba var, çoğu krediyle", 2, 0],
            ["Zengin görünme çabası", 2, 0.7],
          ],
          stamp: ["ORTA SINIF DEĞİL", 3, 0.6],
        }),
    },
    {
      say: "Gerçek orta sınıfın aylık geliri ise 800 bin ile 5 milyon lira arası. Kira geliri, yazlığı, eurobond ve fon gibi yatırımları var. Gelirinin yarısından fazlasını biriktirebiliyor.",
      view: (c) =>
        tier(c, {
          i: 2,
          rank: "3. BASAMAK",
          lo: "800 bin",
          hi: "5 milyon ₺",
          incomeAt: [0, 0.3],
          bullets: [
            ["Gayrimenkul geliri, yazlık", 1, 0],
            ["Eurobond, fon gibi yatırımlar", 1, 0.5],
            ["Gelirinin %50–80'ini biriktiriyor", 2, 0.1],
          ],
          stamp: ["GELECEK KAYGISI DÜŞÜK", 2, 0.7],
        }),
    },
    {
      say: "Zenginler ayda 5 ila 50 milyon lira kazanıyor. Hisse ve fon portföyleri, birden fazla gayrimenkulleri var. Lüks standart, çocukları yurt dışında okuyor.",
      view: (c) =>
        tier(c, {
          i: 1,
          rank: "4. BASAMAK",
          lo: "5 milyon",
          hi: "50 milyon ₺",
          incomeAt: [0, 0.2],
          bullets: [
            ["Hisse, fon, eurobond portföyü", 1, 0],
            ["Birden fazla gayrimenkul", 1, 0.55],
            ["Çocuklar yurt dışında okuyor", 2, 0.4],
          ],
          stamp: ["LÜKS = STANDART", 2, 0.1],
        }),
    },
    {
      say: "En tepede çok zenginler: ayda 50 milyon liranın üzeri. Büyük şirketlerin ve yatırımların sahibiler, birkaç ülkede mülkleri var. Servetleri servet üretiyor.",
      view: (c) =>
        tier(c, {
          i: 0,
          rank: "5. BASAMAK",
          lo: "50 milyon ₺ +",
          hi: "",
          incomeAt: [0, 0.4],
          bullets: [
            ["Büyük şirket ve yatırımların sahibi", 1, 0],
            ["Birden fazla ülkede gayrimenkul", 1, 0.55],
            ["En değerli para birimi: zaman", 2, 0.2],
          ],
          stamp: ["SERVET SERVET ÜRETİR", 2, 0.1],
        }),
    },
    {
      say: "Bu resmi bir sınıflandırma değil, bir bankacının yorumu. Siz hangi sınıftasınız? Yorumlara yazın, Özet Manşet'i takip edin.",
      hold: 0.6,
      view: (c) => `
<div class="note an" style="${c.d(0.1)}">RESMİ SINIFLANDIRMA DEĞİL · BİR BANKACININ YORUMU</div>
<div class="big an" style="${c.d(at(c, 1, 0))};font-size:120px;margin-top:30px">Siz hangi<br><span style="color:var(--red)">sınıftasınız?</span></div>
<div style="margin-top:50px">${pyramid(c, null, 300, at(c, 1, 0.3), 0.1)}</div>
<div style="display:flex;flex-direction:column;align-items:center;margin-top:60px;gap:26px">
  <div class="chip pop" style="${c.d(at(c, 2, 0))}">💬 Yorumlara yazın</div>
  <div style="display:flex;align-items:center;gap:26px">
    <span class="logo pop" style="--s:120px;${c.d(at(c, 1, 0.5))}"><span class="o">O</span><i style="left:27%"></i><i style="right:27%"></i></span>
    <div class="an" style="${c.d(at(c, 1, 0.6))};font-size:46px;font-weight:800">@ozetmanset</div>
    <div class="pop" style="${c.d(at(c, 2, 0.3))};padding:18px 44px;border-radius:999px;background:var(--red);color:#fff;font-size:34px;font-weight:800">Takip et</div>
  </div>
</div>`,
    },
  ],
  caption: `Türkiye'de herkes kendini orta sınıf sanıyor. Bir bankacıya göre ise gerçekte 5 ekonomik sınıf var. Siz hangisindesiniz? 👇

▪️ Fakir: Asgari ücret – 100 bin ₺. Kredi ve borçla geçinir, birikim yapamaz.
▪️ Fakir orta: 100 bin – 800 bin ₺. Genelde beyaz yaka; ev ya da araba çoğu zaman krediyle.
▪️ Orta sınıf: 800 bin – 5 milyon ₺. Kira geliri, yazlık, yatırım; gelirin %50–80'i birikim.
▪️ Zengin: 5 – 50 milyon ₺. Portföy, birden fazla gayrimenkul, yurt dışında eğitim.
▪️ Çok zengin: 50 milyon ₺ üzeri. Büyük şirketler, birden fazla ülkede mülk; servet servet üretir.

Rakamlar aylık gelir. Resmi bir sınıflandırma değil, sosyal medyada yayılan bir bankacı yorumu.

#ekonomi #ortasınıf #gelir #enflasyon #özetmanşet`,
};

export default ep;
