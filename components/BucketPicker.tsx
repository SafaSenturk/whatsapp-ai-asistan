"use client";

import { useRef } from "react";
import { setTxBucket } from "@/app/actions";
import { BUCKETS, BUCKET_KEYS, type Bucket } from "@/lib/categories";

/** İşlemin kovasını seçer; seçim değişince kendiliğinden kaydeder. */
export function BucketSelect({ id, value }: { id: string; value: Bucket | null }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setTxBucket}>
      <input type="hidden" name="id" value={id} />
      <select
        name="bucket"
        defaultValue={value ?? ""}
        onChange={() => form.current?.requestSubmit()}
        aria-label="Kova"
        className={`rounded-md border px-1.5 py-1 text-xs ${value ? "border-zinc-200 bg-white" : "border-amber-300 bg-amber-50 text-amber-800"}`}
      >
        <option value="">⏳ Bekliyor</option>
        {BUCKET_KEYS.map((b) => (
          <option key={b} value={b}>
            {BUCKETS[b].label}
          </option>
        ))}
      </select>
    </form>
  );
}

/** Bekleyenler sayfası için büyük kova düğmeleri; önerilen kova vurgulanır. */
export function BucketButtons({ id, suggested }: { id: string; suggested: Bucket | null }) {
  return (
    <div className="flex gap-1.5">
      {BUCKET_KEYS.map((b) => (
        <form key={b} action={setTxBucket}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="bucket" value={b} />
          <button
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              suggested === b
                ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            }`}
            title={suggested === b ? "Önerilen kova" : BUCKETS[b].hint}
          >
            {BUCKETS[b].label}
          </button>
        </form>
      ))}
    </div>
  );
}
