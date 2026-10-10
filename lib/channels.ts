import type { Media } from "./ai";
import { db, type Channel, type User } from "./db";
import { HELP_TEXT, handleUserMessage, recentTurns } from "./engine";
import { sendText } from "./evolution";
import { isPro } from "./plans";
import { sendTelegram } from "./telegram";

type MessagingChannel = Exclude<Channel, "web">;

/** WhatsApp ve Telegram'dan gelen mesajın ortak biçimi. */
export type Incoming = {
  channel: MessagingChannel;
  /** WhatsApp'ta jid, Telegram'da chat id */
  address: string;
  /** Kullanıcıya gösterilecek kimlik (telefon ya da kullanıcı adı) */
  handle: string | null;
  externalId: string;
  text: string;
  mediaKind: "image" | "audio" | null;
  /** Medyayı yalnızca gerektiğinde indirir (ücretsiz plan kontrolünden sonra). */
  loadMedia?: () => Promise<{ base64: string; mimeType: string } | null>;
};

const ADDRESS_COLUMN = { whatsapp: "wa_jid", telegram: "tg_chat_id" } as const;
const HANDLE_COLUMN = { whatsapp: "wa_phone", telegram: "tg_username" } as const;
const LINK_CODE = /\b(\d{6})\b/;

async function send(channel: MessagingChannel, address: string, text: string) {
  return channel === "telegram" ? sendTelegram(address, text) : sendText(address, text);
}

async function saveChat(userId: string | null, channel: Channel, role: "user" | "assistant", body: string, externalId: string | null) {
  const { data, error } = await db()
    .from("chat_messages")
    .upsert(
      { user_id: userId, role, body, channel, external_id: externalId },
      { onConflict: "external_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`Mesaj kaydedilemedi: ${error.message}`);
  return Boolean(data?.length);
}

async function reply(m: Incoming, userId: string | null, text: string) {
  const id = await send(m.channel, m.address, text);
  await saveChat(userId, m.channel, "assistant", text, id);
}

/**
 * Kullanıcıya bağlı olduğu kanaldan (önce Telegram, sonra WhatsApp) bildirim gönderir.
 * Hiçbir kanal bağlı değilse false döner.
 */
export async function notifyUser(user: User, text: string): Promise<boolean> {
  const target: [MessagingChannel, string] | null = user.tg_chat_id
    ? ["telegram", user.tg_chat_id]
    : user.wa_jid
      ? ["whatsapp", user.wa_jid]
      : null;
  if (!target) return false;
  const id = await send(target[0], target[1], text);
  await saveChat(user.id, target[0], "assistant", text, id);
  return true;
}

/** Kayıtsız adresten gelen mesaj: bağlantı kodu varsa hesabı bağlar. */
async function handleUnknown(m: Incoming) {
  const code = m.text.match(LINK_CODE)?.[1];
  if (code) {
    const { data: user } = await db().from("users").select("id, name").eq("link_code", code).maybeSingle();
    if (user) {
      const col = ADDRESS_COLUMN[m.channel];
      // Adres başka bir hesaba bağlıysa önce oradan çözülür.
      await db().from("users").update({ [col]: null, [HANDLE_COLUMN[m.channel]]: null }).eq(col, m.address);
      await db()
        .from("users")
        .update({ [col]: m.address, [HANDLE_COLUMN[m.channel]]: m.handle, link_code: null })
        .eq("id", user.id);
      await reply(m, user.id, `🎉 Hesabın bağlandı${user.name ? `, ${user.name}` : ""}!\n\n${HELP_TEXT}`);
      return;
    }
  }
  const url = process.env.APP_URL?.replace(/\/+$/, "");
  await reply(
    m,
    null,
    code
      ? "Bu kod geçersiz ya da süresi dolmuş. Paneldeki Ayarlar sayfasından yeni kod alabilirsin."
      : `Merhaba! Ben Cüzdan, harcamalarını tutan yapay zekâ finans asistanıyım.\nBaşlamak için ücretsiz hesap aç${url ? `: ${url}/signup` : ""} ve panelde gördüğün 6 haneli kodu buraya gönder.`,
  );
}

export async function handleIncoming(m: Incoming) {
  const { data } = await db().from("users").select("*").eq(ADDRESS_COLUMN[m.channel], m.address).maybeSingle();
  const user = (data as User) ?? null;

  const body = m.text || (m.mediaKind === "image" ? "[fotoğraf]" : m.mediaKind === "audio" ? "[sesli mesaj]" : "");
  // Aynı mesaj iki kez gelirse (servis yeniden denerse) ikinci kez işlenmez.
  const fresh = await saveChat(user?.id ?? null, m.channel, "user", body, m.externalId);
  if (!fresh) return;

  if (!user) {
    await handleUnknown(m);
    return;
  }

  let media: Media | null = null;
  if (m.mediaKind) {
    // Ücretsiz planda medya hiç indirilmez; engine Pro'ya yönlendirir.
    const file = isPro(user) && m.loadMedia ? await m.loadMedia() : { base64: "", mimeType: "" };
    if (!file) {
      await reply(m, user.id, "Dosyayı açamadım, bir daha gönderebilir misin?");
      return;
    }
    // Sesli notlar "audio/ogg; codecs=opus" gelebilir; model sade türü bekler.
    media = { ...file, mimeType: file.mimeType.split(";")[0].trim(), kind: m.mediaKind };
  }

  const history = (await recentTurns(user.id, m.channel)).slice(0, -1);
  let answer: string;
  try {
    answer = await handleUserMessage(user, { text: m.text, media, channel: m.channel, history });
  } catch (err) {
    console.error(`[${m.channel}] mesaj işlenemedi:`, err);
    answer = "Şu an bir sorun yaşıyorum, birkaç dakika sonra tekrar dener misin? 🙏";
  }
  await reply(m, user.id, answer);
}
