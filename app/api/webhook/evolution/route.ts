import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { handleIncoming } from "@/lib/channels";
import { downloadMedia } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  return Boolean(expected && safeEqual(req.headers.get("x-webhook-secret") ?? "", expected));
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
  const jid: string = remote.endsWith("@lid") ? (key?.remoteJidAlt ?? key?.senderPn ?? remote) : remote;

  if (!key?.id || key.fromMe || !jid || jid.endsWith("@g.us") || jid.includes("broadcast")) {
    return NextResponse.json({ ok: true, ignored: "source" });
  }

  const message = data.message ?? {};
  const mediaKind = message.imageMessage ? "image" : message.audioMessage ? "audio" : null;
  const text = String(
    message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ?? "",
  ).trim();

  if (!text && !mediaKind) {
    return NextResponse.json({ ok: true, ignored: "unsupported" });
  }

  try {
    await handleIncoming({
      channel: "whatsapp",
      address: jid,
      handle: jid.split("@")[0].split(":")[0],
      externalId: `wa:${key.id}`,
      text,
      mediaKind,
      loadMedia: () => downloadMedia(key.id),
    });
  } catch (err) {
    console.error("[webhook] mesaj işlenemedi:", err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
