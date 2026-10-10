import Progress from "@/components/Progress";
import { BUCKETS } from "@/lib/categories";
import { money } from "@/lib/format";
import type { BucketStatus } from "@/lib/planning";

/** Kova başına hedef ve harcanan; aşım durumu ikon + metinle verilir. */
export default function BucketCards({ buckets, currency }: { buckets: BucketStatus[]; currency: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {buckets.map((b) => {
        const pct = b.target > 0 ? Math.round((b.spent / b.target) * 100) : 0;
        const over = b.target > 0 && pct >= 100;
        const near = b.target > 0 && pct >= 80 && !over;
        const isSaving = b.bucket === "free";
        return (
          <div key={b.bucket} className="card space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{BUCKETS[b.bucket].label}</h3>
              <span className="text-xs text-zinc-500">%{b.pct} · hedef {money(b.target, currency)}</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">{money(b.spent, currency)}</div>
            <Progress value={pct} tone={over ? "over" : near ? "warn" : "ok"} />
            <p className={`text-xs ${over ? "text-red-700" : near ? "text-amber-700" : "text-zinc-500"}`}>
              {b.target === 0
                ? "Hedef için gelir kaynağı ekle"
                : over
                  ? `🚨 Hedefi ${money(b.spent - b.target, currency)} aştın`
                  : `${near ? "⚠️ " : ""}${money(b.target - b.spent, currency)} ${isSaving ? "daha harcayabilir ya da biriktirebilirsin" : "kaldı"}`}
            </p>
            <p className="text-xs text-zinc-400">{BUCKETS[b.bucket].hint}</p>
          </div>
        );
      })}
    </div>
  );
}
