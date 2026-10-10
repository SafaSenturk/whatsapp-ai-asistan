import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth";
import { handleIncoming } from "@/lib/channels";
import { downloadTelegramFile } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(expected && safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", expected));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  // Yalnızca birebir sohbetler; gruplar ve kanallar yok sayılır.
  if (!msg?.chat?.id || msg.chat.type !== "private" || msg.from?.is_bot) {
    return NextResponse.json({ ok: true, ignored: "source" });
  }

  // En büyük çözünürlüklü fotoğraf son sıradadır.
  const photo = Array.isArray(msg.photo) ? msg.photo.at(-1) : null;
  const audio = msg.voice ?? msg.audio ?? null;
  const fileId: string | null = photo?.file_id ?? audio?.file_id ?? null;
  const mediaKind = photo ? "image" : audio ? "audio" : null;
  // "/start 123456" derin bağlantıdan gelen bağlantı kodudur.
  let text = String(msg.text ?? msg.caption ?? "").replace(/^\/start\s*/, "").replace(/^\/help$/, "yardım").trim();
  if (!text && /^\/start/.test(msg.text ?? "")) text = "yardım";

  if (!text && !mediaKind) {
    return NextResponse.json({ ok: true, ignored: "unsupported" });
  }

  const chatId = String(msg.chat.id);
  try {
    await handleIncoming({
      channel: "telegram",
      address: chatId,
      handle: msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name ?? null),
      externalId: `tgin:${chatId}:${msg.message_id}`,
      text,
      mediaKind,
      loadMedia: fileId ? () => downloadTelegramFile(fileId) : undefined,
    });
  } catch (err) {
    console.error("[telegram] mesaj işlenemedi:", err);
    // Telegram 200 almazsa aynı güncellemeyi tekrar yollar; tekrarlar zaten ayıklanıyor.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
