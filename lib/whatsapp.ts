import type { Media } from "./ai";
import { db, type User } from "./db";
import { HELP_TEXT, handleUserMessage, recentTurns } from "./engine";
import { downloadMedia, sendText } from "./evolution";

export type Incoming = {
  jid: string;
  phone: string;
  waMessageId: string;
  text: string;
  mediaKind: "image" | "audio" | null;
};

const LINK_CODE = /\b(\d{6})\b/;

async function saveChat(userId: string | null, role: "user" | "assistant", body: string, waMessageId: string | null) {
  const { data, error } = await db()
    .from("chat_messages")
    .upsert(
      { user_id: userId, role, body, channel: "whatsapp", wa_message_id: waMessageId },
      { onConflict: "wa_message_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`Mesaj kaydedilemedi: ${error.message}`);
  return Boolean(data?.length);
}

async function reply(userId: string | null, jid: string, text: string) {
  const id = await sendText(jid, text);
  await saveChat(userId, "assistant", text, id);
}

/** Kayıtsız numaradan gelen mesaj: bağlantı kodu varsa hesabı bağlar. */
async function handleUnknown(m: Incoming) {
  const code = m.text.match(LINK_CODE)?.[1];
  if (code) {
    const { data: user } = await db().from("users").select("id, name").eq("link_code", code).maybeSingle();
    if (user) {
      // Numara başka bir hesaba bağlıysa önce oradan çözülür.
      await db().from("users").update({ wa_jid: null, wa_phone: null }).eq("wa_jid", m.jid);
      await db()
        .from("users")
        .update({ wa_jid: m.jid, wa_phone: m.phone, link_code: null })
        .eq("id", user.id);
      await reply(user.id, m.jid, `🎉 Hesabın bağlandı${user.name ? `, ${user.name}` : ""}!\n\n${HELP_TEXT}`);
      return;
    }
  }
  const url = process.env.APP_URL?.replace(/\/+$/, "");
  await reply(
    null,
    m.jid,
    code
      ? "Bu kod geçersiz ya da süresi dolmuş. Paneldeki Ayarlar sayfasından yeni kod alabilirsin."
      : `Merhaba! Ben Cüzdan, WhatsApp'tan harcamalarını tutan yapay zekâ asistanıyım.\nBaşlamak için ücretsiz hesap aç${url ? `: ${url}/signup` : ""} ve panelde gördüğün 6 haneli kodu buraya gönder.`,
  );
}

export async function handleWhatsapp(m: Incoming) {
  const { data } = await db().from("users").select("*").eq("wa_jid", m.jid).maybeSingle();
  const user = (data as User) ?? null;

  const body = m.text || (m.mediaKind === "image" ? "[fotoğraf]" : m.mediaKind === "audio" ? "[sesli mesaj]" : "");
  // Aynı mesaj iki kez gelirse (Evolution yeniden denerse) ikinci kez işlenmez.
  const fresh = await saveChat(user?.id ?? null, "user", body, m.waMessageId);
  if (!fresh) return;

  if (!user) {
    await handleUnknown(m);
    return;
  }

  let media: Media | null = null;
  if (m.mediaKind) {
    const file = await downloadMedia(m.waMessageId);
    if (!file) {
      await reply(user.id, m.jid, "Dosyayı açamadım, bir daha gönderebilir misin?");
      return;
    }
    // WhatsApp sesli notları "audio/ogg; codecs=opus" gelir; model sade türü bekler.
    media = { ...file, mimeType: file.mimeType.split(";")[0].trim(), kind: m.mediaKind };
  }

  const history = (await recentTurns(user.id, "whatsapp")).slice(0, -1);
  let answer: string;
  try {
    answer = await handleUserMessage(user, { text: m.text, media, channel: "whatsapp", history });
  } catch (err) {
    console.error("[whatsapp] mesaj işlenemedi:", err);
    answer = "Şu an bir sorun yaşıyorum, birkaç dakika sonra tekrar dener misin? 🙏";
  }
  await reply(user.id, m.jid, answer);
}
