import { deleteBudget } from "@/app/actions";
import BudgetBar from "@/components/BudgetBar";
import BucketCards from "@/components/BucketCards";
import BudgetForm from "@/components/BudgetForm";
import RatioForm from "@/components/RatioForm";
import { bucketStatus, loadPlan, monthlyIncome } from "@/lib/planning";
import { money } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { periodRange } from "@/lib/dates";
import { FREE_BUDGET_LIMIT, isPro } from "@/lib/plans";
import { budgetsOf, summarize, transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await requireUser();
  const { from, to } = periodRange("month");
  const [budgets, txs, plan] = await Promise.all([budgetsOf(user.id), transactionsBetween(user.id, from, to), loadPlan(user.id)]);
  const s = summarize(txs);
  const status = bucketStatus(user, txs, monthlyIncome(plan.incomes));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kovalar</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Gelirini üç kovaya böl: Mecburi (ihtiyaçlar), Yaşam (keyif) ve Serbest (birikim, gezi, hedefler). Bu ayın hedefleri{" "}
          <strong className="tabular-nums">{money(status.base, user.currency)}</strong> gelir üzerinden hesaplanıyor.
        </p>
      </div>
      <BucketCards buckets={status.buckets} currency={user.currency} />
      <div className="card max-w-2xl">
        <h2 className="mb-3 font-semibold">Oranlar</h2>
        <RatioForm initial={{ needs: user.needs_pct, life: user.life_pct, free: user.free_pct }} />
      </div>

      <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Kategori bütçeleri</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Kategori başına aylık sınır koy. Harcama %80&apos;e ulaşınca ve sınırı aşınca WhatsApp&apos;tan uyarı alırsın.
          {!isPro(user) && ` Ücretsiz planda en fazla ${FREE_BUDGET_LIMIT} bütçe.`}
        </p>
      </div>
      <BudgetForm />
      <div className="card space-y-5">
        {budgets.length === 0 && <p className="text-sm text-zinc-500">Henüz bütçe yok.</p>}
        {budgets.map((b) => (
          <div key={b.category} className="flex items-start gap-3">
            <div className="flex-1">
              <BudgetBar
                category={b.category}
                limit={b.monthly_limit}
                spent={s.expenseByCategory.find((x) => x.category === b.category)?.total ?? 0}
                currency={user.currency}
              />
            </div>
            <form action={deleteBudget}>
              <input type="hidden" name="category" value={b.category} />
              <button className="text-xs text-zinc-400 hover:text-red-600">Kaldır</button>
            </form>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
