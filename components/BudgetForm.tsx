"use client";

import { useActionState } from "react";
import { saveBudget } from "@/app/actions";
import { EXPENSE_CATEGORIES } from "@/lib/categories";

export default function BudgetForm() {
  const [error, action, pending] = useActionState(saveBudget, null);
  return (
    <form action={action} className="card flex flex-wrap items-end gap-3">
      <div className="min-w-40 flex-1">
        <label className="label" htmlFor="b-category">Kategori</label>
        <select id="b-category" name="category" className="input">
          {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="w-40">
        <label className="label" htmlFor="b-amount">Aylık sınır</label>
        <input id="b-amount" name="amount" inputMode="decimal" required placeholder="5000" className="input" />
      </div>
      <button className="btn" disabled={pending}>{pending ? "Kaydediliyor…" : "Kaydet"}</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
