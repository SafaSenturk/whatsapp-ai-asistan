import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { handleIncoming } from "@/lib/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  const given =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(message: any): string | null {
  if (!message) return null;
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    null
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const event = String(payload?.event ?? "").toLowerCase().replace("_", ".");
  if (event !== "messages.upsert") {
    return NextResponse.json({ ok: true, ignored: "event" });
  }

  const data = payload.data;
  const key = data?.key;
  // Yeni WhatsApp sürümlerinde remoteJid "@lid" olabilir; gerçek numara alt alanlarda gelir.
  const remote: string = key?.remoteJid ?? "";
  const jid: string = remote.endsWith("@lid")
    ? (key?.remoteJidAlt ?? key?.senderPn ?? remote)
    : remote;

  if (!key?.id || !jid || jid.endsWith("@g.us") || jid.includes("broadcast")) {
    return NextResponse.json({ ok: true, ignored: "source" });
  }

  const text = extractText(data.message)?.trim();
  if (!text) {
    return NextResponse.json({ ok: true, ignored: "non-text" });
  }

  try {
    await handleIncoming({
      jid,
      phone: jid.split("@")[0].split(":")[0],
      name: data.pushName ?? null,
      text,
      waMessageId: key.id,
      fromMe: Boolean(key.fromMe),
    });
  } catch (err) {
    console.error("[webhook] mesaj işlenemedi:", err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
