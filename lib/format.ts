const SYMBOLS: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };

export function money(amount: number, currency = "TRY"): string {
  const n = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${n} ${SYMBOLS[currency] ?? currency}`;
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export const SOURCE_LABELS = {
  web: "Panel",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  receipt: "Fiş",
  voice: "Ses",
  email: "Banka",
} as const;

export function monthName(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
}
