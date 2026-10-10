import type { User } from "./db";

/** Ücretsiz planda bir ayda kaydedilebilecek işlem sayısı. */
export const FREE_MONTHLY_LIMIT = 60;

export const PLANS = {
  free: {
    name: "Ücretsiz",
    price: "0 ₺",
    features: [
      `Ayda ${FREE_MONTHLY_LIMIT} işlem`,
      "WhatsApp'tan yazarak kayıt",
      "Aylık özet ve kategori raporu",
      "3 kategoriye bütçe",
    ],
  },
  pro: {
    name: "Pro",
    price: process.env.NEXT_PUBLIC_PRO_PRICE || "79 ₺ / ay",
    features: [
      "Sınırsız işlem",
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
