import type { User } from "./db";

/** Ücretsiz planda bir ayda kaydedilebilecek işlem sayısı. */
export const FREE_MONTHLY_LIMIT = 60;
export const FREE_GOAL_LIMIT = 2;

export const PLANS = {
  free: {
    name: "Ücretsiz",
    price: "0 ₺",
    features: [
      `Ayda ${FREE_MONTHLY_LIMIT} işlem`,
      "WhatsApp ve Telegram'dan yazarak kayıt",
      "50/30/20 kovaları ve aylık özet",
      "Gelir, sabit gider ve 6 aylık tahmin",
      `${FREE_GOAL_LIMIT} hedef, 3 kategori bütçesi`,
    ],
  },
  pro: {
    name: "Pro",
    price: process.env.PRO_PRICE || "79 ₺ / ay",
    features: [
      "Banka e-postalarından otomatik kayıt",
      "Sınırsız işlem ve hedef",
      "Fiş fotoğrafından otomatik kayıt",
      "Sesli mesajla kayıt",
      "Sınırsız bütçe ve aşım uyarısı",
      "Haftalık WhatsApp raporu",
      "CSV dışa aktarma",
    ],
  },
} as const;

export const FREE_BUDGET_LIMIT = 3;

export function isPro(user: Pick<User, "plan" | "plan_until">, now = new Date()): boolean {
  if (user.plan !== "pro") return false;
  return !user.plan_until || new Date(user.plan_until) > now;
}
