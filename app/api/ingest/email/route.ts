import { NextResponse, type NextRequest } from "next/server";
import { db, type User } from "@/lib/db";
import { MAX_EMAILS_PER_REQUEST, ingestEmails } from "@/lib/ingest";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Kullanıcının Gmail'inde çalışan Google Apps Script banka bildirim e-postalarını buraya gönderir.
 * Authorization: Bearer <ingest_token>
 * Gövde: { messages: [{ id, from, subject, date, body }] }
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!/^[a-f0-9]{48}$/.test(token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await db().from("users").select("*").eq("ingest_token", token).maybeSingle();
  const user = data as User | null;
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isPro(user)) {
    return NextResponse.json({ error: "Banka e-postalarından otomatik kayıt Pro planda." }, { status: 402 });
  }

  const payload = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(payload?.messages) ? payload.messages : [];
  if (raw.length > MAX_EMAILS_PER_REQUEST) {
    return NextResponse.json({ error: `Tek istekte en fazla ${MAX_EMAILS_PER_REQUEST} e-posta.` }, { status: 413 });
  }
  const emails = raw
    .map((m) => m as Record<string, unknown>)
    .filter((m) => typeof m.id === "string" && m.id && typeof m.body === "string")
    .map((m) => ({
      id: String(m.id).slice(0, 200),
      from: String(m.from ?? "").slice(0, 300),
      subject: String(m.subject ?? "").slice(0, 300),
      date: String(m.date ?? "").slice(0, 100),
      body: String(m.body).slice(0, 20_000),
    }));

  const result = await ingestEmails(user, emails);
  return NextResponse.json({ ok: true, ...result });
}
