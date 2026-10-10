import Link from "next/link";
import { deleteTransaction } from "@/app/actions";
import TxForm from "@/components/TxForm";
import { requireUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/categories";
import { daysInMonth, today } from "@/lib/dates";
import { money, shortDate } from "@/lib/format";
import { isPro } from "@/lib/plans";
import { summarize, transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

const SOURCE_LABELS = { web: "Panel", whatsapp: "WhatsApp", receipt: "Fiş", voice: "Ses" } as const;

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export default async function TransactionsPage({ searchParams }: PageProps<"/app/transactions">) {
  const user = await requireUser();
  const sp = await searchParams;
  const current = today().slice(0, 7);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) && sp.month <= current ? sp.month : current;
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth(from)).padStart(2, "0")}`;
  const txs = await transactionsBetween(user.id, from, to);
  const s = summarize(txs);
  const label = new Date(`${from}T00:00:00Z`).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">İşlemler</h1>
        {isPro(user) ? (
          <a href="/api/export" className="btn-ghost">CSV indir</a>
        ) : (
          <Link href="/app/billing" className="btn-ghost">CSV indir (Pro)</Link>
        )}
      </div>

      <TxForm today={today()} />

      <div className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Link href={`?month=${shiftMonth(month, -1)}`} className="btn-ghost px-2" aria-label="Önceki ay">‹</Link>
            <span className="min-w-32 text-center font-medium capitalize">{label}</span>
            {month < current ? (
              <Link href={`?month=${shiftMonth(month, 1)}`} className="btn-ghost px-2" aria-label="Sonraki ay">›</Link>
            ) : (
              <span className="btn-ghost px-2 opacity-40">›</span>
            )}
          </div>
          <div className="text-sm text-zinc-600">
            Gider <strong className="tabular-nums">{money(s.expense, user.currency)}</strong> · Gelir{" "}
            <strong className="tabular-nums">{money(s.income, user.currency)}</strong>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="px-5 py-2 font-medium">Tarih</th>
                <th className="px-2 py-2 font-medium">Açıklama</th>
                <th className="px-2 py-2 font-medium">Kategori</th>
                <th className="px-2 py-2 font-medium">Kaynak</th>
                <th className="px-2 py-2 text-right font-medium">Tutar</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {txs.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-5 py-2 text-zinc-500">{shortDate(t.occurred_on)}</td>
                  <td className="px-2 py-2">{t.description || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2">{categoryLabel(t.category)}</td>
                  <td className="px-2 py-2 text-zinc-500">{SOURCE_LABELS[t.source]}</td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${t.type === "income" ? "text-emerald-700" : ""}`}>
                    {t.type === "income" ? "+" : "−"}
                    {money(t.amount, user.currency)}
                  </td>
                  <td className="px-5 py-2 text-right">
                    <form action={deleteTransaction}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="text-xs text-zinc-400 hover:text-red-600" aria-label="Sil">Sil</button>
                    </form>
                  </td>
                </tr>
              ))}
              {txs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-zinc-500">Bu ay kayıt yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
