import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { db, type User } from "@/lib/db";
import { weeklyDigest } from "@/lib/digest";
import { sendText } from "@/lib/evolution";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Pazartesi sabahı çağrılır (Vercel Cron, GitHub Actions ya da herhangi bir zamanlayıcı).
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data } = await db()
    .from("users")
    .select("*")
    .eq("plan", "pro")
    .eq("weekly_digest", true)
    .not("wa_jid", "is", null);

  let sent = 0;
  let failed = 0;
  for (const user of (data ?? []) as User[]) {
    if (!isPro(user) || !user.wa_jid) continue;
    try {
      const text = await weeklyDigest(user);
      if (!text) continue;
      const id = await sendText(user.wa_jid, text);
      await db().from("chat_messages").insert({ user_id: user.id, role: "assistant", body: text, channel: "whatsapp", wa_message_id: id });
      sent++;
    } catch (err) {
      console.error("[cron] özet gönderilemedi:", user.id, err);
      failed++;
    }
  }
  return NextResponse.json({ ok: true, sent, failed });
}
