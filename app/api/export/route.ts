import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/categories";
import { periodRange } from "@/lib/dates";
import { isPro } from "@/lib/plans";
import { transactionsBetween } from "@/lib/stats";

export const dynamic = "force-dynamic";

function cell(v: string | number): string {
  const s = String(v);
  // Excel'de formül olarak çalışabilecek değerler etkisizleştirilir.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export async function GET() {
  const user = await requireUser();
  if (!isPro(user)) {
    return NextResponse.json({ error: "CSV dışa aktarma Pro planda." }, { status: 403 });
  }
  const { from, to } = periodRange("all");
  const txs = await transactionsBetween(user.id, from, to);
  const rows = [
    ["Tarih", "Tür", "Kategori", "Açıklama", "Tutar", "Para birimi", "Kaynak"],
    ...txs.map((t) => [
      t.occurred_on,
      t.type === "income" ? "Gelir" : "Gider",
      categoryLabel(t.category),
      t.description,
      t.amount.toFixed(2).replace(".", ","),
      user.currency,
      t.source,
    ]),
  ];
  // Türkçe Excel ayırıcı olarak ";" bekler; BOM, karakterlerin doğru görünmesini sağlar.
  const csv = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuzdan-${to}.csv"`,
    },
  });
}
