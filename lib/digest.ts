import { BUCKETS, BUCKET_KEYS, categoryLabel } from "./categories";
import { addDays, today } from "./dates";
import type { User } from "./db";
import { money } from "./format";
import { round, summarize, transactionsBetween } from "./stats";

/** Geçen haftanın (pazartesi–pazar) özet mesajı; işlem yoksa null. */
export async function weeklyDigest(user: User, now = new Date()): Promise<string | null> {
  const t = today(now);
  const dow = (new Date(`${t}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = addDays(t, -dow - 7);
  const to = addDays(from, 6);
  const prevFrom = addDays(from, -7);

  const [week, prev] = await Promise.all([
    transactionsBetween(user.id, from, to),
    transactionsBetween(user.id, prevFrom, addDays(from, -1)),
  ]);
  if (!week.length) return null;

  const s = summarize(week);
  const p = summarize(prev);
  const lines = [`🗓️ Haftalık özetin (${from.slice(5).split("-").reverse().join(".")}–${to.slice(5).split("-").reverse().join(".")})`, ""];
  lines.push(`Gider: ${money(s.expense, user.currency)}`);
  if (p.expense > 0) {
    const diff = Math.round(((s.expense - p.expense) / p.expense) * 100);
    lines.push(diff <= 0 ? `📉 Önceki haftadan %${-diff} az 👏` : `📈 Önceki haftadan %${diff} fazla`);
  }
  if (s.income > 0) lines.push(`Gelir: ${money(s.income, user.currency)}`);
  if (s.expenseByCategory.length) {
    lines.push("", "En çok harcadığın:");
    for (const c of s.expenseByCategory.slice(0, 3)) {
      lines.push(`• ${categoryLabel(c.category)}: ${money(c.total, user.currency)} (%${Math.round((c.total / s.expense) * 100)})`);
    }
  }
  const expenses = week.filter((t) => t.type === "expense");
  const byBucket = BUCKET_KEYS.map((b) => {
    const total = round(expenses.filter((t) => t.bucket === b).reduce((sum, t) => sum + t.amount, 0));
    return `${BUCKETS[b].label} ${money(total, user.currency)}`;
  });
  lines.push("", `Kovalar: ${byBucket.join(" · ")}`);
  const pending = expenses.filter((t) => !t.bucket).length;
  if (pending) lines.push(`⏳ ${pending} harcama kova bekliyor; panelde Bekleyenler'e göz at.`);
  lines.push("", `Günlük ortalama: ${money(round(s.expense / 7), user.currency)}`);
  return lines.join("\n");
}
