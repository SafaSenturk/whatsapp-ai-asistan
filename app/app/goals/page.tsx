import { addAccount, addGoal, contributeGoal, deleteOwned, updateBalance } from "@/app/actions";
import ActionForm from "@/components/ActionForm";
import Progress from "@/components/Progress";
import { requireUser } from "@/lib/auth";
import { periodRange } from "@/lib/dates";
import { money, shortDate } from "@/lib/format";
import { averageExpense, historyStart, emergencyFund, fixedTotal, loadPlan } from "@/lib/planning";
import { FREE_GOAL_LIMIT, isPro } from "@/lib/plans";
import { round, transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

const ACCOUNT_KINDS = { bank: "Banka", cash: "Nakit", card: "Kredi kartı", investment: "Yatırım" } as const;

function monthsUntil(date: string, from: string): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = date.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1));
}

export default async function GoalsPage() {
  const user = await requireUser();
  const c = user.currency;
  const { from, to } = periodRange("month");
  const [plan, past] = await Promise.all([
    loadPlan(user.id),
    transactionsBetween(user.id, historyStart(), to),
  ]);
  const fund = emergencyFund(fixedTotal(plan.fixed), averageExpense(past));
  const hasFundGoal = plan.goals.some((g) => /acil/i.test(g.name));
  // Kredi kartı bakiyesi borç olarak girilir (negatif).
  const netWorth = round(plan.accounts.reduce((s, a) => s + a.balance, 0));
  const savedTotal = round(plan.goals.reduce((s, g) => s + g.saved_amount, 0));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Hedefler & Hesaplar</h1>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Birikim hedefleri</h2>
          <span className="text-sm text-zinc-600">Toplam ayrılan: <strong className="tabular-nums">{money(savedTotal, c)}</strong></span>
        </div>

        {fund > 0 && !hasFundGoal && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            🛟 <strong>Acil durum fonu:</strong> 6 aylık giderini karşılayacak bir fon önerilir. Senin için yaklaşık{" "}
            <strong className="tabular-nums">{money(fund, c)}</strong>. Aşağıdan &quot;Acil durum fonu&quot; adıyla hedef olarak ekleyebilirsin.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {plan.goals.map((g) => {
            const pct = Math.round((g.saved_amount / g.target_amount) * 100);
            const left = round(g.target_amount - g.saved_amount);
            const monthly = g.target_date && left > 0 ? round(left / monthsUntil(g.target_date, from)) : null;
            return (
              <div key={g.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{g.name}</h3>
                    <p className="text-xs text-zinc-500">
                      {g.target_date ? `Hedef tarih: ${shortDate(g.target_date)} ${g.target_date.slice(0, 4)}` : "Tarih yok"}
                    </p>
                  </div>
                  <form action={deleteOwned}>
                    <input type="hidden" name="table" value="goals" />
                    <input type="hidden" name="id" value={g.id} />
                    <button className="text-xs text-zinc-400 hover:text-red-600">Sil</button>
                  </form>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm tabular-nums">
                    <span>{money(g.saved_amount, c)} / {money(g.target_amount, c)}</span>
                    <span>{left <= 0 ? "✅ Tamamlandı" : `%${pct}`}</span>
                  </div>
                  <Progress value={pct} tone={left <= 0 ? "ok" : "muted"} />
                  {left > 0 && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {money(left, c)} kaldı{monthly ? ` · hedefe yetişmek için ayda ${money(monthly, c)}` : ""}
                    </p>
                  )}
                </div>
                <form action={contributeGoal} className="flex gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input name="amount" inputMode="decimal" placeholder="+ tutar (çekmek için −)" aria-label="Hedefe eklenecek tutar" className="input" />
                  <button className="btn-ghost shrink-0">Ekle</button>
                </form>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3 className="mb-3 text-sm font-medium">Yeni hedef</h3>
          <ActionForm action={addGoal} submit="Hedef ekle">
            <div className="min-w-40 flex-1">
              <label className="label" htmlFor="g-name">Ad</label>
              <input id="g-name" name="name" required placeholder="Yaz tatili, kamera, acil durum fonu" className="input" />
            </div>
            <div className="w-32">
              <label className="label" htmlFor="g-target">Hedef tutar</label>
              <input id="g-target" name="target_amount" inputMode="decimal" required className="input" />
            </div>
            <div className="w-32">
              <label className="label" htmlFor="g-saved">Şu an birikmiş</label>
              <input id="g-saved" name="saved_amount" inputMode="decimal" placeholder="0" className="input" />
            </div>
            <div className="w-40">
              <label className="label" htmlFor="g-date">Hedef tarih</label>
              <input id="g-date" name="target_date" type="date" className="input" />
            </div>
          </ActionForm>
          {!isPro(user) && <p className="mt-2 text-xs text-zinc-500">Ücretsiz planda en fazla {FREE_GOAL_LIMIT} hedef.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Hesaplar</h2>
          <span className="text-sm text-zinc-600">Net varlık: <strong className="tabular-nums">{money(netWorth, c)}</strong></span>
        </div>
        <div className="card p-0">
          <ul className="divide-y divide-zinc-100 text-sm">
            {plan.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-zinc-500">
                    {ACCOUNT_KINDS[a.kind]} · güncelleme {new Date(a.updated_at).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`tabular-nums ${a.balance < 0 ? "text-red-700" : ""}`}>{money(a.balance, c)}</span>
                  <form action={updateBalance} className="flex gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    <input name="balance" inputMode="decimal" placeholder="yeni bakiye" aria-label={`${a.name} yeni bakiye`} className="input w-28 py-1" />
                    <button className="btn-ghost px-2 py-1 text-xs">Güncelle</button>
                  </form>
                  <form action={deleteOwned}>
                    <input type="hidden" name="table" value="accounts" />
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-zinc-400 hover:text-red-600">Sil</button>
                  </form>
                </div>
              </li>
            ))}
            {plan.accounts.length === 0 && (
              <li className="px-5 py-3 text-zinc-500">Banka hesaplarını, nakit ve yatırımlarını ekle; hepsini tek yerde gör.</li>
            )}
          </ul>
          <div className="border-t border-zinc-100 p-5">
            <ActionForm action={addAccount} submit="Hesap ekle">
              <div className="min-w-40 flex-1">
                <label className="label" htmlFor="a-name">Ad</label>
                <input id="a-name" name="name" required placeholder="Garanti vadesiz" className="input" />
              </div>
              <div className="w-36">
                <label className="label" htmlFor="a-kind">Tür</label>
                <select id="a-kind" name="kind" className="input">
                  {Object.entries(ACCOUNT_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className="label" htmlFor="a-balance">Bakiye</label>
                <input id="a-balance" name="balance" inputMode="decimal" placeholder="kartta borç: −" className="input" />
              </div>
            </ActionForm>
          </div>
        </div>
      </section>
    </div>
  );
}
