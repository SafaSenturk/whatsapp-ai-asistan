/** Yatay ilerleme çubuğu; durum rengi her zaman metinle birlikte kullanılır. */
export default function Progress({ value, tone = "ok" }: { value: number; tone?: "ok" | "warn" | "over" | "muted" }) {
  const color = { ok: "bg-emerald-600", warn: "bg-amber-500", over: "bg-red-600", muted: "bg-zinc-400" }[tone];
  return (
    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
