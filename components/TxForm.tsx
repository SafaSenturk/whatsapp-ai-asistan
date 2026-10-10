"use client";

import { useActionState, useState } from "react";
import { addTransaction } from "@/app/actions";
import { BUCKETS, BUCKET_KEYS, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";

export default function TxForm({ today }: { today: string }) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [error, action, pending] = useActionState(addTransaction, null);
  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="type" value={type} />
      <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 text-sm sm:col-span-6 sm:w-fit">
        {(["expense", "income"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`rounded-md px-3 py-1 ${type === t ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {t === "expense" ? "Gider" : "Gelir"}
          </button>
        ))}
      </div>
      <div className="sm:col-span-1">
        <label className="label" htmlFor="amount">Tutar</label>
        <input id="amount" name="amount" inputMode="decimal" required placeholder="0,00" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="category">Kategori</label>
        <select id="category" name="category" key={type} required className="input">
          {Object.entries(categories).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className={type === "expense" ? "sm:col-span-1" : "sm:col-span-2"}>
        <label className="label" htmlFor="description">Açıklama</label>
        <input id="description" name="description" maxLength={120} placeholder="Örn. Migros" className="input" />
      </div>
      {type === "expense" && (
        <div className="sm:col-span-1">
          <label className="label" htmlFor="bucket">Kova</label>
          <select id="bucket" name="bucket" className="input">
            <option value="">Sonra seçerim</option>
            {BUCKET_KEYS.map((b) => (
              <option key={b} value={b}>{BUCKETS[b].label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-1">
        <label className="label" htmlFor="date">Tarih</label>
        <input id="date" name="date" type="date" defaultValue={today} max={today} className="input" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-6">
        <button className="btn" disabled={pending}>{pending ? "Ekleniyor…" : "Ekle"}</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
