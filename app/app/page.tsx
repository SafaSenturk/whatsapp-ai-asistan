import Link from "next/link";
import BucketCards from "@/components/BucketCards";
import DailyChart from "@/components/DailyChart";
import Progress from "@/components/Progress";
import { requireUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/categories";
import { PERIOD_LABELS, periodRange, type Period } from "@/lib/dates";
import { money, shortDate } from "@/lib/format";
import { averageExpense, bucketStatus, forecast, historyStart, loadPlan, monthlyIncome, pendingReceivables } from "@/lib/planning";
import { dailyExpenses, round, summarize, transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["month", "last_month", "year"];

/** En çok harcama yapılan iş yerleri (açıklamaya göre). */
function topMerchants(txs: { type: string; description: string; amount: number }[]) {
  const map = new Map<string, { name: string; total: number; count: number }>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.description) continue;
    const key = t.description.toLocaleLowerCase("tr");
    const row = map.get(key) ?? { name: t.description, total: 0, count: 0 };
    row.total += t.amount;
    row.count++;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
}

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const c = user.currency;
  const sp = await searchParams;
  const period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "month";
  const { from, to } = periodRange(period);
  const month = periodRange("month");

  const [txs, history, plan] = await Promise.all([
    transactionsBetween(user.id, from, to),
    transactionsBetween(user.id, historyStart(), month.to),
    loadPlan(user.id),
  ]);
  const monthTxs = history.filter((t) => t.occurred_on >= month.from);
  const s = summarize(txs);
  const m = summarize(monthTxs);
  const status = bucketStatus(user, monthTxs, monthlyIncome(plan.incomes));
  const [thisMonth, nextMonth] = forecast({
    plan,
    avgExpense: averageExpense(history),
    monthActual: { income: m.income, expense: m.expense },
    months: 2,
  });
  const receivables = pendingReceivables(plan.incomes);
  const days = dailyExpenses(txs, from, to);
  const merchants = topMerchants(txs);
  const net = round(s.income - s.expense);

  const tiles = [
    { label: `${PERIOD_LABELS[period]} gelir`, value: money(s.income, c) },
    { label: `${PERIOD_LABELS[period]} gider`, value: money(s.expense, c) },
    { label: "Net", value: `${net >= 0 ? "+" : "−"}${money(Math.abs(net), c)}`, tone: net < 0 ? "text-red-700" : "" },
    {
      label: "Ay sonu tahmini kalan",
      value: `${thisMonth.left >= 0 ? "+" : "−"}${money(Math.abs(thisMonth.left), c)}`,
      tone: thisMonth.left < 0 ? "text-red-700" : "text-emerald-700",
      href: "/app/planning",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Merhaba{user.name ? `, ${user.name}` : ""} 👋</h1>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/app?period=${p}`}
              className={`rounded-md px-3 py-1 ${p === period ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
      </div>

      {!user.wa_jid && !user.tg_chat_id && (
        <Link href="/app/settings" className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 hover:border-emerald-400">
          <strong>Telegram ya da WhatsApp&apos;ı bağla →</strong> Harcamalarını mesajla, fiş fotoğrafıyla ya da sesli kaydet;
          asistana &quot;bu ay markete ne kadar harcadım?&quot; diye sor.
        </Link>
      )}
      {plan.incomes.length === 0 && (
        <Link href="/app/planning" className="block rounded-xl border border-zinc-200 bg-white p-4 text-sm hover:border-emerald-400">
          <strong>Gelirini ekle →</strong> 50/30/20 kovalarının hedefleri ve ay sonu tahmini gelirine göre hesaplanır.
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <div className="text-sm text-zinc-500">{t.label}</div>
              <div className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${t.tone ?? ""}`}>{t.value}</div>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="card hover:border-emerald-600">{body}</Link>
          ) : (
            <div key={t.label} className="card">{body}</div>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Bu ayın kovaları</h2>
          {status.pendingCount > 0 && (
            <Link href="/app/pending" className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-200">
              ⏳ {status.pendingCount} harcama kova bekliyor ({money(status.pendingTotal, c)}) →
            </Link>
          )}
        </div>
        <BucketCards buckets={status.buckets} currency={c} />
      </section>

      {s.count > 0 && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="card lg:col-span-3">
            <h2 className="mb-3 font-semibold">Günlük harcama</h2>
            <DailyChart days={days} currency={c} />
          </div>
          <div className="card lg:col-span-2">
            <h2 className="mb-3 font-semibold">Kategoriler</h2>
            <ul className="space-y-3">
              {s.expenseByCategory.slice(0, 6).map((cat) => {
                const pct = Math.round((cat.total / s.expense) * 100);
                return (
                  <li key={cat.category} title={`${cat.count} işlem`}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{categoryLabel(cat.category)}</span>
                      <span className="tabular-nums text-zinc-600">{money(cat.total, c)} · %{pct}</span>
                    </div>
                    <Progress value={pct} />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-3 font-semibold">En çok harcanan yerler</h2>
          <ol className="space-y-2 text-sm">
            {merchants.map((mm, i) => (
              <li key={mm.name} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="text-zinc-400">{i + 1}.</span> {mm.name} <span className="text-xs text-zinc-400">×{mm.count}</span>
                </span>
                <span className="shrink-0 tabular-nums">{money(round(mm.total), c)}</span>
              </li>
            ))}
            {merchants.length === 0 && <li className="text-zinc-500">Henüz veri yok.</li>}
          </ol>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Önümüzdeki dönem</h2>
            <Link href="/app/planning" className="text-sm text-emerald-700 hover:underline">Planlama</Link>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Gelecek ay beklenen gelir</dt>
              <dd className="tabular-nums">{money(nextMonth.income, c)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Gelecek ay tahmini gider</dt>
              <dd className="tabular-nums">{money(round(nextMonth.fixed + nextMonth.variable), c)}</dd>
            </div>
            <div className="flex justify-between font-medium">
              <dt>Gelecek ay sonu</dt>
              <dd className={`tabular-nums ${nextMonth.left < 0 ? "text-red-700" : "text-emerald-700"}`}>
                {nextMonth.left >= 0 ? "+" : "−"}{money(Math.abs(nextMonth.left), c)}
              </dd>
            </div>
          </dl>
          {receivables.length > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <h3 className="mb-2 text-sm font-medium">Bekleyen tahsilatlar</h3>
              <ul className="space-y-1 text-sm">
                {receivables.slice(0, 4).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate">{r.name}{r.expected_on && <span className="text-zinc-400"> · {shortDate(r.expected_on)}</span>}</span>
                    <span className="tabular-nums">{money(r.amount, c)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Hedefler</h2>
            <Link href="/app/goals" className="text-sm text-emerald-700 hover:underline">Tümü</Link>
          </div>
          <ul className="space-y-3">
            {plan.goals.slice(0, 4).map((g) => {
              const pct = Math.round((g.saved_amount / g.target_amount) * 100);
              return (
                <li key={g.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate">{g.name}</span>
                    <span className="tabular-nums text-zinc-600">{pct >= 100 ? "✅" : `%${pct}`}</span>
                  </div>
                  <Progress value={pct} tone="muted" />
                </li>
              );
            })}
            {plan.goals.length === 0 && <li className="text-sm text-zinc-500">Tatil, ekipman ya da acil durum fonu için hedef ekle.</li>}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Son işlemler</h2>
          <Link href="/app/transactions" className="text-sm text-emerald-700 hover:underline">Tümü</Link>
        </div>
        <ul className="divide-y divide-zinc-100 text-sm">
          {txs.slice(0, 8).map((t) => (
            <li key={t.id} className="flex justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                <span className="text-zinc-500">{shortDate(t.occurred_on)}</span> · {t.description || categoryLabel(t.category)}
                {t.type === "expense" && !t.bucket && <span className="ml-1 text-xs text-amber-700">⏳</span>}
              </span>
              <span className={`shrink-0 tabular-nums ${t.type === "income" ? "text-emerald-700" : ""}`}>
                {t.type === "income" ? "+" : "−"}
                {money(t.amount, c)}
              </span>
            </li>
          ))}
          {txs.length === 0 && <li className="py-2 text-zinc-500">Kayıt yok.</li>}
        </ul>
      </div>
    </div>
  );
}
