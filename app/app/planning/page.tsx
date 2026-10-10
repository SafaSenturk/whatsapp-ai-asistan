import { addFixedExpense, addIncomeSource, deleteOwned, markReceived } from "@/app/actions";
import ActionForm from "@/components/ActionForm";
import IncomeKindFields from "@/components/IncomeKindFields";
import { requireUser } from "@/lib/auth";
import { BUCKETS, BUCKET_KEYS, EXPENSE_CATEGORIES, categoryLabel } from "@/lib/categories";
import { periodRange } from "@/lib/dates";
import { money, monthName, shortDate } from "@/lib/format";
import { averageExpense, historyStart, fixedTotal, forecast, loadPlan, monthlyIncome, pendingReceivables, requiredIncome } from "@/lib/planning";
import { summarize, transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

function DeleteButton({ table, id }: { table: string; id: string }) {
  return (
    <form action={deleteOwned}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-zinc-400 hover:text-red-600">Sil</button>
    </form>
  );
}

export default async function PlanningPage() {
  const user = await requireUser();
  const c = user.currency;
  const { from, to } = periodRange("month");
  const [plan, past] = await Promise.all([
    loadPlan(user.id),
    transactionsBetween(user.id, historyStart(), to),
  ]);
  const month = summarize(past.filter((t) => t.occurred_on >= from));
  const avgExpense = averageExpense(past);
  const rows = forecast({ plan, avgExpense, monthActual: { income: month.income, expense: month.expense } });
  const fixed = fixedTotal(plan.fixed);
  const fixedNeeds = plan.fixed.filter((f) => f.bucket === "needs").reduce((s, f) => s + f.amount, 0);
  const needIncome = requiredIncome(fixedNeeds, user.needs_pct);
  const recurring = monthlyIncome(plan.incomes);
  const receivables = pendingReceivables(plan.incomes);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.left)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Planlama</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gelirlerini ve sabit giderlerini gir; Cüzdan önümüzdeki ayları hesaplasın, nerede açık vereceğini önceden gör.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Düzenli aylık gelir", value: money(recurring, c) },
          { label: "Sabit giderler", value: money(fixed, c) },
          { label: "Ortalama aylık gider", value: avgExpense ? money(avgExpense, c) : "—", hint: "son 3 ay" },
          { label: `Gereken gelir (Mecburi %${user.needs_pct})`, value: needIncome ? money(needIncome, c) : "—", hint: "mecburi sabitler kovasında kalsın diye" },
        ].map((t) => (
          <div key={t.label} className="card">
            <div className="text-sm text-zinc-500">{t.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{t.value}</div>
            {t.hint && <div className="text-xs text-zinc-400">{t.hint}</div>}
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="mb-1 font-semibold">6 aylık tahmin</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Gelir = düzenli gelirler + o ay beklenen tahsilatlar. Gider = sabitler + son 3 ayın ortalamasından kalan değişken harcama.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Ay</th>
                <th className="py-2 text-right font-medium">Gelir</th>
                <th className="py-2 text-right font-medium">Sabit</th>
                <th className="py-2 text-right font-medium">Değişken</th>
                <th className="py-2 text-right font-medium">Ay sonu</th>
                <th className="w-40 py-2 pl-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="py-2">
                    <span className="capitalize">{monthName(r.month)}</span>
                    {r.actual && <span className="ml-1 text-xs text-zinc-400">(bu ay)</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{money(r.income, c)}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.fixed, c)}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.variable, c)}</td>
                  <td className={`py-2 text-right font-medium tabular-nums ${r.left < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {r.left < 0 ? "−" : "+"}
                    {money(Math.abs(r.left), c)}
                  </td>
                  <td className="py-2 pl-4" title={`${r.left < 0 ? "Açık" : "Kalan"}: ${money(Math.abs(r.left), c)}`}>
                    <div className="h-2 rounded-full bg-zinc-100">
                      <div className={`h-full rounded-full ${r.left < 0 ? "bg-red-600" : "bg-emerald-600"}`} style={{ width: `${(Math.abs(r.left) / maxAbs) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.some((r) => r.left < 0) && (
          <p className="mt-3 text-sm text-red-700">⚠️ Bazı aylarda açık görünüyor: ek gelir ya da gider kısmayı şimdiden planla.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="font-semibold">Gelir kaynakları</h2>
          <ul className="divide-y divide-zinc-100 text-sm">
            {plan.incomes.filter((i) => i.kind === "monthly").map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {i.name} <span className="text-zinc-500">· her ay{i.day_of_month ? ` ${i.day_of_month}'inde` : ""}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{money(i.amount, c)}</span>
                  <DeleteButton table="income_sources" id={i.id} />
                </span>
              </li>
            ))}
          </ul>
          {receivables.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-700">Bekleyen tahsilatlar</h3>
              <ul className="divide-y divide-zinc-100 text-sm">
                {receivables.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      {i.name} {i.expected_on && <span className="text-zinc-500">· {shortDate(i.expected_on)}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums">{money(i.amount, c)}</span>
                      <form action={markReceived}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn-ghost px-2 py-1 text-xs">Geldi ✓</button>
                      </form>
                      <DeleteButton table="income_sources" id={i.id} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ActionForm action={addIncomeSource} submit="Ekle" className="border-t border-zinc-100 pt-4">
            <div className="min-w-36 flex-1">
              <label className="label" htmlFor="inc-name">Ad</label>
              <input id="inc-name" name="name" required placeholder="Maaş, sponsor…" className="input" />
            </div>
            <div className="w-32">
              <label className="label" htmlFor="inc-amount">Tutar</label>
              <input id="inc-amount" name="amount" inputMode="decimal" required className="input" />
            </div>
            <IncomeKindFields />
          </ActionForm>
        </section>

        <section className="card space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Sabit giderler</h2>
            <span className="text-sm tabular-nums text-zinc-600">{money(fixed, c)} / ay</span>
          </div>
          <ul className="divide-y divide-zinc-100 text-sm">
            {plan.fixed.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {f.name}{" "}
                  <span className="text-zinc-500">
                    · ayın {f.day_of_month}&apos;i · {categoryLabel(f.category)} · {BUCKETS[f.bucket].label}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{money(f.amount, c)}</span>
                  <DeleteButton table="fixed_expenses" id={f.id} />
                </span>
              </li>
            ))}
            {plan.fixed.length === 0 && <li className="py-2 text-zinc-500">Kira, faturalar, abonelikler…</li>}
          </ul>
          <ActionForm action={addFixedExpense} submit="Ekle" className="border-t border-zinc-100 pt-4">
            <div className="min-w-36 flex-1">
              <label className="label" htmlFor="fx-name">Ad</label>
              <input id="fx-name" name="name" required placeholder="Ev kirası" className="input" />
            </div>
            <div className="w-28">
              <label className="label" htmlFor="fx-amount">Tutar</label>
              <input id="fx-amount" name="amount" inputMode="decimal" required className="input" />
            </div>
            <div className="w-20">
              <label className="label" htmlFor="fx-day">Gün</label>
              <input id="fx-day" name="day_of_month" type="number" min={1} max={31} defaultValue={1} className="input" />
            </div>
            <div className="w-36">
              <label className="label" htmlFor="fx-cat">Kategori</label>
              <select id="fx-cat" name="category" defaultValue="faturalar" className="input">
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="label" htmlFor="fx-bucket">Kova</label>
              <select id="fx-bucket" name="bucket" defaultValue="needs" className="input">
                {BUCKET_KEYS.map((b) => (
                  <option key={b} value={b}>{BUCKETS[b].label}</option>
                ))}
              </select>
            </div>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
