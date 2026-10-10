// Türkiye 2016'dan beri yaz saati uygulamıyor; sabit UTC+3 yeterli.
const OFFSET_MS = 3 * 60 * 60 * 1000;

export type Period = "today" | "yesterday" | "week" | "month" | "last_month" | "year" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  yesterday: "Dün",
  week: "Bu hafta",
  month: "Bu ay",
  last_month: "Geçen ay",
  year: "Bu yıl",
  all: "Tüm zamanlar",
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Türkiye saatine göre bugünün tarihi (YYYY-MM-DD). */
export function today(now = new Date()): string {
  return iso(new Date(now.getTime() + OFFSET_MS));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function daysInMonth(day: string): number {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dönemin [from, to] aralığı, iki uç dahil. */
export function periodRange(period: Period, now = new Date()): { from: string; to: string } {
  const t = today(now);
  switch (period) {
    case "today":
      return { from: t, to: t };
    case "yesterday": {
      const y = addDays(t, -1);
      return { from: y, to: y };
    }
    case "week": {
      // Hafta pazartesi başlar.
      const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { from: addDays(t, -dow), to: t };
    }
    case "month":
      return { from: monthStart(t), to: t };
    case "last_month": {
      const end = addDays(monthStart(t), -1);
      return { from: monthStart(end), to: end };
    }
    case "year":
      return { from: `${t.slice(0, 4)}-01-01`, to: t };
    case "all":
      return { from: "1970-01-01", to: t };
  }
}

/** Geçerli bir YYYY-MM-DD ise döndürür; gelecekteki tarihleri bugüne çeker. */
export function cleanDate(value: unknown, now = new Date()): string {
  const t = today(now);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return t;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || iso(d) !== value) return t;
  return value > t ? t : value;
}
