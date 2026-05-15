import { TEXTS } from "./texts";
import { Lang, Driver, VerificationResult } from "./types";

export function t(chatId: number, userLang: Record<number, Lang>, key: string, vars?: Record<string, string>): string {
  const lang = userLang[chatId] || "uz";
  let text = TEXTS[key]?.[lang] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, "g"), v);
    });
  }
  return text;
}

export function normalizePhone(p: string) { return p.replace(/[\s\-\(\)\+]/g, ""); }
export function validateCarNumber(n: string) { return /^\d{2}[A-Z]\d{3}[A-Z]{2}$/i.test(n.replace(/\s/g, "")); }
export function validateTime(t: string) { return /^([01]\d|2[0-3]):([0-5]\d)$/.test(t.trim()); }
export function validatePhone(p: string) { return /^(998)?\d{9}$/.test(normalizePhone(p)); }

export function validateDriverTime(t: string): { ok: boolean; note?: string } {
  if (!validateTime(t)) return { ok: false, note: "To'g'ri format: 08:30" };
  const [h] = t.split(":").map(Number);
  if (h < 4 || h > 22) return { ok: false, note: "Vaqt 04:00–22:00 oralig'ida bo'lishi kerak" };
  return { ok: true };
}

export const KNOWN_CAR_MODELS = [
  "cobalt","lacetti","nexia","matiz","spark","malibu","tracker","equinox","captiva",
  "gentra","talisman","damas","labo","orlando","aveo","cruze","epica","evanda",
  "camry","corolla","prius","yaris","rav4","land cruiser","hilux","hiace",
  "accent","tucson","sonata","elantra","santa fe","creta","solaris",
  "rio","sportage","sorento","cerato","optima","carnival","stinger",
  "onix","monza","groove","traverse",
  "logan","duster","sandero","dokker","lodgy","kaptur",
  "polo","jetta","golf","passat","tiguan","touareg",
  "a6","a4","q5","q7","q3","e class","c class","s class","glc","gle",
  "model 3","model s","model x","model y",
  "zafira","astra","insignia","mokka","grandland",
  "swift","vitara","jimny","sx4","grand vitara","carry",
  "x5","x3","x1","3 series","5 series","7 series",
  "cx5","cx3","cx30","mazda3","mazda6",
  "transit","focus","fiesta","mondeo","kuga","explorer","ranger","f150",
  "ram","dodge","jeep","wrangler","cherokee","renegade",
  "haval","chery","geely","byd","great wall","changan","tank","bestune",
  "silverado","tahoe","suburban","colorado",
  "kia","hyundai","tesla","volkswagen","bmw","mercedes","audi","lexus",
];

export function validateCarModel(model: string): boolean {
  const lower = model.trim().toLowerCase();
  if (lower.length < 2) return false;
  return KNOWN_CAR_MODELS.some((m) => lower.includes(m) || m.includes(lower));
}

export function formatVerificationCard(v: VerificationResult): string {
  const badge = v.passed ? "🟢 TASDIQLANDI" : v.score >= 5 ? "🟡 DEYARLI" : v.score >= 3 ? "🟠 QISMAN" : "🔴 XATOLIKLAR";
  const lines = v.checks.map((c) => `${c.ok ? "✅" : "❌"} ${c.label}${c.note ? ` — <i>${c.note}</i>` : ""}`);
  return `🔍 <b>Avto tekshruv:</b> ${badge} (${v.score}/${v.checks.length})\n${lines.join("\n")}`;
}

export function formatRating(driver: Driver): string {
  if (driver.ratingCount === 0) return "⭐ Baho yo'q";
  const avg = (driver.totalRating / driver.ratingCount).toFixed(1);
  return `⭐ ${avg} (${driver.ratingCount} baho)`;
}

export function getTodayStr(): string {
  return new Date().toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function isAdmin(chatId: number): boolean {
  const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
  return ADMIN_IDS.includes(String(chatId));
}
