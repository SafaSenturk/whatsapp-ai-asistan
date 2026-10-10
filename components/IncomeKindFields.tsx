"use client";

import { useState } from "react";

/** Düzenli gelirde ayın günü, bir kerelik tahsilatta beklenen tarih sorulur. */
export default function IncomeKindFields() {
  const [kind, setKind] = useState<"monthly" | "once">("monthly");
  return (
    <>
      <div className="w-36">
        <label className="label" htmlFor="inc-kind">Tür</label>
        <select id="inc-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "monthly" | "once")} className="input">
          <option value="monthly">Her ay</option>
          <option value="once">Bir kerelik tahsilat</option>
        </select>
      </div>
      {kind === "monthly" ? (
        <div className="w-20">
          <label className="label" htmlFor="inc-day">Gün</label>
          <input id="inc-day" name="day_of_month" type="number" min={1} max={31} className="input" />
        </div>
      ) : (
        <div className="w-40">
          <label className="label" htmlFor="inc-date">Beklenen tarih</label>
          <input id="inc-date" name="expected_on" type="date" className="input" />
        </div>
      )}
    </>
  );
}
