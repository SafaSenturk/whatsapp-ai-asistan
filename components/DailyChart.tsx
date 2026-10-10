import { money, shortDate } from "@/lib/format";

/** Günlük gider çubukları; her çubuğun üzerine gelince tarih ve tutar görünür. */
export default function DailyChart({ days, currency }: { days: { day: string; total: number }[]; currency: string }) {
  const max = Math.max(...days.map((d) => d.total), 1);
  const W = 100 / days.length;
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Günlük harcama grafiği">
        <line x1="0" y1="40" x2="100" y2="40" stroke="#e4e4e7" strokeWidth="0.3" />
        {days.map((d, i) => {
          const h = (d.total / max) * 38;
          return (
            <g key={d.day}>
              <title>{`${shortDate(d.day)}: ${money(d.total, currency)}`}</title>
              {/* Görünmez geniş alan: ince çubuklarda da üzerine gelmeyi kolaylaştırır. */}
              <rect x={i * W} y="0" width={W} height="40" fill="transparent" />
              {d.total > 0 && (
                <rect x={i * W + W * 0.15} y={40 - h} width={W * 0.7} height={h} rx="0.6" className="fill-emerald-600 hover:fill-emerald-800" />
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>{shortDate(days[0].day)}</span>
        <span>{shortDate(days[days.length - 1].day)}</span>
      </div>
    </div>
  );
}
