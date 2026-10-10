import { db, toTx, type Budget, type Transaction } from "./db";

export type Summary = {
  income: number;
  expense: number;
  count: number;
  /** Gider kategorileri, büyükten küçüğe. */
  expenseByCategory: { category: string; total: number; count: number }[];
  incomeByCategory: { category: string; total: number; count: number }[];
};

function group(txs: Transaction[]) {
  const map = new Map<string, { category: string; total: number; count: number }>();
  for (const t of txs) {
    const row = map.get(t.category) ?? { category: t.category, total: 0, count: 0 };
    row.total += t.amount;
    row.count += 1;
    map.set(t.category, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: round(r.total) }))
    .sort((a, b) => b.total - a.total);
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summarize(txs: Transaction[]): Summary {
  const expenses = txs.filter((t) => t.type === "expense");
  const incomes = txs.filter((t) => t.type === "income");
  return {
    income: round(incomes.reduce((s, t) => s + t.amount, 0)),
    expense: round(expenses.reduce((s, t) => s + t.amount, 0)),
    count: txs.length,
    expenseByCategory: group(expenses),
    incomeByCategory: group(incomes),
  };
}

/** [from, to] aralığındaki günlük gider toplamları (boş günler 0). */
export function dailyExpenses(txs: Transaction[], from: string, to: string) {
  const totals = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "expense") totals.set(t.occurred_on, (totals.get(t.occurred_on) ?? 0) + t.amount);
  }
  const days: { day: string; total: number }[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day > to) break;
    days.push({ day, total: round(totals.get(day) ?? 0) });
  }
  return days;
}

export async function transactionsBetween(
  userId: string,
  from: string,
  to: string,
): Promise<Transaction[]> {
  const { data, error } = await db()
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`İşlemler okunamadı: ${error.message}`);
  return (data ?? []).map(toTx);
}

export async function budgetsOf(userId: string): Promise<Budget[]> {
  const { data } = await db().from("budgets").select("*").eq("user_id", userId);
  return (data ?? []).map((b) => ({ ...(b as Budget), monthly_limit: Number(b.monthly_limit) }));
}

/** Bu ay oluşturulan işlem sayısı (ücretsiz plan sınırı için). */
export async function createdThisMonth(userId: string, monthStartIso: string): Promise<number> {
  const { count } = await db()
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", `${monthStartIso}T00:00:00+03:00`);
  return count ?? 0;
}
