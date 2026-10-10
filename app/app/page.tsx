import Link from "next/link";
import BudgetBar from "@/components/BudgetBar";
import DailyChart from "@/components/DailyChart";
import { requireUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/categories";
import { PERIOD_LABELS, periodRange, type Period } from "@/lib/dates";
import { money, shortDate } from "@/lib/format";
import { budgetsOf, dailyExpenses, round, summarize, transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["month", "last_month", "year"];

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "month";
  const { from, to } = periodRange(period);

  const [txs, budgets, monthTxs] = await Promise.all([
    transactionsBetween(user.id, from, to),
    budgetsOf(user.id),
    period === "month" ? Promise.resolve(null) : transactionsBetween(user.id, periodRange("month").from, periodRange("month").to),
  ]);
  const s = summarize(txs);
  const month = monthTxs ? summarize(monthTxs) : s;
  const net = round(s.income - s.expense);
  const days = dailyExpenses(txs, from, to);
  const c = user.currency;

  const tiles = [
    { label: "Gider", value: money(s.expense, c) },
    { label: "Gelir", value: money(s.income, c) },
    { label: "Net", value: `${net >= 0 ? "+" : "−"}${money(Math.abs(net), c)}` },
    { label: "Günlük ortalama gider", value: money(round(s.expense / days.length), c) },
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

      {!user.wa_jid && (
        <Link href="/app/settings" className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 hover:border-emerald-400">
          <strong>WhatsApp&apos;ını bağla →</strong> Harcamalarını WhatsApp&apos;tan yazarak, fiş fotoğrafı ya da sesli
          mesajla kaydet.
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <div className="text-sm text-zinc-500">{t.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{t.value}</div>
          </div>
        ))}
      </div>

      {s.count === 0 ? (
        <div className="card text-sm text-zinc-600">
          {PERIOD_LABELS[period]} için kayıt yok. <Link href="/app/transactions" className="text-emerald-700 underline">İşlem ekle</Link>{" "}
          ya da <Link href="/app/assistant" className="text-emerald-700 underline">asistana yaz</Link>.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="card lg:col-span-3">
            <h2 className="mb-3 font-semibold">Günlük harcama</h2>
            <DailyChart days={days} currency={c} />
          </div>
          <div className="card lg:col-span-2">
            <h2 className="mb-3 font-semibold">Kategoriler</h2>
            <ul className="space-y-3">
              {s.expenseByCategory.slice(0, 7).map((cat) => {
                const pct = Math.round((cat.total / s.expense) * 100);
                return (
                  <li key={cat.category} title={`${cat.count} işlem`}>
                    <div className="flex justify-between text-sm">
                      <span>{categoryLabel(cat.category)}</span>
                      <span className="tabular-nums text-zinc-600">
                        {money(cat.total, c)} · %{pct}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Bu ayın bütçeleri</h2>
            <Link href="/app/budgets" className="text-sm text-emerald-700 hover:underline">
              Düzenle
            </Link>
          </div>
          {budgets.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz bütçe yok. Kategori bazlı aylık bütçe koy, aşmadan haber verelim.</p>
          ) : (
            <div className="space-y-4">
              {budgets.map((b) => (
                <BudgetBar
                  key={b.category}
                  category={b.category}
                  limit={b.monthly_limit}
                  spent={month.expenseByCategory.find((x) => x.category === b.category)?.total ?? 0}
                  currency={c}
                />
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Son işlemler</h2>
            <Link href="/app/transactions" className="text-sm text-emerald-700 hover:underline">
              Tümü
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100 text-sm">
            {txs.slice(0, 8).map((t) => (
              <li key={t.id} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="text-zinc-500">{shortDate(t.occurred_on)}</span> · {t.description || categoryLabel(t.category)}
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
    </div>
  );
}
