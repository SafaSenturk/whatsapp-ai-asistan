import { BUCKET_KEYS, type Bucket } from "./categories";
import { addDays, daysInMonth, monthStart, today } from "./dates";
import { db, numeric, type Account, type FixedExpense, type Goal, type IncomeSource, type Transaction, type User } from "./db";
import { round } from "./stats";

export type PlanData = {
  incomes: IncomeSource[];
  fixed: FixedExpense[];
  goals: Goal[];
  accounts: Account[];
};

export async function loadPlan(userId: string): Promise<PlanData> {
  const [i, f, g, a] = await Promise.all([
    db().from("income_sources").select("*").eq("user_id", userId).order("created_at"),
    db().from("fixed_expenses").select("*").eq("user_id", userId).order("day_of_month"),
    db().from("goals").select("*").eq("user_id", userId).order("created_at"),
    db().from("accounts").select("*").eq("user_id", userId).order("created_at"),
  ]);
  const failed = [i, f, g, a].find((r) => r.error);
  if (failed?.error) throw new Error(`Plan verisi okunamadı: ${failed.error.message}`);
  return {
    incomes: numeric<IncomeSource>(i.data, ["amount"]),
    fixed: numeric<FixedExpense>(f.data, ["amount"]),
    goals: numeric<Goal>(g.data, ["target_amount", "saved_amount"]),
    accounts: numeric<Account>(a.data, ["balance"]),
  };
}

export function monthlyIncome(incomes: IncomeSource[]): number {
  return round(incomes.filter((s) => s.kind === "monthly").reduce((t, s) => t + s.amount, 0));
}

export function fixedTotal(fixed: FixedExpense[]): number {
  return round(fixed.reduce((t, f) => t + f.amount, 0));
}

/** Henüz tahsil edilmemiş bir kerelik gelirler, tarihe göre. */
export function pendingReceivables(incomes: IncomeSource[]): IncomeSource[] {
  return incomes
    .filter((s) => s.kind === "once" && !s.received)
    .sort((a, b) => (a.expected_on ?? "9999").localeCompare(b.expected_on ?? "9999"));
}

export type BucketStatus = {
  bucket: Bucket;
  pct: number;
  target: number;
  spent: number;
};

/**
 * Bu ayın kova durumu. Hedefler, bu ay gerçekleşen gelir ile düzenli gelirden büyük olanına göre hesaplanır;
 * maaş henüz yatmadıysa da hedefler görünür.
 */
export function bucketStatus(user: Pick<User, "needs_pct" | "life_pct" | "free_pct">, monthTxs: Transaction[], plannedIncome: number) {
  const actualIncome = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const base = round(Math.max(actualIncome, plannedIncome));
  const pcts: Record<Bucket, number> = { needs: user.needs_pct, life: user.life_pct, free: user.free_pct };
  const expenses = monthTxs.filter((t) => t.type === "expense");
  const buckets: BucketStatus[] = BUCKET_KEYS.map((b) => ({
    bucket: b,
    pct: pcts[b],
    target: round((base * pcts[b]) / 100),
    spent: round(expenses.filter((t) => t.bucket === b).reduce((s, t) => s + t.amount, 0)),
  }));
  const pending = expenses.filter((t) => !t.bucket);
  return { base, buckets, pendingCount: pending.length, pendingTotal: round(pending.reduce((s, t) => s + t.amount, 0)) };
}

export type ForecastMonth = {
  month: string; // YYYY-MM
  income: number;
  fixed: number;
  variable: number;
  left: number;
  actual: boolean;
};

/**
 * Önümüzdeki aylar için gelir-gider tahmini.
 * Gelir = düzenli gelirler + o ay beklenen tahsilatlar.
 * Gider = sabit giderler + değişken harcama (son aylardaki ortalama giderin sabitler dışında kalanı).
 * İçinde bulunulan ayda gerçekleşenler tahminden büyükse gerçekleşen kullanılır.
 */
export function forecast(input: {
  plan: PlanData;
  /** Son 3 tam aydaki aylık ortalama gider (sabit giderler dahil, banka kayıtlarından) */
  avgExpense: number;
  monthActual: { income: number; expense: number };
  months?: number;
  now?: Date;
}): ForecastMonth[] {
  const t = today(input.now);
  const recurring = monthlyIncome(input.plan.incomes);
  const fixed = fixedTotal(input.plan.fixed);
  const pending = pendingReceivables(input.plan.incomes);
  const out: ForecastMonth[] = [];
  let cursor = monthStart(t);
  for (let i = 0; i < (input.months ?? 6); i++) {
    const month = cursor.slice(0, 7);
    const receivables = pending
      .filter((p) => (p.expected_on ? p.expected_on.slice(0, 7) === month : i === 0))
      .reduce((s, p) => s + p.amount, 0);
    let income = recurring + receivables;
    let variable = input.avgExpense - fixed;
    if (i === 0) {
      income = Math.max(recurring, input.monthActual.income) + receivables;
      variable = Math.max(input.avgExpense, input.monthActual.expense) - fixed;
    }
    income = round(income);
    variable = round(Math.max(0, variable));
    out.push({ month, income, fixed, variable, left: round(income - fixed - variable), actual: i === 0 });
    cursor = addDays(cursor, daysInMonth(cursor));
  }
  return out;
}

/** Ortalama hesabı için geçmişin başlangıcı: 3 ay önceki ayın ilk günü. */
export function historyStart(now = new Date()): string {
  return monthStart(addDays(monthStart(addDays(monthStart(today(now)), -1)), -62));
}

/** Son 3 tam aydaki aylık ortalama gider (kaydı olan aylar üzerinden). */
export function averageExpense(txs: Transaction[], now = new Date()): number {
  const end = addDays(monthStart(today(now)), -1);
  const start = historyStart(now);
  const months = new Set<string>();
  let total = 0;
  for (const tx of txs) {
    if (tx.type !== "expense" || tx.occurred_on < start || tx.occurred_on > end) continue;
    total += tx.amount;
    months.add(tx.occurred_on.slice(0, 7));
  }
  return months.size ? round(total / months.size) : 0;
}

/** Mecburi giderleri kovasının oranında tutmak için gereken aylık gelir. */
export function requiredIncome(fixedNeeds: number, needsPct: number): number {
  return needsPct > 0 ? round((fixedNeeds * 100) / needsPct) : 0;
}

/** Acil durum fonu önerisi: 6 aylık gider (veri yoksa 6 aylık sabit gider). */
export function emergencyFund(fixed: number, avgExpense: number): number {
  return round(6 * Math.max(fixed, avgExpense));
}
