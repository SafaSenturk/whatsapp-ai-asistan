"use client";

import { useActionState, useState } from "react";
import { saveRatios } from "@/app/actions";
import { BUCKETS, BUCKET_KEYS, type Bucket } from "@/lib/categories";

const PRESETS: { label: string; values: [number, number, number] }[] = [
  { label: "50/30/20 (klasik)", values: [50, 30, 20] },
  { label: "60/20/20 (yüksek kira)", values: [60, 20, 20] },
  { label: "50/20/30 (birikim odaklı)", values: [50, 20, 30] },
];

export default function RatioForm({ initial }: { initial: Record<Bucket, number> }) {
  const [values, setValues] = useState(initial);
  const [message, action, pending] = useActionState(saveRatios, null);
  const total = values.needs + values.life + values.free;
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs hover:bg-zinc-50"
            onClick={() => setValues({ needs: p.values[0], life: p.values[1], free: p.values[2] })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BUCKET_KEYS.map((b) => (
          <div key={b}>
            <label className="label" htmlFor={`pct-${b}`}>{BUCKETS[b].label} %</label>
            <input
              id={`pct-${b}`}
              name={`${b}_pct`}
              type="number"
              min={0}
              max={100}
              value={values[b]}
              onChange={(e) => setValues({ ...values, [b]: Number(e.target.value) })}
              className="input"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending || total !== 100}>Oranları kaydet</button>
        <span className={`text-sm ${total === 100 ? "text-zinc-500" : "text-red-600"}`}>Toplam: %{total}</span>
        {message && <span className="text-sm text-zinc-600">{message}</span>}
      </div>
    </form>
  );
}
