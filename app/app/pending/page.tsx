import { acceptSuggestions } from "@/app/actions";
import { BucketButtons } from "@/components/BucketPicker";
import { requireUser } from "@/lib/auth";
import { BUCKETS, categoryLabel } from "@/lib/categories";
import { db, toTx } from "@/lib/db";
import { SOURCE_LABELS, money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await requireUser();
  const { data } = await db()
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .is("bucket", null)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  const txs = (data ?? []).map(toTx);
  const withSuggestion = txs.filter((t) => t.suggested_bucket).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bekleyenler</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Bankadan ya da mesajdan gelen, kovası henüz seçilmemiş harcamalar. Her harcamanın bir ihtiyaç mı (Mecburi),
            keyif mi (Yaşam), yoksa serbest/birikim mi (Serbest) olduğuna sen karar ver.
          </p>
        </div>
        {withSuggestion > 1 && (
          <form action={acceptSuggestions}>
            <button className="btn-ghost whitespace-nowrap">Önerilerin hepsini uygula ({withSuggestion})</button>
          </form>
        )}
      </div>

      {txs.length === 0 ? (
        <div className="card text-sm text-zinc-600">🎉 Bekleyen harcama yok. Hepsi kovasında.</div>
      ) : (
        <ul className="space-y-2">
          {txs.map((t) => (
            <li key={t.id} className="card flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {t.description || categoryLabel(t.category)}{" "}
                  <span className="tabular-nums">{money(t.amount, user.currency)}</span>
                </div>
                <div className="text-xs text-zinc-500">
                  {shortDate(t.occurred_on)} · {categoryLabel(t.category)} · {SOURCE_LABELS[t.source]}
                  {t.suggested_bucket && <> · öneri: {BUCKETS[t.suggested_bucket].label}</>}
                </div>
              </div>
              <BucketButtons id={t.id} suggested={t.suggested_bucket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
