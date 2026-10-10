import { categoryLabel } from "@/lib/categories";
import { money } from "@/lib/format";

/** Bütçe kullanım çubuğu. Durum renk + metinle birlikte verilir. */
export default function BudgetBar({
  category,
  spent,
  limit,
  currency,
}: {
  category: string;
  spent: number;
  limit: number;
  currency: string;
}) {
  const pct = Math.round((spent / limit) * 100);
  const state = pct >= 100 ? "Aşıldı" : pct >= 80 ? "Sınıra yakın" : "Yolunda";
  const color = pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-600";
  const text = pct >= 100 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-emerald-700";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{categoryLabel(category)}</span>
        <span className="tabular-nums text-zinc-600">
          {money(spent, currency)} / {money(limit, currency)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100" title={`%${pct}`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className={`mt-1 text-xs ${text}`}>
        {pct >= 100 ? "🚨" : pct >= 80 ? "⚠️" : "✓"} {state} · %{pct}
      </div>
    </div>
  );
}
